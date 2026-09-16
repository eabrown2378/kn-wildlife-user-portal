/**
 * Building the search query from a validated filter object and a chosen anchor.
 *
 * Every value the user supplied travels as a query parameter, so a name containing a quote is
 * data and cannot alter the query. That also lets the database reuse a compiled plan: the
 * query text for a given anchor is fixed, so the same search shape is planned once however
 * many times it runs with different names.
 *
 * The anchor decides which MATCH the query starts from. Whichever filters the anchor does not
 * consume are applied afterwards as predicates. All three anchors return the same rows for the
 * same filters, which is what makes the planner's choice safe.
 */

const { TAXON_FIELDS } = require('./query_filters');

/** The parameter name each rank filter travels under. */
const RANK_PARAMS = {
    Species: 'species',
    Genus: 'genus',
    Family: 'family',
    Order: 'order',
    TaxClass: 'taxClass',
    Phylum: 'phyla',
    Kingdom: 'kingdoms',
};

/** The column each rank is projected into, matching the CSV the client writes. */
const RANK_COLUMNS = {
    Species: 'n',
    Genus: 'g',
    Family: 'f',
    Order: 'o',
    TaxClass: 'c',
    Phylum: 'ph',
    Kingdom: 'k',
};

/**
 * The ranks above the taxon an observation was identified to.
 *
 * An identification stops wherever the identifier stopped, so the taxon reached by
 * OBSERVED_ORGANISM may be a species, a genus, a family, an order or a class. Each rank is
 * picked out of the chain above it by label, so a rank missing from the chain leaves its
 * column empty and every rank that is present still lands in its own column.
 */
const RANK_WALK = `
    OPTIONAL MATCH (idTaxon)-[:BELONGS_TO]->(t1)
    OPTIONAL MATCH (t1)-[:BELONGS_TO]->(t2)
    OPTIONAL MATCH (t2)-[:BELONGS_TO]->(t3)
    OPTIONAL MATCH (t3)-[:BELONGS_TO]->(t4)
    OPTIONAL MATCH (t4)-[:BELONGS_TO]->(t5)
    OPTIONAL MATCH (t5)-[:BELONGS_TO]->(t6)
    WITH p, r, s, d, p1, p2,
         [x IN [idTaxon, t1, t2, t3, t4, t5, t6] WHERE x IS NOT NULL] AS chain
    WITH p, r, s, d, p1, p2,
         head([x IN chain WHERE x:Species]) AS n,
         head([x IN chain WHERE x:Genus]) AS g,
         head([x IN chain WHERE x:Family]) AS f,
         head([x IN chain WHERE x:Order]) AS o,
         head([x IN chain WHERE x:TaxClass]) AS c,
         head([x IN chain WHERE x:Phylum]) AS ph,
         head([x IN chain WHERE x:Kingdom]) AS k`;

/**
 * Reaching an observation's place.
 *
 * An observation is a sampling event with one location, attached at whatever resolution the
 * source provides. Where the source gives coordinates the event reaches a Site; where it
 * localises only to a county there is no site at all; and a site on open water sits in no
 * county, because county boundaries stop at the shoreline. Both hops are therefore optional
 * and each is matched separately, so a site with no county keeps its coordinates and an
 * observation with no site keeps everything else.
 *
 * Every anchor uses this same pair, which is what makes their results agree.
 */
const OPTIONAL_PLACE = `
    OPTIONAL MATCH (p)-[:OBSERVED_IN]->(s:Site)
    OPTIONAL MATCH (s)-[:IN_COUNTY]->(p1:County)-[:IN_STATE]->(p2:State)`;

/** The predicate selecting the named places, used when the query anchors on them. */
function placePredicate(filters) {
    const parts = [];
    if (filters.states.length !== 0) parts.push('p2.name IN $states');
    if (filters.counties.length !== 0) parts.push('p1.name IN $counties');
    return parts.join(' OR ');
}

/**
 * Where a taxonomic search starts.
 *
 * The taxa named are found first, then everything under them, then the observations carrying
 * one of those taxa. The anchor covers the taxon itself and every taxon below it, so choosing
 * a class finds records identified at any rank within it. That matters because an
 * identification stops wherever the identifier stopped: every observation of class Bivalvia is
 * recorded against a genus, so a search recognising only species would find none of them.
 */
function taxonAnchorMatch(filters) {
    const predicates = TAXON_FIELDS
        .filter(([field]) => filters[field].length !== 0)
        .map(([, label]) =>
            `(anchorTaxon:${label} AND anchorTaxon.name IN $${RANK_PARAMS[label]})`)
        .join('\n       OR ');

    return `
    MATCH (anchorTaxon)
    WHERE ${predicates}
    MATCH (anchorTaxon)<-[:BELONGS_TO*0..6]-(idTaxon)
    WITH DISTINCT idTaxon
    MATCH (idTaxon)<-[r:OBSERVED_ORGANISM]-(p:Observation)-[:FROM_DATASET]->(d:Dataset)${OPTIONAL_PLACE}`;
}

/**
 * Where a place search starts.
 *
 * The chosen places are found first. There are 3,142 counties and 51 states, so reaching the
 * observations from them costs one pass over a handful of nodes. Reaching the places from the
 * observations costs a pass over twenty million.
 *
 * States and counties are OR'd. Naming Iowa together with a county of Iowa is not a
 * contradiction to be arbitrated: Adair sits inside Iowa, so the union is simply Iowa.
 *
 * A site with no county cannot satisfy a place filter, so requiring the county chain here
 * costs nothing and lets the database seek from the State index.
 */
function locationAnchorMatch(filters) {
    return `
    MATCH (p1:County)-[:IN_STATE]->(p2:State)
    WHERE ${placePredicate(filters)}
    WITH DISTINCT p1, p2
    MATCH (p1)<-[:IN_COUNTY]-(s:Site)<-[:OBSERVED_IN]-(p:Observation)-[:FROM_DATASET]->(d:Dataset)
    MATCH (p)-[r:OBSERVED_ORGANISM]->(idTaxon)`;
}

/**
 * Where a search with no taxon and no place starts.
 *
 * An observation is a sampling event carrying every taxon recorded at it, so each is expanded
 * here. A search with no filters at all is refused before it reaches this.
 */
function unanchoredMatch() {
    return `
    MATCH (p:Observation)-[:FROM_DATASET]->(d:Dataset)
    MATCH (p)-[r:OBSERVED_ORGANISM]->(idTaxon)${OPTIONAL_PLACE}`;
}

/**
 * The predicate testing the rank columns the walk resolved.
 *
 * Used when the query anchors on something other than the taxon. It adds no traversal, since
 * the walk runs anyway to fill the CSV columns; this is a property comparison on columns that
 * are already there.
 *
 * Every named taxon is included whatever rank it sits at, and the ranks are OR'd. That is the
 * union of the groups the user named, which is the only reading that makes sense across taxa:
 * nothing is both Aves and Micropterus, so there is no intersection to offer.
 */
function taxonRankPredicate(filters) {
    return '(' + TAXON_FIELDS
        .filter(([field]) => filters[field].length !== 0)
        .map(([, label]) => `${RANK_COLUMNS[label]}.name IN $${RANK_PARAMS[label]}`)
        .join('\n         OR ') + ')';
}

/** The predicate restricting results to the named places, tested after the walk. */
function placeColumnPredicate(filters) {
    return '(' + placePredicate(filters) + ')';
}

/**
 * The parameters a query carries.
 *
 * Every user-supplied value is here, so the query text holds none of them. Values a query does
 * not mention are harmless: the driver sends them and the planner ignores them.
 */
function queryParameters(filters) {
    return {
        species: filters.species,
        genus: filters.genus,
        family: filters.family,
        order: filters.order,
        taxClass: filters.tax_class,
        phyla: filters.phyla,
        kingdoms: filters.kingdoms,
        states: filters.states,
        counties: filters.counties,
        datasets: filters.datasets,
        dataTypes: filters.dataTypes,
        fromDate: filters.fromDate,
        toDate: filters.toDate,
        minLat: filters.minLat === null ? -90 : filters.minLat,
        maxLat: filters.maxLat === null ? 90 : filters.maxLat,
        minLon: filters.minLon === null ? -180 : filters.minLon,
        maxLon: filters.maxLon === null ? 180 : filters.maxLon,
    };
}

/**
 * The three output shapes, derived from the same matched rows by one aggregating WITH.
 *
 * csv is the flat observation rows, map is the marker rows the leaflet view reads, and meta is
 * the dataset attribution. The graph view is built from the csv rows, which already name every
 * rank and the dataset, so its node counts agree with the table and nothing extra is asked of
 * the database.
 */
function projection(covars) {
    // Each covariate key is checked against the keys the graph declares before it reaches
    // here, because a property name cannot be a query parameter.
    const covarEntries = covars.map((key) => `, ${key}: p.${key}`).join('');

    return `
    WITH collect({
            species: n.name, genus: g.name, family: f.name, \`order\`: o.name, class: c.name,
            site: s.name, longitude_dd: s.longitude_dd, latitude_dd: s.latitude_dd,
            coordinate_uncertainty_m: s.coordinate_uncertainty_m,
            is_polygon: coalesce(s.is_polygon, false), geo_asWKT: s.geo_asWKT,
            state: p2.name, county: p1.name, state_fips: p2.state_fips, county_fips: p1.county_fips,
            date: toString(p.date), dataset: d.name,
            observation_url: p.source_url, record_licence: p.record_licence,
            rights_holder: p.rights_holder,
            agency_organization_researchGroup: d.agency_organization_researchGroup, program_name: d.program_name,
            measurement_result: coalesce(r.measurement_value_numeric, r.measurement_value_text),
            measurement_unit: r.measurement_unit, measurement_type: r.measurement_type,
            sampling_method: r.sampling_method,
            sampling_effort: coalesce(r.sampling_effort_numeric, r.sampling_effort_text),
            sampling_effort_unit: r.sampling_effort_unit${covarEntries}
        }) AS csv,
        collect({
            site: s.name, date: toString(p.date),
            longitude_dd: s.longitude_dd, latitude_dd: s.latitude_dd,
            species: n.name, genus: g.name, family: f.name,
            dataset: d.name,
            measurement_result: r.measurement_value_numeric, measurement_type: r.measurement_type,
            measurement_unit: r.measurement_unit
        }) AS map,
        collect(DISTINCT {
            datasetName: d.name, citations: d.dataset_citations, urls: d.dataset_urls,
            downloadDate: d.download_date, notes: d.additional_notes
        }) AS meta
    RETURN csv, map, meta`;
}

/**
 * Build the Cypher for a search.
 *
 * `anchor` comes from the planner and names which filter the query starts from. Returns the
 * query text and the parameters to send with it.
 */
function buildCypher(filters, anchor) {
    if (!filters.hasAnyFilter) {
        throw new Error('A search with no filters asks for the whole graph and is not built.');
    }

    // A taxon anchor is only possible when a taxon was named, and likewise for a place. The
    // planner already respects that; this keeps a bad anchor from producing a query that
    // silently drops a filter.
    const useTaxonAnchor = anchor === 'taxon' && filters.hasTaxonFilter;
    const useLocationAnchor = anchor === 'location' && filters.hasLocationFilter;

    const match = useTaxonAnchor ? taxonAnchorMatch(filters)
        : useLocationAnchor ? locationAnchorMatch(filters)
        : unanchoredMatch();

    const predicates = [];

    // The anchor consumes the filter it started from. Everything else is tested afterwards.
    if (filters.hasTaxonFilter && !useTaxonAnchor) {
        predicates.push(taxonRankPredicate(filters));
    }
    if (filters.hasLocationFilter && !useLocationAnchor) {
        predicates.push(placeColumnPredicate(filters));
    }
    if (filters.datasets.length !== 0) {
        predicates.push('d.name IN $datasets');
    }
    if (filters.dataTypes.length !== 0) {
        predicates.push('r.measurement_type IN $dataTypes');
    }
    if (filters.hasCoordinateFilter) {
        predicates.push(`(toFloat(s.longitude_dd) >= $minLon
         AND toFloat(s.longitude_dd) <= $maxLon
         AND toFloat(s.latitude_dd) >= $minLat
         AND toFloat(s.latitude_dd) <= $maxLat)`);
    }

    // The date is reduced to its first ten characters before being read as a date, so a value
    // stored as a date and one stored as an ISO string are both handled.
    let dateProjection = '';
    if (filters.hasDateFilter) {
        dateProjection = `
    WITH p, r, s, d, p1, p2, n, g, f, o, c, ph, k,
         date(substring(toString(p.date), 0, 10)) AS observedOn`;

        if (filters.fromDate !== null && filters.toDate !== null) {
            predicates.push('(observedOn >= date($fromDate) AND observedOn <= date($toDate))');
        } else if (filters.fromDate !== null) {
            predicates.push('observedOn >= date($fromDate)');
        } else {
            predicates.push('observedOn <= date($toDate)');
        }
    }

    const where = predicates.length !== 0
        ? `\n    WHERE ${predicates.join('\n      AND ')}`
        : '';

    const query = match + RANK_WALK + dateProjection + where + projection(filters.covars);

    return { query, parameters: queryParameters(filters) };
}

module.exports = {
    buildCypher,
    queryParameters,
    projection,
    RANK_WALK,
    RANK_PARAMS,
    RANK_COLUMNS,
};


/**
 * The last day of a month, so an open-ended "to" bound covers the whole month.
 *
 * Day 0 of the following month is the last day of this one, and December rolls over to
 * January on its own. Leap-year correct for century years, where a `year % 4` test is not.
 */
// how the per-rank anchor predicates are joined
const NEWLINE_OR = '\n               OR ';

// The ranks above the taxon an observation was identified to.
//
// An identification stops wherever the identifier stopped, so the taxon reached by
// OBSERVED_ORGANISM may be a species, a genus, a family, an order or a class. Each rank is
// picked out of the chain above it by label, so a rank missing from the chain leaves its
// column empty and every rank that is present still lands in its own column.
const RANK_WALK = `
            OPTIONAL MATCH (idTaxon)-[:BELONGS_TO]->(t1)
            OPTIONAL MATCH (t1)-[:BELONGS_TO]->(t2)
            OPTIONAL MATCH (t2)-[:BELONGS_TO]->(t3)
            OPTIONAL MATCH (t3)-[:BELONGS_TO]->(t4)
            OPTIONAL MATCH (t4)-[:BELONGS_TO]->(t5)
            WITH p, r, s, d, p1, p2,
                 [x IN [idTaxon, t1, t2, t3, t4, t5] WHERE x IS NOT NULL] AS chain
            WITH p, r, s, d, p1, p2,
                 head([x IN chain WHERE x:Species]) AS n,
                 head([x IN chain WHERE x:Genus]) AS g,
                 head([x IN chain WHERE x:Family]) AS f,
                 head([x IN chain WHERE x:Order]) AS o,
                 head([x IN chain WHERE x:TaxClass]) AS c`;

function lastDayOfMonth(year, month) {
    return new Date(year, month, 0).getDate();
}


// function to translate query object to cypher code

const query_to_cypher = ({       
            species, genus, family, order, tax_class, 
            maxLat, minLat, maxLon, minLon, 
            states, counties, datasets, dataTypes,
            fromMonth, toMonth, fromDay, toDay, fromYear, toYear,
            locHier, taxHier, covars
        }) => {

    // whether the search constrains the county/state hierarchy at all
    const hasLocationFilter = states.length !== 0 || counties.length !== 0;

    // A site on open water sits in no county and no state, because county boundaries stop
    // at the shoreline and a point in the middle of a lake lies between states rather than
    // inside one. The database records those sites against their Country instead, so the
    // county and state come back empty for them and reach the user as NA.
    //
    // When the search filters on state or county, the county chain is required: such a site
    // has no state and so cannot satisfy those filters anyway, and requiring it lets neo4j
    // seek from the State index rather than scan every observation.
    // States and counties are OR'd. Naming Iowa together with a county of Iowa is not a
    // contradiction to be arbitrated: Adair sits inside Iowa, so the union is simply Iowa.
    // Only the lists the user filled are tested; an empty one written as name IN [''] matches
    // the empty string, and the OR that results stops the planner seeking on the other.
    const placePredicates = [
        states.length !== 0 ? `p2.name IN ['${states.join("','")}']` : null,
        counties.length !== 0 ? `p1.name IN ['${counties.join("','")}']` : null,
    ].filter(Boolean).join(" OR ");

    // The chosen places are found first. There are 3,142 counties and 51 states, so reaching
    // the observations from them costs one pass over a handful of nodes. Reaching the places
    // from the observations costs a pass over twenty million.
    const locationMatch = hasLocationFilter
        ? `MATCH (p1:County)-[:IN_STATE]->(p2:State)
            WHERE ${placePredicates}
            WITH DISTINCT p1, p2
            MATCH (p1)<-[:IN_COUNTY]-(s:Site)<-[:OBSERVED_IN]-(p:Observation)-[:FROM_DATASET]->(d:Dataset)`
        : `MATCH (s:Site)<-[i:OBSERVED_IN]-(p:Observation)-[z:FROM_DATASET]->(d:Dataset)
            OPTIONAL MATCH (s)-[s1:IN_COUNTY]->(p1:County)-[s2:IN_STATE]->(p2:State)`;

    // The taxonomic filter is applied first, for the same reason the spatial one is.
    //
    // Selecting a class and testing for it in the WHERE means expanding all twenty million
    // observations across the taxonomy and discarding almost all of them at the end, which
    // exhausts the transaction memory. Anchoring on the chosen taxa instead starts from a
    // handful of nodes and reaches only the observations that hang below them.
    //
    // The anchor covers the taxon itself and everything under it, so choosing a class finds
    // records identified at any rank within it. That matters because an identification stops
    // wherever the identifier stopped: every observation of class Bivalvia is recorded against
    // a genus, so a search that only recognised species would find none of them.
    const taxonRanks = [
        ["Species", species], ["Genus", genus], ["Family", family],
        ["Order", order], ["TaxClass", tax_class],
    ].filter(([, chosen]) => chosen.length !== 0);

    const hasTaxonFilter = taxonRanks.length !== 0;

    // Where a taxonomic search starts.
    //
    // The taxa under a chosen rank are always few - a few thousand at most, even for a whole
    // class - so a taxon-only search starts there and follows OBSERVED_ORGANISM out to the
    // observations that carry one of them. Walking out from 3,707 fish taxa to every
    // observation in Washington State took 2 seconds this way.
    //
    // That only holds when no place narrows the search first. A coarse rank can reach far more
    // than a taxon count suggests: class Aves is 1,778 taxa but 13 million observations, more
    // than the whole state of Washington holds. A search naming a common class together with a
    // place is faster starting from the place - always bounded at 3,142 counties and 51 states
    // - and testing the rank columns RANK_WALK already resolves, rather than walking the
    // taxon's full nationwide reach before the place ever narrows it.
    const anchorPredicates = taxonRanks
        .map(([label, chosen]) =>
            `(anchorTaxon:${label} AND anchorTaxon.name IN ['${chosen.join("','")}'])`)
        .join(NEWLINE_OR);

    const taxonAnchor = hasTaxonFilter
        ? `MATCH (anchorTaxon)
            WHERE ${anchorPredicates}
            MATCH (anchorTaxon)<-[:BELONGS_TO*0..5]-(idTaxon)
            WITH DISTINCT idTaxon
            MATCH (idTaxon)<-[r:OBSERVED_ORGANISM]-(p:Observation)-[z:FROM_DATASET]->(d:Dataset)
            OPTIONAL MATCH (p)-[:OBSERVED_IN]->(s:Site)-[:IN_COUNTY]->(p1:County)-[:IN_STATE]->(p2:State)
            ${RANK_WALK}`
        : '';

    // An observation is a sampling event and carries every taxon recorded at it. A search with
    // no taxonomic criteria wants all of them, so each is expanded here; the anchored path
    // above already holds the one taxon that matched and does not use this.
    const organismMatch = `
            MATCH (p)-[r:OBSERVED_ORGANISM]->(idTaxon)`;

    // Tested against the rank columns RANK_WALK builds, once it has resolved them. RANK_WALK
    // already runs to fill those columns for the CSV, so this adds no further traversal - just
    // a property comparison on the columns that are already there. Folded into the predicates
    // list below rather than appended here directly, since matchString may already end with a
    // location-anchored WHERE and a second one back to back would not parse.
    const taxonRankFilter = hasTaxonFilter
        ? `(${taxonRanks
              .map(([label, chosen]) => {
                  const column = { Species: "n", Genus: "g", Family: "f",
                                    Order: "o", TaxClass: "c" }[label];
                  return `${column}.name IN ['${chosen.join("','")}']`;
              })
              .join(NEWLINE_OR)})`
        : '';

    // Anchoring on the taxon already restricts the match to the chosen taxa, so nothing more
    // is needed there. Anchoring on the place still needs the rank filter tested.
    const usingTaxonAnchor = hasTaxonFilter && !hasLocationFilter;

    let matchString = `
        ${usingTaxonAnchor
            ? taxonAnchor
            : locationMatch + organismMatch + RANK_WALK}
    `;

    /*"MATCH (p:Observation)-[i:OBSERVED_IN]->(s:Site)-[s1:IN_COUNTY]->(p1:County)-[s2:IN_STATE]->(p2:State), 
    (p)-[z:FROM_DATASET]->(d:Dataset) OPTIONAL MATCH (c:TaxClass)<-[b4:BELONGS_TO]-(o:Order)<-[b3:BELONGS_TO]-(f:Family)
    <-[b2:BELONGS_TO]-(g:Genus)<-[b1:BELONGS_TO]-(n:Species)<-[r:OBSERVED_ORGANISM]-(p)"*/

    // concatenate dates
    let fromDate = undefined;
    let toDate = undefined;

    // A year on its own is a complete request: "from 2000 to 2010" means the whole of both
    // years. The open end of each bound is filled in - the start of the period for "from",
    // the end of it for "to".
    if (fromYear !== "") {
        fromDate = [fromYear,
                    fromMonth !== "" ? fromMonth : "01",
                    fromDay !== "" ? String(fromDay).padStart(2, "0") : "01"].join("-");
    }

    if (toYear !== "") {
        const month = toMonth !== "" ? toMonth : "12";
        const day = toDay !== "" ? String(toDay).padStart(2, "0")
                                 : String(lastDayOfMonth(Number(toYear), Number(month))).padStart(2, "0");
        toDate = [toYear, month, day].join("-");
    }

    // query by date
    let dateString = '';

    if (fromDate !== undefined || toDate !== undefined) {
        
        // all data after fromDate
        if (fromDate !== undefined && toDate === undefined) {
            dateString = 
            `
                (
                datesFormatted >= date("${fromDate}")
                )
            `;
        }

        // all data before toDate
        if (toDate !== undefined && fromDate === undefined) {
            dateString = 
            `
                (
                datesFormatted <= date("${toDate}")
                )
            `;
        }

        // all data between fromDate and toDate
        if (fromDate !== undefined && toDate !== undefined) {
            dateString = 
            `
                (
                datesFormatted >= date("${fromDate}")
                AND datesFormatted <= date("${toDate}")
                )
            `;
        }

    }

    // The date is split into its parts so it can be compared as a date. The WHERE itself is
    // added once every filter is known, because a search may have no predicates left to test.
    if (dateString !== '') {
        matchString = matchString + 
            `            
                UNWIND toString(p.date) AS dates 
                WITH *, [item in split(dates, "-") | toInteger(item)] AS dateComponents
                WITH *, date({day: dateComponents[2], month: dateComponents[1], year: dateComponents[0]}) AS datesFormatted
            `;        
    }

    // handle location search
    let locationString = '';

    // Places and taxa are both settled in the match above.


    // handle coordinate range
    let coordString = '';

    if (minLat !== '' || maxLat !== '' || minLon !== '' || maxLon !== '') {
            coordString = 
            `
                (
                toFloat(s.longitude_dd) >= ${minLon === '' ? -180 : minLon} 
                AND toFloat(s.longitude_dd) <= ${maxLon === '' ? 180 : maxLon} 
                AND toFloat(s.latitude_dd) >= ${minLat === '' ? -90 : minLat} 
                AND toFloat(s.latitude_dd) <= ${maxLat === '' ? 90 : maxLat}
                )
            `;

    }


    // Handle taxonomic search.
    //
    // Every named taxon is included, whatever rank it sits at, and the ranks are OR'd. That
    // is the union of the groups the user named, which is the only reading that makes sense
    // across taxa: nothing is both Aves and Micropterus, so there is no intersection to
    // offer. Naming a taxon and something inside it is not a contradiction either - the
    // union of a group and its subset is the group - so no rule is needed to arbitrate it.
    //
    // This is why `taxHier` is gone. It existed because five independent rank dropdowns
    // could express combinations with no meaning, and it resolved them by discarding the
    // coarser selections. That made it impossible to search a class, a genus and a species
    // together, which is precisely what the chip search is for.
    let taxString =
    `
        (
        n.name IN ['${species.join("','")}']
        OR g.name IN ['${genus.join("','")}']
        OR f.name IN ['${family.join("','")}']
        OR o.name IN ['${order.join("','")}']
        OR c.name IN ['${tax_class.join("','")}']
        )
    `;

    
    // When the taxon anchor was used, it already restricted the match to the chosen taxa and
    // everything under them, and needs no further test. When the place was the anchor instead,
    // the rank filter built above is what does that job, tested against the columns RANK_WALK
    // resolved rather than against the coalesced names a variable-length path would produce.
    taxString = usingTaxonAnchor ? '' : taxonRankFilter;

    // handle dataset search
    let datasetString = '';

    if (datasets.length !== 0) {
        datasetString =
        `
            (
                d.name IN ['${datasets.join("','")}'] 
            )
        `;
    }

    // handle data type search
    let dataTypeString = '';

    if (dataTypes.length !== 0) {
        dataTypeString =
        `
            (
                r.measurement_type IN ['${dataTypes.join("','")}'] 
            )
        `;
    }

    // Every predicate that survived, joined into one WHERE. A search may have none: anchoring
    // on a taxon needs no test here, and a query with no filters at all asks for the whole
    // graph and is not sent.
    const predicates = [taxString, locationString, coordString, dateString, datasetString, dataTypeString]
        .map((part) => part.trim())
        .filter((part) => part !== '');

    const cypherString = hasTaxonFilter || hasLocationFilter || predicates.length !== 0
        ? matchString + (predicates.length !== 0 ? ' WHERE ' + predicates.join(' AND ') : '')
        : '';

    // covariate fields to fold into the csv projection's map literal
    const covarMapString = covars.map((item) => `, ${item}: p.${item}`).join("");

    // derive the three output shapes (csv: flat observation rows, map: leaflet marker rows,
    // meta: dataset metadata) from the same matched rows via one aggregating WITH. The graph
    // view is built from the csv rows, which already name every rank and the dataset, so its
    // node counts agree with the table and nothing extra is asked of the database.
    const cypherQuery = cypherString !== '' ? cypherString + `
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
                sampling_effort_unit: r.sampling_effort_unit${covarMapString}
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
                datasetName: d.name, citations: d.dataset_citations, urls: d.dataset_urls, downloadDate: d.download_date, notes: d.additional_notes
            }) AS meta
        RETURN csv, map, meta
    ` : '';

    return {cypherQuery};


};




export {query_to_cypher};
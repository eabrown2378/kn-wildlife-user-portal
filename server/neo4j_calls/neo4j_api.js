let neo4j = require('neo4j-driver');
let { creds } = require("../config/credentials");
let driver = neo4j.driver("bolt://localhost:7687", neo4j.auth.basic(creds.neo4jusername, creds.neo4jpw));

// run a single read-only query on its own session, always closing the session afterward
const run_read_query = async (cypher) => {
    const session = driver.session({ defaultAccessMode: neo4j.session.READ });

    try {
        return await session.run(cypher, {});
    } finally {
        await session.close();
    }
};

exports.get_neo4j = async function (cypherQuery) {

    if (!cypherQuery) return null;

    try {
        // the query derives vis/csv/map/meta from the same matched rows via collect()
        const result = await run_read_query(cypherQuery);

        const record = result.records[0];

        if (!record) return null;

        return {
            vis: record.get('vis'),
            csv: record.get('csv'),
            map: record.get('map'),
            meta: record.get('meta')
        };

    } catch(error) {

        console.error('Error fetching neo4j data:', error);

        // rethrow so the route can report the failure: swallowing it here made a query that
        // errored (most often the transaction memory limit on a large result) look to the
        // client exactly like a search that legitimately matched nothing
        throw error;

    };

};


// search options (taxonomy/location/dataset/covariate dropdown values) only change when new
// data is ingested into neo4j, so the computed result is cached for a bounded time
const SEARCH_OPTIONS_TTL_MS = 30 * 60 * 1000; // 30 minutes
let searchOptionsCache = null;
let searchOptionsCacheExpiresAt = 0;

exports.get_search_options = async function () {

    if (searchOptionsCache && Date.now() < searchOptionsCacheExpiresAt) {
        return searchOptionsCache;
    }

    try {

        // these four queries are independent of one another, so run them concurrently,
        // each on its own session
        const [taxOptions, locOptions, datasetOptions, covarOptions, yearRange] = await Promise.all([

            // TAXONOMIC SEARCH OPTIONS
            // retrieve search options (unique values of properties) and send to client
            run_read_query(`
                MATCH (n:Observation)
                OPTIONAL MATCH (n)-[:FROM_DATASET]->(d:Dataset)
                OPTIONAL MATCH (n)-[:OBSERVED_ORGANISM]->(s:Species)
                OPTIONAL MATCH (n)-[:OBSERVED_ORGANISM]->(g1:Genus)
                OPTIONAL MATCH (s)-[:BELONGS_TO]->(g2:Genus)
                WITH n, s, d, coalesce(g1, g2) AS g
                OPTIONAL MATCH (g)-[:BELONGS_TO]->(f:Family)
                OPTIONAL MATCH (f)-[:BELONGS_TO]->(o:Order)
                OPTIONAL MATCH (o)-[:BELONGS_TO]->(c:TaxClass)
                OPTIONAL MATCH (c)-[:BELONGS_TO]->(p:Phylum)
                OPTIONAL MATCH (p)-[:BELONGS_TO]->(k:Kingdom)
                RETURN DISTINCT
                    s.name AS species,
                    g.name AS genus,
                    f.name AS family,
                    o.name AS order,
                    c.name AS tax_class,
                    p.name AS phylum,
                    k.name AS kingdom,
                    d.name AS dataset
                `),

            // LOCATION SEARCH OPTIONS
            //
            // Distinct county/state/dataset combinations only. Sites are not searchable: an
            // iNaturalist site is the coordinate a sighting was reported at, so there are
            // very nearly as many sites as observations, and listing them produced a
            // hundred-megabyte payload on every page load for a dropdown no one could use.
            run_read_query(`
                MATCH (d:Dataset)<-[:FROM_DATASET]-(n:Observation)-[:OBSERVED_IN]->(l:Site)-[:IN_COUNTY]->(l2:County)-[:IN_STATE]->(l3:State)
                RETURN DISTINCT l2.name AS county, l3.name AS state, d.name AS dataset
            `),

            run_read_query(`
                MATCH (d:Dataset) RETURN DISTINCT d.name AS uniqueValues
            `),

            // Covariates come from the Covariate nodes the build writes from
            // data/covariates/covariate_registry.json, so the portal offers a covariate
            // because it is declared rather than because it sits on whichever node was
            // sampled.
            run_read_query(`
                MATCH (c:Covariate)
                OPTIONAL MATCH (c)-[:SOURCED_FROM]->(s:CovariateSource)
                RETURN c.key AS key, c.label AS label, c.short_label AS shortLabel,
                       c.group AS group, c.units AS units, c.node AS node,
                       c.description AS description, c.temporal_scope AS temporalScope,
                       c.bioclim_equivalent AS bioclimEquivalent,
                       s.name AS source, s.source_key AS sourceKey,
                       s.citation AS citation, s.licence AS licence,
                       s.urls AS sourceUrls,
                       s.disclaimer AS disclaimer, s.usage_caution AS usageCaution
                ORDER BY c.group, c.label
            `),

            // The span the time slider covers, read from the data so every year holding
            // observations can be selected.
            run_read_query(`
                MATCH (o:Observation) WHERE o.date IS NOT NULL
                RETURN min(o.date.year) AS minYear, max(o.date.year) AS maxYear
            `)

        ]);

        // one pass over each records array builds every distinct-value set/list and the
        // corresponding map entry together, rather than re-scanning the same records once per
        // dropdown plus once more for taxMap/locMap

        const speciesSet = new Set();
        const genusSet = new Set();
        const familySet = new Set();
        const orderSet = new Set();
        const classSet = new Set();
        const taxMap = [];

        for (const record of taxOptions.records) {

            const species = record.get('species');
            const genus = record.get('genus');
            const family = record.get('family');
            const order = record.get('order');
            const tax_class = record.get('tax_class');
            const phylum = record.get('phylum');
            const kingdom = record.get('kingdom');
            const dataset = record.get('dataset');

            if (species !== null) speciesSet.add(species);
            if (genus !== null) genusSet.add(genus);
            if (family !== null) familySet.add(family);
            if (order !== null) orderSet.add(order);
            if (tax_class !== null) classSet.add(tax_class);

            taxMap.push({
                species: species || null,
                genus: genus || null,
                family: family || null,
                order: order || null,
                tax_class: tax_class || null,
                phylum: phylum || null,
                kingdom: kingdom || null,
                dataset: dataset || null
            });

        }

        const stateSet = new Set();
        const countySet = new Set();
        const locMap = [];

        for (const record of locOptions.records) {

            const state = record.get('state');
            const county = record.get('county');
            const dataset = record.get('dataset');

            if (state !== null) stateSet.add(state);
            if (county !== null) countySet.add(county);

            locMap.push({
                state: state || null,
                county: county || null,
                dataset: dataset || null
            });

        }

        const search_options = {
            speciesOptions: [...speciesSet].sort(),
            genusOptions: [...genusSet].sort(),
            familyOptions: [...familySet].sort(),
            orderOptions: [...orderSet].sort(),
            classOptions: [...classSet].sort(),
            stateOptions: [...stateSet].sort(),
            countyOptions: [...countySet].sort(),
            datasetOptions: datasetOptions.records.map((record) => record.get("uniqueValues")).filter((value) => value !== null).sort(),
            // Each covariate carries the label, units and credit the portal needs, so a
            // download can attribute its source without a second lookup.
            covarOptions: covarOptions.records.map((record) => ({
                key: record.get("key"),
                label: record.get("label") || record.get("key"),
                // what the dropdown shows; the precise label goes in the metadata window
                shortLabel: record.get("shortLabel") || record.get("label") || record.get("key"),
                group: record.get("group") || null,
                temporalScope: record.get("temporalScope") || null,
                bioclimEquivalent: record.get("bioclimEquivalent") || null,
                sourceUrls: record.get("sourceUrls") || null,
                units: record.get("units") || null,
                node: record.get("node") || null,
                description: record.get("description") || null,
                source: record.get("source") || null,
                // the short key disclaimers.json entries are named by
                sourceKey: record.get("sourceKey") || null,
                citation: record.get("citation") || null,
                licence: record.get("licence") || null,
                disclaimer: record.get("disclaimer") || null,
                usageCaution: record.get("usageCaution") || null
            })),
            yearRange: (() => {
                const record = yearRange.records[0];
                const lo = record && record.get("minYear");
                const hi = record && record.get("maxYear");
                // neo4j returns integers as objects with a toNumber(); a graph with no dated
                // observation returns null, and the client falls back to its own bounds
                const toInt = (v) => (v && typeof v.toNumber === "function" ? v.toNumber()
                                     : (typeof v === "number" ? v : null));
                return { min: toInt(lo), max: toInt(hi) };
            })(),
            taxMap,
            locMap
        };

        //console.log(search_options);

        searchOptionsCache = search_options;
        searchOptionsCacheExpiresAt = Date.now() + SEARCH_OPTIONS_TTL_MS;

        return search_options;

    } catch(error) {

        console.error('Error fetching search options from neo4j:', error);

    };
  }


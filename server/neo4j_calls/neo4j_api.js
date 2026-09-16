let neo4j = require('neo4j-driver');
const { normaliseFilters, FilterError } = require('./query_filters');
const { planQuery, SearchTooLargeError, LARGE_SEARCH_OBSERVATIONS }
    = require('./query_planner');
const { buildCypher } = require('./build_cypher');
const graphStats = require('./graph_stats');

// Where the graph is, and who connects to it.
//
// The environment wins so the database can move without a code change. A cloud host needs a
// TLS scheme in the URI, as in neo4j+s://<id>.databases.neo4j.io, which is how the driver is
// told to encrypt the connection.
//
// config/credentials.js is the fallback for a development machine that keeps the password on
// disk. It must be CommonJS exporting a named `creds`, because it is loaded with require. It
// is loaded defensively: it is git-ignored, so it does not exist on a host that supplies the
// details through the environment.
function connectionSettings() {
    let file = {};
    try {
        file = require("../config/credentials").creds || {};
    } catch (error) {
        // No credentials file. Expected wherever the environment carries the details.
    }
    return {
        uri: process.env.NEO4J_URI || "bolt://localhost:7687",
        user: process.env.NEO4J_USER || file.neo4jusername,
        password: process.env.NEO4J_PASSWORD || file.neo4jpw,
    };
}

const settings = connectionSettings();
if (!settings.user || !settings.password) {
    throw new Error(
        "No Neo4j credentials. Set NEO4J_USER and NEO4J_PASSWORD, or provide " +
        "server/config/credentials.js exporting { creds: { neo4jusername, neo4jpw } }.");
}

/**
 * The largest search the server will assemble, in estimated observations.
 *
 * The whole result is held in the heap and then serialised to JSON, so a result large enough
 * exhausts the process and takes every other request in flight down with it. Refusing on the
 * estimate costs nothing and happens before the database is touched.
 *
 * This only bites once the pipeline's graph-stats stage has written the counts. Without them
 * the planner has no estimate and every search runs, which is the behaviour to expect on a
 * graph that has not had the stage run against it.
 */
const MAX_SEARCH_OBSERVATIONS = Number(process.env.KN_MAX_SEARCH_OBSERVATIONS)
    || LARGE_SEARCH_OBSERVATIONS;

let driver = neo4j.driver(settings.uri, neo4j.auth.basic(settings.user, settings.password));
console.log(`Neo4j at ${settings.uri} as ${settings.user}.`);

// run a single read-only query on its own session, always closing the session afterward.
//
// Values travel as parameters, so a name containing a quote is data and cannot alter the
// query, and the database reuses one compiled plan across every search of the same shape.
const run_read_query = async (cypher, parameters = {}) => {
    const session = driver.session({ defaultAccessMode: neo4j.session.READ });

    try {
        return await session.run(cypher, parameters);
    } finally {
        await session.close();
    }
};

/**
 * Run a search described by its filters.
 *
 * The client sends what the user chose. The server decides how to ask for it: the planner
 * weighs each filter against the cached observation counts and names the one to anchor on, the
 * builder turns that into parameterised Cypher, and the result comes back in the same three
 * shapes as before. Every anchor returns the same rows, so the choice only affects speed.
 *
 * A search the statistics show to be empty is answered without touching the database.
 */
exports.run_search = async function (body) {

    const covariateKeys = await allowedCovariateKeys();

    // Throws FilterError, which the route reports to the user, for a request that cannot be
    // honoured.
    const filters = normaliseFilters(body, covariateKeys);

    if (!filters.hasAnyFilter) {
        throw new FilterError('Choose at least one filter before searching.');
    }

    const stats = await graphStats.getGraphStats(run_read_query);
    const plan = planQuery(filters, stats, { largeThreshold: MAX_SEARCH_OBSERVATIONS });

    // Refused before the database is asked. The estimate is a floor on the result, because an
    // observation carries one row per taxon recorded at it, so a search over the limit is at
    // least this large and usually larger.
    if (plan.large && plan.usedStatistics) {
        throw new SearchTooLargeError(
            `This search covers about ${plan.estimatedObservations.toLocaleString()} `
            + 'observations, which is more than the portal can assemble at once. Please narrow '
            + 'it with additional filters, for example a state, a date range, or a smaller '
            + 'taxonomic group.',
            plan.estimatedObservations);
    }

    if (plan.definitelyEmpty) {
        return {
            result: { csv: [], map: [], meta: [] },
            plan: describePlan(plan),
        };
    }

    const { query, parameters } = buildCypher(filters, plan.anchor);

    const started = Date.now();
    const outcome = await run_read_query(query, parameters);
    const elapsedMs = Date.now() - started;

    const record = outcome.records[0];

    const result = record
        ? { csv: record.get('csv'), map: record.get('map'), meta: record.get('meta') }
        : { csv: [], map: [], meta: [] };

    // The plan is logged with what it actually cost, so a bad estimate is visible in the log
    // and can be checked against the counts the pipeline wrote.
    console.log(`search anchored on ${plan.anchor} in ${elapsedMs}ms, `
        + `${result.csv.length} row(s). ${plan.reason}`);

    return { result, plan: { ...describePlan(plan), elapsedMs } };
};

/** What the client is told about how its search was run. */
function describePlan(plan) {
    return {
        anchor: plan.anchor,
        estimatedObservations: plan.estimatedObservations,
        large: plan.large,
        usedStatistics: plan.usedStatistics,
        emptyReason: plan.emptyReason,
    };
}

/**
 * The covariate keys the graph declares, used to check the columns a search asks for.
 *
 * A covariate key names a property in the projection, which cannot travel as a parameter, so
 * it is matched against this set. The set comes from the same search options the panel was
 * built from, so any key the panel can offer is accepted.
 */
async function allowedCovariateKeys() {
    try {
        const options = await exports.get_search_options();
        const declared = (options && options.covarOptions) || [];
        return new Set(declared.map((covariate) => covariate.key).filter(Boolean));
    } catch (error) {
        console.error('Could not read the declared covariates; no covariate column will be '
            + 'added to this search:', error.message);
        return new Set();
    }
}

/** Diagnostics for the statistics cache, surfaced by the route of the same name. */
exports.graph_stats_status = function () {
    return graphStats.describeGraphStats();
};

/** Drops the cached statistics so the next search re-reads them after a pipeline run. */
exports.refresh_graph_stats = function () {
    graphStats.clearGraphStats();
};

// Search options are the taxonomy, location, dataset and covariate values the search panel
// offers. They come from the IN_DATASET links and the dataset year bounds the build writes, so
// deriving them reads a few thousand nodes and takes a couple of seconds.
//
// They are held in memory for the life of the process, and a single in-flight promise is
// shared, so several tabs opening at once start one derivation between them.
let searchOptionsCache = null;
let searchOptionsInFlight = null;

exports.get_search_options = async function () {

    if (searchOptionsCache) return searchOptionsCache;

    if (searchOptionsInFlight) return searchOptionsInFlight;

    searchOptionsInFlight = deriveSearchOptions()
        .finally(() => { searchOptionsInFlight = null; });

    return searchOptionsInFlight;
};

async function deriveSearchOptions() {

    try {

        // these four queries are independent of one another, so run them concurrently,
        // each on its own session
        const [taxOptions, locOptions, datasetOptions, covarOptions, yearRange] = await Promise.all([

            // TAXONOMIC SEARCH OPTIONS
            //
            // Read from the IN_DATASET links the build writes, which say which datasets a taxon
            // appears in. Deriving the same answer from the observations reads the whole graph
            // and takes minutes; there are about twenty thousand links and this takes seconds.
            //
            // The links are written by the pipeline's link-dataset-scope stage. A graph that
            // has had data loaded without that stage being re-run offers the old scope here.
            run_read_query(`
                MATCH (t)-[:IN_DATASET]->(d:Dataset)
                WHERE t:Species OR t:Genus OR t:Family OR t:Order OR t:TaxClass
                OPTIONAL MATCH (t)-[:BELONGS_TO]->(r1)
                OPTIONAL MATCH (r1)-[:BELONGS_TO]->(r2)
                OPTIONAL MATCH (r2)-[:BELONGS_TO]->(r3)
                OPTIONAL MATCH (r3)-[:BELONGS_TO]->(r4)
                OPTIONAL MATCH (r4)-[:BELONGS_TO]->(r5)
                OPTIONAL MATCH (r5)-[:BELONGS_TO]->(r6)
                WITH d, [x IN [t, r1, r2, r3, r4, r5, r6] WHERE x IS NOT NULL] AS chain
                RETURN DISTINCT
                    head([x IN chain WHERE x:Species | x.name]) AS species,
                    head([x IN chain WHERE x:Genus | x.name]) AS genus,
                    head([x IN chain WHERE x:Family | x.name]) AS family,
                    head([x IN chain WHERE x:Order | x.name]) AS \`order\`,
                    head([x IN chain WHERE x:TaxClass | x.name]) AS tax_class,
                    head([x IN chain WHERE x:Phylum | x.name]) AS phylum,
                    head([x IN chain WHERE x:Kingdom | x.name]) AS kingdom,
                    d.name AS dataset
                `),

            // LOCATION SEARCH OPTIONS
            //
            // Also read from the IN_DATASET links. Sites are not searchable: an iNaturalist
            // site is the coordinate a sighting was reported at, so there are very nearly as
            // many sites as observations, and listing them produced a hundred-megabyte payload
            // on every page load for a dropdown no one could use.
            run_read_query(`
                MATCH (c:County)-[:IN_DATASET]->(d:Dataset)
                MATCH (c)-[:IN_STATE]->(st:State)
                RETURN DISTINCT c.name AS county, st.name AS state, d.name AS dataset
            `),

            // Datasets carry the credit and provenance the portal has to show alongside them:
            // who produced the data, when it was retrieved, how to cite it and what the
            // provider asks of anyone using it. Read here so the "about the data" window and
            // the download attribution come from the graph, which is where the download
            // date each citation quotes is recorded.
            run_read_query(`
                MATCH (d:Dataset)
                RETURN d.name AS name,
                       d.program_name AS program,
                       d.agency_organization_researchGroup AS agency,
                       d.data_type AS dataTypes,
                       toString(d.download_date) AS downloadDate,
                       d.retrieved_via AS retrievedVia,
                       d.dataset_citations AS citations,
                       d.dataset_urls AS urls,
                       d.additional_notes AS notes
                ORDER BY d.name
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

            // The span the time slider covers. Each dataset carries the years it holds,
            // written by the same build stage, so this reads six nodes.
            run_read_query(`
                MATCH (d:Dataset) WHERE d.min_year IS NOT NULL
                RETURN min(d.min_year) AS minYear, max(d.max_year) AS maxYear
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
            datasetOptions: datasetOptions.records
                .map((record) => ({
                    name: record.get("name"),
                    program: record.get("program") || null,
                    agency: record.get("agency") || null,
                    dataTypes: record.get("dataTypes") || null,
                    downloadDate: record.get("downloadDate") || null,
                    retrievedVia: record.get("retrievedVia") || null,
                    citations: record.get("citations") || null,
                    urls: record.get("urls") || null,
                    notes: record.get("notes") || null
                }))
                .filter((dataset) => dataset.name),
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

        return search_options;

    } catch(error) {

        console.error('Error fetching search options from neo4j:', error);

    };
  }


/**
 * Cached statistics describing how much data sits behind each searchable value.
 *
 * The portal's search panel offers names. Which of those names is cheap to search and which
 * reaches most of the graph is invisible from the name alone: class Aves is 1,778 taxa and
 * 13 million observations, while class Bivalvia is a comparable number of taxa and a few
 * thousand observations. `query_planner.js` needs those weights to decide which filter to
 * anchor a query on, so they are read once and held for the life of the process.
 *
 * The counts are written onto the nodes by the pipeline's `graph-stats` stage, which rolls
 * observation counts up the taxonomy and across the geography. Reading them here is a pass
 * over roughly twenty-five thousand small nodes and takes a couple of seconds.
 *
 * A graph whose `graph-stats` stage has never run carries no counts. That is a supported
 * state: `available` comes back false, and the planner falls back to its structural rule.
 * Every estimate here only ever decides which of several correct queries to run, so a stale
 * or missing count costs speed and never changes which rows come back.
 */

/** Rank labels a taxonomic filter can name, in the order the search panel presents them. */
const TAXON_LABELS = ['Species', 'Genus', 'Family', 'Order', 'TaxClass',
    'Phylum', 'Kingdom'];

/**
 * Counts are stored per rank because a taxon name is only unique within its rank. Genus names
 * are unique within a nomenclature code and not across them, so Arenaria names both a bird
 * genus and a plant genus, and a single name-to-count map would merge the two.
 */
const READ_TAXON_COUNTS = `
    MATCH (t)
    WHERE (t:Species OR t:Genus OR t:Family OR t:Order OR t:TaxClass
           OR t:Phylum OR t:Kingdom)
      AND t.observation_count IS NOT NULL
    RETURN [l IN labels(t) WHERE l IN $labels][0] AS rank,
           t.name AS name,
           t.observation_count AS count
`;

const READ_PLACE_COUNTS = `
    MATCH (c:County) WHERE c.observation_count IS NOT NULL
    RETURN 'county' AS kind, c.name AS name, c.observation_count AS count
    UNION ALL
    MATCH (s:State) WHERE s.observation_count IS NOT NULL
    RETURN 'state' AS kind, s.name AS name, s.observation_count AS count
    UNION ALL
    MATCH (d:Dataset) WHERE d.observation_count IS NOT NULL
    RETURN 'dataset' AS kind, d.name AS name, d.observation_count AS count
`;

/**
 * The graph's own size, used as the denominator for selectivity and as the estimate for a
 * search that names nothing the statistics cover.
 *
 * This is read from the Dataset nodes, which is six nodes, and never by counting observations.
 */
const READ_TOTALS = `
    MATCH (d:Dataset)
    RETURN sum(d.observation_count) AS observations,
           count(d) AS datasets,
           max(d.stats_generated_at) AS generatedAt
`;

/** neo4j returns integers as objects carrying toNumber(); everything else passes through. */
function toNumber(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return value;
    if (typeof value.toNumber === 'function') return value.toNumber();
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

/** An empty statistics set. The planner treats this as "decide structurally". */
function unavailable(reason) {
    return {
        available: false,
        reason,
        totalObservations: null,
        generatedAt: null,
        taxon: Object.fromEntries(TAXON_LABELS.map((label) => [label, new Map()])),
        county: new Map(),
        state: new Map(),
        dataset: new Map(),
    };
}

let statsCache = null;
let statsInFlight = null;

/**
 * The cached statistics, derived on first use.
 *
 * A single in-flight promise is shared, so several requests arriving together start one
 * derivation between them. A derivation that fails resolves to an unavailable set and is not
 * cached, so the next request tries again; a portal that cannot read the counts still answers
 * every search, using the planner's structural fallback.
 */
async function getGraphStats(runQuery) {
    if (statsCache) return statsCache;
    if (statsInFlight) return statsInFlight;

    statsInFlight = deriveGraphStats(runQuery)
        .then((stats) => {
            if (stats.available) statsCache = stats;
            return stats;
        })
        .finally(() => { statsInFlight = null; });

    return statsInFlight;
}

async function deriveGraphStats(runQuery) {
    try {
        const [taxonResult, placeResult, totalsResult] = await Promise.all([
            runQuery(READ_TAXON_COUNTS, { labels: TAXON_LABELS }),
            runQuery(READ_PLACE_COUNTS, {}),
            runQuery(READ_TOTALS, {}),
        ]);

        const taxon = Object.fromEntries(TAXON_LABELS.map((label) => [label, new Map()]));

        for (const record of taxonResult.records) {
            const rank = record.get('rank');
            const name = record.get('name');
            const count = toNumber(record.get('count'));
            if (!rank || !name || count === null) continue;
            if (taxon[rank]) taxon[rank].set(name, count);
        }

        const county = new Map();
        const state = new Map();
        const dataset = new Map();
        const byKind = { county, state, dataset };

        for (const record of placeResult.records) {
            const kind = record.get('kind');
            const name = record.get('name');
            const count = toNumber(record.get('count'));
            if (!name || count === null || !byKind[kind]) continue;
            byKind[kind].set(name, count);
        }

        const totals = totalsResult.records[0];
        const totalObservations = totals ? toNumber(totals.get('observations')) : null;
        const generatedAt = totals ? totals.get('generatedAt') : null;

        const counted = TAXON_LABELS.reduce((sum, label) => sum + taxon[label].size, 0)
            + county.size + state.size + dataset.size;

        if (counted === 0 || !totalObservations) {
            return unavailable('The graph carries no observation_count properties. '
                + 'Run the pipeline\'s graph-stats stage to write them.');
        }

        return {
            available: true,
            reason: null,
            totalObservations,
            generatedAt: generatedAt ? String(generatedAt) : null,
            taxon,
            county,
            state,
            dataset,
        };

    } catch (error) {
        console.error('Could not read graph statistics; the planner will decide '
            + 'structurally:', error.message);
        return unavailable(`Reading the counts failed: ${error.message}`);
    }
}

/** Drops the cache so the next request re-reads the counts. Used after a pipeline run. */
function clearGraphStats() {
    statsCache = null;
}

/** What the cache currently holds, for the diagnostics endpoint. Never includes the maps. */
function describeGraphStats() {
    if (!statsCache) return { loaded: false };
    return {
        loaded: true,
        available: statsCache.available,
        totalObservations: statsCache.totalObservations,
        generatedAt: statsCache.generatedAt,
        counts: {
            ...Object.fromEntries(TAXON_LABELS.map((l) => [l, statsCache.taxon[l].size])),
            county: statsCache.county.size,
            state: statsCache.state.size,
            dataset: statsCache.dataset.size,
        },
    };
}

module.exports = {
    getGraphStats,
    clearGraphStats,
    describeGraphStats,
    unavailable,
    TAXON_LABELS,
};

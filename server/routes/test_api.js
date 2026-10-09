const express = require('express');
const router = express.Router();
const neo4j_calls = require('../neo4j_calls/neo4j_api');
const store = require('../auth/store');
const { previewOf } = require('../neo4j_calls/preview');
const { requireVerifiedUser, currentUser } = require('../auth/middleware');

/** The datasets a result drew on, read from the metadata the query already returns. */
function datasetsIn(result) {
    const meta = (result && result.meta) || [];
    return [...new Set(meta.map((entry) => entry && entry.datasetName).filter(Boolean))];
}

// Searching and visualising what the portal holds is open to everyone; the records are not.
// Someone deciding whether this dataset suits them cannot answer that from behind a
// registration form, so an anonymous search is answered with a preview the map and graph can
// draw (see neo4j_calls/preview.js). Only a verified account is sent record rows, and the
// account requirement exists to know who the data reaches.

/**
 * Anonymous searches are limited per address, in memory.
 *
 * A preview holds no records, but enough previews over enough small areas would add up to a
 * coarse copy of the graph, and every search costs the database. An account has no limit
 * here, because its searches are attributed. Per-process, like the sign-in limiter: it resets
 * on a restart. Behind Apache it relies on KN_TRUST_PROXY, without which every visitor shares
 * one address and the limit.
 */
const anonymousSearches = new Map();
const ANON_WINDOW_MS = 60 * 60 * 1000;
const ANON_MAX_SEARCHES = 20;

function anonymousLimitReached(ip) {
    const now = Date.now();
    const seen = (anonymousSearches.get(ip) || []).filter((at) => now - at < ANON_WINDOW_MS);
    seen.push(now);
    anonymousSearches.set(ip, seen);
    if (anonymousSearches.size > 5000) anonymousSearches.clear();   // bound the map
    return seen.length > ANON_MAX_SEARCHES;
}

router.get('/', async function (req, res, next) {
    res.status(200).send("Root Response from :8080/test_api");
    return 700000;
});

/**
 * Run a search.
 *
 * The body carries the filters the user chose. The server builds the query from them, which
 * is what lets it weigh each filter against the cached observation counts and start from the
 * narrowest one. Values reach the database as query parameters, so a name is data and can
 * never alter the query.
 */
router.post('/neo4j_get/', async function (req, res) {
    const body = req.body || {};

    // A client sending finished Cypher is one built before the server took over query
    // construction, and its query would bypass both the planner and the parameter boundary.
    if (body.cypherQuery !== undefined) {
        return res.status(400).send({
            error: 'This portal build sends a query the server no longer accepts. '
                + 'Reload the page to pick up the current version.'
        });
    }

    // Read once: it decides both what the result may contain and whom it is recorded against.
    const user = currentUser(req);
    const verified = Boolean(user && user.verified_at);

    // Counted before the search runs, so a refused or failing search still counts.
    if (!verified && anonymousLimitReached(req.ip)) {
        return res.status(429).send({
            error: 'Too many searches from this address without an account. Sign in, or wait '
                + 'an hour and try again.'
        });
    }

    try {
        // `search` is what the user chose and the query is built from it. `filters` is the
        // description of that search kept for the audit trail, which holds counts and flags
        // and no names.
        const { result, plan } = await neo4j_calls.run_search(body.search || {});

        // Recorded after the result exists, so a failed search is not counted as a retrieval.
        // The row count and the datasets come from the result itself; only the description of
        // what was searched for comes from the client. An anonymous search is not recorded:
        // it has no account to attribute it to, and it was sent no records.
        if (!verified) {
            return res.status(200).send({ result: result ? previewOf(result) : result, plan });
        }

        store.recordDataRequest({
            userId: user.id,
            kind: 'query',
            filters: body.filters,
            rows: result && Array.isArray(result.csv) ? result.csv.length : 0,
            datasets: datasetsIn(result),
        });

        res.status(200).send({ result, plan });
    } catch (error) {
        // Refused on the estimate, before the database was asked. Reported as 413 so the
        // client shows it the same way it shows a search the database gave up on.
        if (error && error.tooLarge) {
            return res.status(413).send({ error: error.message });
        }

        // A filter the server cannot honour is the caller's to fix, and the message says what
        // is wrong with it.
        if (error && error.userFacing) {
            return res.status(400).send({ error: error.message });
        }

        console.error('Error fetching data from Neo4j:', error);

        // The database could not be reached. Nothing is wrong with the search, and a generic
        // 500 here reads as a broken query and sends whoever is diagnosing it to the wrong
        // place; 503 is the status for a dependency that is temporarily gone.
        if (neo4j_calls.isDatabaseUnreachable(error)) {
            return res.status(503).send({
                error: 'The portal cannot reach its database at the moment, so no search can be '
                    + 'run. This is a fault on our side, not a problem with your search. '
                    + 'Please try again shortly.'
            });
        }

        // neo4j aborts a query that exceeds dbms.memory.transaction.total.max; tell the client
        // that the search was too large rather than reporting a generic server fault
        const outOfMemory = error && typeof error.code === 'string' && error.code.includes('MemoryPoolOutOfMemory');

        res.status(outOfMemory ? 413 : 500).send({
            error: outOfMemory
                ? 'This search returned too much data for the database to assemble at once. Please narrow it with additional filters (for example a state, a date range, or a taxonomic group).'
                : 'Internal Server Error'
        });
    }
});

/**
 * What the statistics cache holds.
 *
 * Describes what the graph holds, so it needs no account. It is how you tell whether the
 * pipeline's graph-stats stage has been run against this database.
 */
router.get('/graph_stats_status/', function (req, res) {
    res.status(200).send({ status: neo4j_calls.graph_stats_status() });
});

/**
 * Record that a result was taken away.
 *
 * The zip is assembled in the browser, so the server cannot see a download happen. The client
 * says so afterwards, on an authenticated path, which is what attributes it to an account.
 * The records the zip is built from are only ever sent to a verified account, so that is
 * where the access control lies; this is attribution.
 */
router.post('/record_download/', requireVerifiedUser, function (req, res) {
    const { filters, rows, datasets } = req.body || {};
    store.recordDataRequest({
        userId: req.user.id,
        kind: 'download',
        filters,
        rows: Number(rows),
        datasets: Array.isArray(datasets) ? datasets : [],
    });
    res.status(204).end();
});

/**
 * The values the search panel offers.
 *
 * Derived from the graph and then held for the life of the process, so this answers from
 * memory after the first call. A failure here is reported rather than returned empty: the
 * panel cannot tell a portal that holds nothing from a database it could not reach, and
 * answering 200 with no values leaves the user looking at an empty search form with no
 * explanation.
 */
router.get('/neo4j_search_options/', async function (req, res) {
    try {
        const result = await neo4j_calls.get_search_options();
        res.status(200).send({ result });
    } catch (error) {
        console.error('Error fetching search options from Neo4j:', error);

        if (neo4j_calls.isDatabaseUnreachable(error)) {
            return res.status(503).send({
                error: 'The portal cannot reach its database at the moment, so the search '
                    + 'options are unavailable. Please try again shortly.'
            });
        }

        res.status(500).send({ error: 'Internal Server Error' });
    }
});

/**
 * Whether the database is reachable right now.
 *
 * The other two status routes answer from caches held for the life of the process, so through
 * an outage they go on describing the graph as it stood when the process last reached it, and
 * the portal looks healthy from outside until somebody runs a search. This one asks the
 * database on every call, which is what makes it usable as a health check.
 *
 * No account needed: it says whether the portal is working and discloses nothing about what
 * the graph holds. The driver's advice and the address it could not reach stay in the log,
 * where they are useful; the status code is what a caller acts on.
 */
router.get('/health/', async function (req, res) {
    const outcome = await neo4j_calls.check_database();

    if (!outcome.reachable) {
        console.error(`Health check: database unreachable after ${outcome.elapsedMs}ms `
            + `(${outcome.code}): ${outcome.message}`);
    }

    res.status(outcome.reachable ? 200 : 503).send({
        database: outcome.reachable ? 'reachable' : 'unreachable',
        code: outcome.code || null,
        elapsedMs: outcome.elapsedMs,
    });
});


module.exports = router;
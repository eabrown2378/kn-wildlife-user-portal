const express = require('express');
const router = express.Router();
const neo4j_calls = require('../neo4j_calls/neo4j_api');
const store = require('../auth/store');
const { requireVerifiedUser } = require('../auth/middleware');

/** The datasets a result drew on, read from the metadata the query already returns. */
function datasetsIn(result) {
    const meta = (result && result.meta) || [];
    return [...new Set(meta.map((entry) => entry && entry.datasetName).filter(Boolean))];
}

// Browsing what the portal holds is open to everyone; retrieving records is not.
// Someone deciding whether this dataset suits them cannot answer that from behind a
// registration form, and the account requirement exists to know who data reaches.

router.get('/', async function (req, res, next) {
    res.status(200).send("Root Response from :8080/test_api");
    return 700000;
});

router.post('/neo4j_get/', requireVerifiedUser, async function (req, res) {
    try {
        const { cypherQuery, filters } = req.body;

        // Get the result from Neo4j API
        let result = await neo4j_calls.get_neo4j(cypherQuery);

        // Recorded after the result exists, so a failed search is not counted as a retrieval.
        // The row count and the datasets come from the result itself; only the description of
        // what was searched for comes from the client.
        store.recordDataRequest({
            userId: req.user.id,
            kind: 'query',
            filters,
            rows: result && Array.isArray(result.csv) ? result.csv.length : 0,
            datasets: datasetsIn(result),
        });

        // Send back the result in a JSON response
        res.status(200).send({ result });
    } catch (error) {
        console.error('Error fetching data from Neo4j:', error);

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
 * Record that a result was taken away.
 *
 * The zip is assembled in the browser, so the server cannot see a download happen. The client
 * says so afterwards, on the same authenticated path, which is what attributes it to an
 * account. A caller could skip this and download silently; the query that produced the data
 * is already recorded, so the audit trail has the retrieval either way.
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

router.get('/neo4j_search_options/', async function (req, res) {
    try {
        // Get search options from Neo4j API
        let result = await neo4j_calls.get_search_options();
        
        
        // Send back the result in a JSON response
        res.status(200).send({ result });
    } catch (error) {
        console.error('Error fetching search options from Neo4j:', error);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});


module.exports = router;
const express = require('express');
const router = express.Router();
const neo4j_calls = require('../neo4j_calls/neo4j_api');

router.get('/', async function (req, res, next) {
    res.status(200).send("Root Response from :8080/test_api");
    return 700000;
});

router.get('/neo4j_get/:query', async function (req, res) {
    try {
        // Get the result from Neo4j API
        let result = await neo4j_calls.get_neo4j(req.params.query);

        // Send back the result in a JSON response
        res.status(200).send({ result });
    } catch (error) {
        console.error('Error fetching data from Neo4j:', error);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

router.get('/neo4j_search_options/:query', async function (req, res) {
    try {
        // Get search options from Neo4j API
        const parsedQuery = JSON.parse(Object.fromEntries(new URLSearchParams(req.params.query)).query);
        let result = await neo4j_calls.get_search_options(parsedQuery);
        
        
        // Send back the result in a JSON response
        res.status(200).send({ result });
    } catch (error) {
        console.error('Error fetching search options from Neo4j:', error);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});


module.exports = router;
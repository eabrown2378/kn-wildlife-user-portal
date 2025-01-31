let neo4j = require('neo4j-driver');
let { creds } = require("../config/credentials");
let driver = neo4j.driver("bolt://0.0.0.0:7687", neo4j.auth.basic(creds.neo4jusername, creds.neo4jpw));

exports.get_neo4j = async function (query) {
    let session = driver.session();
    const neo4j_data = await session.run(query, {
    });
    session.close();
    console.log("RESULT", (!neo4j_data ? null : neo4j_data.records.data));
    return (!neo4j_data ? null : neo4j_data.records);
};


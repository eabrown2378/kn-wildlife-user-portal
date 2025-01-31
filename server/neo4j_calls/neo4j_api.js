let neo4j = require('neo4j-driver');
let { creds } = require("../config/credentials");
let driver = neo4j.driver("bolt://0.0.0.0:7687", neo4j.auth.basic(creds.neo4jusername, creds.neo4jpw));

exports.get_neo4j = async function (query) {
    
    try {
        // initiate neo4j session in 'read-only' mode
        let session = driver.session({ defaultAccessMode: neo4j.session.READ });

        // make query
        const neo4j_data = await session.run(query, {});

        // end session
        session.close();

        console.log("RESULT", (!neo4j_data ? null : neo4j_data.records.data));
    
        return (!neo4j_data ? null : neo4j_data.records);

    } catch(error) {

        console.error('Error fetching neo4j data:', error)
        
    }

};


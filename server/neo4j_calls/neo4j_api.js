let neo4j = require('neo4j-driver');
let { creds } = require("../config/credentials");
let driver = neo4j.driver("bolt://localhost:7687", neo4j.auth.basic(creds.neo4jusername, creds.neo4jpw));

exports.get_neo4j = async function (query) {
    
    try {
        // initiate neo4j session in 'read-only' mode
        let session = driver.session({ defaultAccessMode: neo4j.session.READ });

        // make query
        const neo4j_data = await session.run(query, {});

        // end session
        session.close();

        console.log("RESULT", (!neo4j_data ? null : neo4j_data.records));
    
        return (!neo4j_data ? null : neo4j_data.records);

    } catch(error) {

        console.error('Error fetching neo4j data:', error)
        
    }

};


exports.get_search_options = async function () {  
        
    const session = driver.session();

/*     [
        'name',         'api_url',
        'county',       'wikidata_id',
        'family',       'genus',
        'kingdom',      'order',
        'IUCN_id',      'tax_class',
        'climate_data', 'year',
        'createdAt'
      ] */

    try {       

        // get names of all properties in DB
/*         const propertyNames = await session.run(
            `
                MATCH (n) 
                UNWIND keys(n) AS key
                WITH DISTINCT key
                ORDER by key
                RETURN collect(key) 
                AS key
            `
        );

        console.log(propertyNames.records.map((record) => record.get("key"))) */

        // retrieve search options (unique values of properties) and send to client
        const speciesOptions = await session.run(
            `MATCH (n:Species) RETURN DISTINCT n.name AS uniqueValues`
        );

        const genusOptions = await session.run(
            `MATCH (n:Genus) RETURN DISTINCT n.name AS uniqueValues`
        );

        const familyOptions = await session.run(
            `MATCH (n:Family) RETURN DISTINCT n.name AS uniqueValues`
        );

        const orderOptions = await session.run(
            `MATCH (n:Order) RETURN DISTINCT n.name AS uniqueValues`
        );

        const classOptions = await session.run(
            `MATCH (n:TaxClass) RETURN DISTINCT n.name AS uniqueValues`
        );

        const stateOptions = await session.run(
            `MATCH (n:State) RETURN DISTINCT n.name AS uniqueValues`
        );

        const countyOptions = await session.run(
            `MATCH (n:County) RETURN DISTINCT n.name AS uniqueValues`
        );

        const siteOptions = await session.run(
            `MATCH (n:Site) RETURN DISTINCT n.name AS uniqueValues`
        );

        session.close();

        const search_options = {
            speciesOptions: speciesOptions.records.map((record) => record.get("uniqueValues")).filter((value) => value !== null).sort(),
            genusOptions: genusOptions.records.map((record) => record.get("uniqueValues")).filter((value) => value !== null).sort(),
            familyOptions: familyOptions.records.map((record) => record.get("uniqueValues")).filter((value) => value !== null).sort(),
            orderOptions: orderOptions.records.map((record) => record.get("uniqueValues")).filter((value) => value !== null).sort(),
            classOptions: classOptions.records.map((record) => record.get("uniqueValues")).filter((value) => value !== null).sort(),
            stateOptions: stateOptions.records.map((record) => record.get("uniqueValues")).filter((value) => value !== null).sort(),
            countyOptions: countyOptions.records.map((record) => record.get("uniqueValues")).filter((value) => value !== null).sort(),
            siteOptions: siteOptions.records.map((record) => record.get("uniqueValues")).filter((value) => value !== null).sort(),
        }

        //console.log(search_options);

        return search_options;

    } catch(error) {

        console.error('Error fetching search options from neo4j:', error)
        
    }
  }


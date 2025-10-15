let neo4j = require('neo4j-driver');
let { creds } = require("../config/credentials");
let driver = neo4j.driver("bolt://localhost:7687", neo4j.auth.basic(creds.neo4jusername, creds.neo4jpw));

exports.get_neo4j = async function (query, csv, map, meta) {
    
    try {
        // initiate neo4j session in 'read-only' mode
        let session = driver.session({ defaultAccessMode: neo4j.session.READ });

        // make query
        const neo4j_data = await session.run(query, {});

        // get data as csv
        const csvQuery = `WITH \"${csv}\" AS query
                            CALL apoc.export.csv.query(query, null, {stream: true})
                            YIELD file, nodes, relationships, properties, data
                            RETURN file, nodes, relationships, properties, data`
                            
        const csv_data = await session.run(csvQuery, {});

        // get data for mapping
        const map_data = await session.run(map, {});

        // get metadata 
        const meta_data = await session.run(meta, {});

        // Convert to plain objects (safe to JSON.stringify)
        const MAX_RECORDS = 10000; // or smaller for debugging
        const clean = obj => obj.records.slice(0, MAX_RECORDS).map(r => r.toObject());

        // end session
        session.close();

        // console.log("RESULT", (!neo4j_data ? null : neo4j_data.records));
    
        return (!neo4j_data || !csv_data || !map_data || !meta_data ? null : {vis: clean(neo4j_data), csv: clean(csv_data), map: clean(map_data), meta: clean(meta_data)});

    } catch(error) {

        console.error('Error fetching neo4j data:', error);
        
    };

};


exports.get_search_options = async function () {  
        
    const session = driver.session();

    try {       

       
        // TAXONOMIC SEARCH OPTIONS

        // retrieve search options (unique values of properties) and send to client
        const taxOptions = await session.run(`
            MATCH (n:Observation)
            OPTIONAL MATCH (n)-[:FROM_DATASET]->(d:Dataset)
            OPTIONAL MATCH (n)-[:OBSERVED_ORGANISM]->(s:Species)
            OPTIONAL MATCH (n)-[:OBSERVED_ORGANISM]->(g1:Genus)
            OPTIONAL MATCH (s)-[:BELONGS_TO]->(g2:Genus)
            WITH n, s, d, coalesce(g1, g2) AS g
            OPTIONAL MATCH (g)-[:BELONGS_TO]->(f:Family)
            OPTIONAL MATCH (f)-[:BELONGS_TO]->(o:Order)
            OPTIONAL MATCH (o)-[:BELONGS_TO]->(c:TaxClass)
            RETURN DISTINCT
                s.name AS species,
                g.name AS genus,
                f.name AS family,
                o.name AS order,
                c.name AS tax_class,
                d.name AS dataset
            `);



       
        // LOCATION SEARCH OPTIONS

        const locOptions =  await session.run(`
            MATCH (d:Dataset)<-[:FROM_DATASET]-(n:Observation)-[:OBSERVED_IN]->(l:Site)-[:IN_COUNTY]->(l2:County)-[:IN_STATE]->(l3:State)
            RETURN DISTINCT l.name AS site, l2.name AS county, l3.name AS state, d.name AS dataset
        `)

        const datasetOptions = await session.run(
            `
            MATCH (d:Dataset) RETURN DISTINCT d.name AS uniqueValues
            `
        );


        const covarOptions = await session.run(
            `
            MATCH (o:Observation) RETURN keys(o) AS uniqueValues LIMIT 1
            `
        );

        session.close();

        const search_options = {
            speciesOptions: (taxOptions.records.map((record) => record.get("species")).filter((value) => value !== null)).sort(),
            genusOptions: [...new Set(taxOptions.records.map((record) => record.get("genus")).filter((value) => value !== null))].sort(),
            familyOptions: [...new Set(taxOptions.records.map((record) => record.get("family")).filter((value) => value !== null))].sort(),
            orderOptions: [...new Set(taxOptions.records.map((record) => record.get("order")).filter((value) => value !== null))].sort(),
            classOptions: [...new Set(taxOptions.records.map((record) => record.get("tax_class")).filter((value) => value !== null))].sort(),
            stateOptions: [...new Set(locOptions.records.map((record) => record.get("state")).filter((value) => value !== null))].sort(),
            countyOptions: [...new Set(locOptions.records.map((record) => record.get("county")).filter((value) => value !== null))].sort(),
            // for some reason, neo4j is returning some site names as lists/arrays, so we need to resolve that:
            siteOptions: locOptions.records.map((record) => record.get("site")).map((record) => {
                                                                                            if (Array.isArray(record)) {
                                                                                                return record.join("")
                                                                                            } else {
                                                                                                return record
                                                                                            }}).filter((value) => value !== null).sort(),
            datasetOptions: datasetOptions.records.map((record) => record.get("uniqueValues")).filter((value) => value !== null).sort(),
            covarOptions: covarOptions.records[0].get("uniqueValues").filter((item) => item !== "date").sort(),
            taxMap: taxOptions.records.map(record => ({
                                                species: record.get('species') || null,
                                                genus: record.get('genus') || null,
                                                family: record.get('family') || null,
                                                order: record.get('order') || null,
                                                tax_class: record.get('tax_class') || null,
                                                dataset: record.get('dataset') || null
                                            })),
            locMap: locOptions.records.map(record => ({
                                                state: record.get('state') || null,
                                                county: record.get('county') || null,
                                                site: Array.isArray(record.get('site')) ? record.get('site').join("") : record.get('site') || null,
                                                dataset: record.get('dataset') || null
                                            }))
        };

        //console.log(search_options);

        return search_options;

    } catch(error) {

        console.error('Error fetching search options from neo4j:', error);
        
    };
  }


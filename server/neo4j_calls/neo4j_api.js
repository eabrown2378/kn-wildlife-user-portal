let neo4j = require('neo4j-driver');
let { creds } = require("../config/credentials");
let driver = neo4j.driver("bolt://localhost:7687", neo4j.auth.basic(creds.neo4jusername, creds.neo4jpw));

exports.get_neo4j = async function (query, csv) {
    
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
                            
        const csv_data = await session.run(csvQuery, {})
        // end session
        session.close();

        // console.log("RESULT", (!neo4j_data ? null : neo4j_data.records));
    
        return (!neo4j_data || !csv_data ? null : {vis: neo4j_data.records, csv: csv_data});

    } catch(error) {

        console.error('Error fetching neo4j data:', error);
        
    };

};


exports.get_search_options = async function (query) {  
        
    const session = driver.session();

    try {       

       
        // TAXONOMIC SEARCH OPTIONS

        // if taxonomic hierarchical search is enabled (or when specific datasets have been selected), include a WHERE statement in the cypher query
        let whereStatementTax = '';
        if (query.datasets.length > 0 || (query.taxHier && (query.tax_class.length > 0 || query.order.length > 0 || query.family.length > 0 || query.genus.length > 0))) {
            whereStatementTax = " WHERE ";
        }
        // retrieve search options (unique values of properties) and send to client
        const speciesOptions = await session.run(
            `
            MATCH (c:TaxClass)<-[b4:BELONGS_TO]-(o:Order)<-[b3:BELONGS_TO]-(f:Family)<-[b2:BELONGS_TO]-(g:Genus)<-[b1:BELONGS_TO]-(n:Species)<-[:OBSERVED_ORGANISM]-(:Observation)-[:FROM_DATASET]->(d:Dataset)                  
            ${query.datasets.length > 0 || query.tax_class.length > 0 || query.order.length > 0 || query.family.length > 0 || query.genus.length > 0 ? whereStatementTax : ''}     
            ${query.datasets.length > 0 ? `d.name IN ['${query.datasets.join("','")}'] ${query.tax_class.length > 0 || query.order.length > 0 || query.family.length > 0 || query.genus.length > 0 ? ' AND ' : ''}` : ''}  
            ${query.taxHier ? 
                `                
                ${query.tax_class.length > 0 ? `c.name IN ['${query.tax_class.join("','")}']` : ''} 
                ${query.tax_class.length > 0 && (query.order.length > 0 || query.family.length > 0 || query.genus.length > 0) ? ' AND ' : ''}
                ${query.order.length > 0 ? `o.name IN ['${query.order.join("','")}']` : ''}                  
                ${query.order.length > 0 && (query.family.length > 0 || query.genus.length > 0) ? ' AND ' : ''}
                ${query.family.length > 0 ? `f.name IN ['${query.family.join("','")}']` : ''}                                   
                ${query.family.length > 0 && query.genus.length > 0 ? ' AND ' : ''}
                ${query.genus.length > 0 ? `g.name IN ['${query.genus.join("','")}']` : ''} 
                ` : ''}
            RETURN DISTINCT n.name AS uniqueValues
            `
        );

        const genusOptions = await session.run(
            `
            MATCH (c:TaxClass)<-[b4:BELONGS_TO]-(o:Order)<-[b3:BELONGS_TO]-(f:Family)<-[b2:BELONGS_TO]-(g:Genus)<-[b1:BELONGS_TO]-(n:Species)<-[:OBSERVED_ORGANISM]-(:Observation)-[:FROM_DATASET]->(d:Dataset)                
            ${query.datasets.length > 0 || query.tax_class.length > 0 || query.order.length > 0 || query.family.length > 0 ? whereStatementTax : ''}   
            ${query.datasets.length > 0 ? `d.name IN ['${query.datasets.join("','")}']  ${query.tax_class.length > 0 || query.order.length > 0 || query.family.length > 0 ? ' AND ' : ''}` : ''}  
            ${query.taxHier ? 
                `           
                ${query.tax_class.length > 0 ? `c.name IN ['${query.tax_class.join("','")}']` : ''}  
                ${query.tax_class.length > 0 && (query.order.length > 0 || query.family.length > 0) ? ' AND ' : ''}
                ${query.order.length > 0 ? `o.name IN ['${query.order.join("','")}']` : ''}                   
                ${query.order.length > 0 && query.family.length > 0 ? ' AND ' : ''}
                ${query.family.length > 0 ? `f.name IN ['${query.family.join("','")}']` : ''} 
                ` : ''}
            RETURN DISTINCT g.name AS uniqueValues
            `
        );

        const familyOptions = await session.run(
            `
            MATCH (c:TaxClass)<-[b4:BELONGS_TO]-(o:Order)<-[b3:BELONGS_TO]-(f:Family)<-[b2:BELONGS_TO]-(g:Genus)<-[b1:BELONGS_TO]-(n:Species)<-[:OBSERVED_ORGANISM]-(:Observation)-[:FROM_DATASET]->(d:Dataset)                
            ${query.datasets.length > 0 || query.tax_class.length > 0 || query.order.length > 0 ? whereStatementTax : ''}   
            ${query.datasets.length > 0 ? `d.name IN ['${query.datasets.join("','")}'] ${query.tax_class.length > 0 || query.order.length > 0 ? ' AND ' : ''}` : ''}  
            ${query.taxHier ? 
                `               
                ${query.tax_class.length > 0 ? `c.name IN ['${query.tax_class.join("','")}']` : ''}   
                ${query.tax_class.length > 0 && query.order.length > 0 ? ' AND ' : ''}
                ${query.order.length > 0 ? `o.name IN ['${query.order.join("','")}']` : ''} 
                ` : ''}
            RETURN DISTINCT f.name AS uniqueValues
            `
        );

        const orderOptions = await session.run(
            `
            MATCH (c:TaxClass)<-[b4:BELONGS_TO]-(o:Order)<-[b3:BELONGS_TO]-(f:Family)<-[b2:BELONGS_TO]-(g:Genus)<-[b1:BELONGS_TO]-(n:Species)<-[:OBSERVED_ORGANISM]-(:Observation)-[:FROM_DATASET]->(d:Dataset)   
            ${query.datasets.length > 0 || query.tax_class.length > 0 ? whereStatementTax : ''}    
            ${query.datasets.length > 0 ? `d.name IN ['${query.datasets.join("','")}'] ${query.tax_class.length > 0 ? ' AND ' : ''}` : ''} 
            ${query.taxHier ? 
                `               
                ${query.tax_class.length > 0 ? `c.name IN ['${query.tax_class.join("','")}']` : ''}
                ` : ''}
            RETURN DISTINCT o.name AS uniqueValues
            `
        );

        const classOptions = await session.run(
            ` 
            MATCH (c:TaxClass)<-[b4:BELONGS_TO]-(o:Order)<-[b3:BELONGS_TO]-(f:Family)<-[b2:BELONGS_TO]-(g:Genus)<-[b1:BELONGS_TO]-(n:Species)<-[:OBSERVED_ORGANISM]-(:Observation)-[:FROM_DATASET]->(d:Dataset)
            ${query.datasets.length > 0 ? whereStatementTax : ''}  
            ${query.datasets.length > 0 ? `d.name IN ['${query.datasets.join("','")}']` : ''}   
            RETURN DISTINCT c.name AS uniqueValues
            `
        );

       
        // LOCATION SEARCH OPTIONS

        // if taxonomic hierarchical search is enabled (or if specific datasets have been selected), include a WHERE statement in the cypher query
        let whereStatementLoc = '';
        if (query.datasets.length > 0 || (query.locHier && (query.states.length > 0 || query.counties.length > 0))) {
            whereStatementLoc = " WHERE ";
        }

        const stateOptions = await session.run(
            `
            MATCH (d:Dataset)<-[:FROM_DATASET]-(:Observation)-[:OBSERVED_IN]->(s:Site)-[s1:IN_COUNTY]->(p1:County)-[s2:IN_STATE]->(p2:State)    
            ${query.datasets.length > 0 ? whereStatementLoc : ''}   
            ${query.datasets.length > 0 ? `d.name IN ['${query.datasets.join("','")}']` : ''}  
            RETURN DISTINCT p2.name AS uniqueValues
            `
        );

        const countyOptions = await session.run(
            `
            MATCH (d:Dataset)<-[:FROM_DATASET]-(:Observation)-[:OBSERVED_IN]->(s:Site)-[s1:IN_COUNTY]->(p1:County)-[s2:IN_STATE]->(p2:State)  
            ${query.datasets.length > 0 || query.states.length > 0 ? whereStatementLoc : ''}  
            ${query.datasets.length > 0 ? `d.name IN ['${query.datasets.join("','")}'] ${query.states.length > 0 ? ' AND ' : ''}` : ''}  
            ${query.locHier ? 
                `               
                ${query.states.length > 0 ? `p2.name IN ['${query.states.join("','")}']` : ''}
                ` : ''}
            RETURN DISTINCT p1.name AS uniqueValues
            `
        );

        const siteOptions = await session.run(
            `
            MATCH (d:Dataset)<-[:FROM_DATASET]-(:Observation)-[:OBSERVED_IN]->(s:Site)-[s1:IN_COUNTY]->(p1:County)-[s2:IN_STATE]->(p2:State)                
            ${query.datasets.length > 0 || query.states.length > 0 || query.counties.length > 0 ? whereStatementLoc : ''}  
            ${query.datasets.length > 0 ? `d.name IN ['${query.datasets.join("','")}'] ${query.states.length > 0 || query.counties.length > 0 ? ' AND ' : ''}` : ''}
            ${query.locHier ? 
                `               
                ${query.states.length > 0 ? `p2.name IN ['${query.states.join("','")}']` : ''}   
                ${query.states.length > 0 && query.counties.length > 0 ? ' AND ' : ''}
                ${query.counties.length > 0 ? `p1.name IN ['${query.counties.join("','")}']` : ''} 
                ` : ''}
            RETURN DISTINCT s.name AS uniqueValues
            `
        );

        const datasetOptions = await session.run(
            `
            MATCH (d:Dataset) RETURN DISTINCT d.name AS uniqueValues
            `
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
            // for some reason, neo4j is returning some site names as lists, so we need to resolve that:
            siteOptions: siteOptions.records.map((record) => record.get("uniqueValues")).map((record) => {
                                                                                            if (Array.isArray(record)) {
                                                                                                return record.join("")
                                                                                            } else {
                                                                                                return record
                                                                                            }}).filter((value) => value !== null).sort(),
            datasetOptions: datasetOptions.records.map((record) => record.get("uniqueValues")).filter((value) => value !== null).sort()
        };

        //console.log(search_options);

        return search_options;

    } catch(error) {

        console.error('Error fetching search options from neo4j:', error);
        
    };
  }


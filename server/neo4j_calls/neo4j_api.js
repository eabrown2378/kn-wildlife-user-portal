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

        // console.log("RESULT", (!neo4j_data ? null : neo4j_data.records));
    
        return (!neo4j_data ? null : neo4j_data.records);

    } catch(error) {

        console.error('Error fetching neo4j data:', error);
        
    };

};


exports.get_search_options = async function (query) {  
        
    const session = driver.session();

    try {       

       
        // TAXONOMIC SEARCH OPTIONS

        // if taxonomic hierarchical search is enabled, include a WHERE statement in the cypher query
        let taxHierInit = '';
        if (query.taxHier && (query.tax_class.length > 0 || query.order.length > 0 || query.family.length > 0 || query.genus.length > 0)) {
            taxHierInit = " WHERE ";
        }
        // retrieve search options (unique values of properties) and send to client
        const speciesOptions = await session.run(
            `
            MATCH (c:TaxClass)<-[b4:BELONGS_TO]-(o:Order)<-[b3:BELONGS_TO]-(f:Family)<-[b2:BELONGS_TO]-(g:Genus)<-[b1:BELONGS_TO]-(n:Species)                 
            ${query.tax_class.length > 0 || query.order.length > 0 || query.family.length > 0 || query.genus.length > 0 ? taxHierInit : ''}  
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
            MATCH (c:TaxClass)<-[b4:BELONGS_TO]-(o:Order)<-[b3:BELONGS_TO]-(f:Family)<-[b2:BELONGS_TO]-(g:Genus)<-[b1:BELONGS_TO]-(n:Species)                
            ${query.tax_class.length > 0 || query.order.length > 0 || query.family.length > 0 ? taxHierInit : ''}  
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
            MATCH (c:TaxClass)<-[b4:BELONGS_TO]-(o:Order)<-[b3:BELONGS_TO]-(f:Family)<-[b2:BELONGS_TO]-(g:Genus)<-[b1:BELONGS_TO]-(n:Species)               
            ${query.tax_class.length > 0 || query.order.length > 0 ? taxHierInit : ''}  
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
            MATCH (c:TaxClass)<-[b4:BELONGS_TO]-(o:Order)<-[b3:BELONGS_TO]-(f:Family)<-[b2:BELONGS_TO]-(g:Genus)<-[b1:BELONGS_TO]-(n:Species)  
            ${query.tax_class.length > 0 ? taxHierInit : ''}  
            ${query.taxHier ? 
                `               
                ${query.tax_class.length > 0 ? `c.name IN ['${query.tax_class.join("','")}']` : ''}
                ` : ''}
            RETURN DISTINCT o.name AS uniqueValues
            `
        );

        const classOptions = await session.run(
            `
            MATCH (c:TaxClass) 
            RETURN DISTINCT c.name AS uniqueValues
            `
        );

       
        // LOCATION SEARCH OPTIONS

        // if taxonomic hierarchical search is enabled, include a WHERE statement in the cypher query
        let locHierInit = '';
        if (query.locHier && (query.states.length > 0 || query.counties.length > 0)) {
            locHierInit = " WHERE ";
        }

        const stateOptions = await session.run(
            `
            MATCH (p2:State) 
            RETURN DISTINCT p2.name AS uniqueValues
            `
        );

        const countyOptions = await session.run(
            `
            MATCH (s:Site)-[s1:IN_COUNTY]->(p1:County)-[s2:IN_STATE]->(p2:State)  
            ${query.states.length > 0 ? locHierInit : ''}  
            ${query.locHier ? 
                `               
                ${query.states.length > 0 ? `p2.name IN ['${query.states.join("','")}']` : ''}
                ` : ''}
            RETURN DISTINCT p1.name AS uniqueValues
            `
        );

        const siteOptions = await session.run(
            `
            MATCH (s:Site)-[s1:IN_COUNTY]->(p1:County)-[s2:IN_STATE]->(p2:State)               
            ${query.states.length > 0 || query.counties.length > 0 ? locHierInit : ''}  
            ${query.locHier ? 
                `               
                ${query.states.length > 0 ? `p2.name IN ['${query.states.join("','")}']` : ''}   
                ${query.states.length > 0 && query.counties.length > 0 ? ' AND ' : ''}
                ${query.counties.length > 0 ? `p1.name IN ['${query.counties.join("','")}']` : ''} 
                ` : ''}
            RETURN DISTINCT s.name AS uniqueValues
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
            siteOptions: siteOptions.records.map((record) => record.get("uniqueValues")).map((record) => {
                                                                                            if (Array.isArray(record)) {
                                                                                                return record.join("")
                                                                                            } else {
                                                                                                return record
                                                                                            }}).filter((value) => value !== null).sort(),
        };

        //console.log(search_options);

        return search_options;

    } catch(error) {

        console.error('Error fetching search options from neo4j:', error);
        
    };
  }


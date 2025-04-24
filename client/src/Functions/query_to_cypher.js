
// function to translate query object to cypher code

const query_to_cypher = ({       
            species, genus, family, order, tax_class, 
            maxLat, minLat, maxLon, minLon, 
            sites, states, counties, datasets, 
            fromMonth, toMonth, fromDay, toDay, fromYear, toYear
        }) => {

    // concatenate dates
    if (fromMonth !== "" && fromDay !== "" && fromYear !== "") {
        const fromDate = [fromMonth, fromDay, fromYear].join("-");
    }

    if (toMonth !== "" && toDay !== "" && toYear !== "") {
        const toDate = [toMonth, toDay, toYear].join("-");
    }

    let locationString = ''

    if (sites[0] !== 'all' || counties[0] !== 'all' || states[0] !== 'all') {
        locationString = 
        `
            (
            p2.name IN ['${states.join("','")}']
            OR p1.name IN ['${counties.join("','")}']
            OR p.name IN ['${sites.join("','")}']            
            )
        `;
    }

    // initial match statement to return complete chain of nodes and edges from neo4j
    const matchString = "MATCH (c:TaxClass)<-[b4:BELONGS_TO]-(o:Order)<-[b3:BELONGS_TO]-(f:Family)<-[b2:BELONGS_TO]-(g:Genus)<-[b1:BELONGS_TO]-(n:Species)<-[r:OBSERVED_ORGANISM]-(p:Observation)-[i:OBSERVED_IN]->(s:Site)-[s1:IN_COUNTY]->(p1:County)-[s2:IN_STATE]->(p2:State) WHERE";


    let taxString = 
    `
        (
        n.name IN ['${species.join("','")}'] 
        OR g.name IN ['${genus.join("','")}']
        OR f.name IN ['${family.join("','")}']
        OR o.name IN ['${order.join("','")}']
        OR c.name IN ['${tax_class.join("','")}']
        )
    `;

    
    if (species.length === 0 && genus.length === 0 && family.length === 0 && order.length === 0 && tax_class.length === 0) {
        
        taxString = '';

    }

    const cypherString = matchString + taxString + locationString + " RETURN * "
   




    return cypherString;


};




export {query_to_cypher};
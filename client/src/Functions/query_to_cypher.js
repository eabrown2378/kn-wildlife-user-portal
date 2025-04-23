
// function to translate query object to cypher code

const query_to_cypher = ({       
            species, genus, family, order, tax_class, 
            maxLat, minLat, maxLon, minLon, 
            sites, states, counties, datasets, 
            fromMonth, toMonth, fromDay, toDay, fromYear, toYear
        }) => {

    // concatenate dates
    if (fromMonth !== "" && fromDay !== "" && fromYear !== "") {
        const fromDate = [fromMonth, fromDay, fromYear].join("-")
    }

    if (toMonth !== "" && toDay !== "" && toYear !== "") {
        const toDate = [toMonth, toDay, toYear].join("-")
    }

    const cypherString = 
        `
            MATCH (c:TaxClass)<-[b4:BELONGS_TO]-(o:Order)<-[b3:BELONGS_TO]-(f:Family)<-[b2:BELONGS_TO]-(g:Genus)<-[b1:BELONGS_TO]-(n:Species)<-[r:OBSERVED_ORGANISM]-(s:Observation)-[i:OBSERVED_IN]->(p:Site)-[s1:IN_COUNTY]->(p1:County)-[s2:IN_STATE]->(p2:State)
            WHERE 
            (
            n.name IN ['${species.join("','")}'] 
            OR g.name IN ['${genus.join("','")}']
            OR f.name IN ['${family.join("','")}']
            OR o.name IN ['${order.join("','")}']
            OR c.name IN ['${tax_class.join("','")}']
            )


            RETURN *
        `


    return cypherString;


};




export {query_to_cypher};
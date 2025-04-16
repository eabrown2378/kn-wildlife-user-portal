
// function to translate query object to cypher code

const query_to_cypher = ({species, genus, family, order, tax_class}) => {


    const cypherString = 
        `
            MATCH (c:TaxClass)<-[b4:BELONGS_TO]-(o:Order)<-[b3:BELONGS_TO]-(f:Family)<-[b2:BELONGS_TO]-(g:Genus)<-[b1:BELONGS_TO]-(n:Species)<-[r:OBSERVED_ORGANISM]-(s:Observation)-[i:OBSERVED_IN]->(p:Site)
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
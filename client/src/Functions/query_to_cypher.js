
// function to translate query object to cypher code

const query_to_cypher = ({species, genus, family, order, tax_class}) => {


    const cypherString = 
        `
            MATCH (n:Animal)<-[r:OBSERVED_ANIMAL]-(s:Sample)-[o:OBSERVED_AT]->(l:Location)
            WHERE n.species IN ['${species.join("','")}'] 
            OR n.genus IN ['${genus.join("','")}']
            OR n.family IN ['${family.join("','")}']
            OR n.order IN ['${order.join("','")}']
            OR n.tax_class IN ['${tax_class.join("','")}']
            RETURN *
        `


    return cypherString;


};




export {query_to_cypher};
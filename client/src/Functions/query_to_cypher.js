
// function to translate query object to cypher code

const query_to_cypher = ({speciesOptions, genusOptions, familyOptions, orderOptions, classOptions}) => {


    const cypherString = 
        `
            MATCH (n:Animal)-[r]->(m)
            WHERE n.species IN ${speciesOptions} 
            OR n.genus IN ${genusOptions}
            OR n.family IN ${familyOptions}
            OR n.order IN ${orderOptions}
            OR n.tax_class IN ${classOptions}
        `


    return cypherString;


};




export {query_to_cypher};
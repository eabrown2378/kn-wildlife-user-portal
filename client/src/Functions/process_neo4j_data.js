// function to format data returned by neo4j GET request and transform it into something usable by Cytoscape

const process_neo4j_data = (data) => {

    // separate node and relationship data
    const extendedData = data.map((x) => {

        const result = x._fields.map((y) => {

            return {
                ...y,
                dataType: y.startNodeElementId ? 'relationship' : 'node' // if result has a start or end node ID then it must be a relationship, otherwise it is a node

            };
        });        

        return result;

    }).flat();


    // format data for a cytoscape graph
    const cytoscapeData = extendedData.map((x) => {

        if (x.dataType === 'relationship') {
            return {
                data: {
                    id: x.elementId,
                    source: x.startNodeElementId,
                    target: x.endNodeElementId,
                    ...x
                }
            }
        };

        return {
            data: { 
                id: x.elementId,
                ...x
            }
        };

    });



    // return array of separated nodes and relationships
    return cytoscapeData;
};




export {process_neo4j_data};
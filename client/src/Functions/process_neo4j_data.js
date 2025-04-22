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
    const cleanedData = extendedData.map((x) => {

        if (x.dataType === 'relationship') {
            return {
                id: x.elementId,
                source: x.startNodeElementId,
                target: x.endNodeElementId,
                category: x.type,
                ...x
            };
        };

        return {
            id: x.elementId,
            category: x.labels[0],
            ...x
        };


    });


    const cytoscapeData = cleanedData.map((x) => {

        if (x.category === "Site") {

/*             // Regular expression to capture latitude and longitude.
            const regex = /latitude=(-?\d+\.\d+)&longitude=(-?\d+\.\d+)/;

            // Use the exec() method to find the matches in the URL.
            const matches = regex.exec(x.properties.api_url); */

            const latitude = x.properties.latitudes[0];
            const longitude = x.properties.longitudes[0];

            return {
                data: {
                    longitude,
                    latitude,
                    ...x
                }
            }

        }

        return {
            data: x
        }


    })



    // return array of separated nodes and relationships
    return cytoscapeData;
};




export {process_neo4j_data};
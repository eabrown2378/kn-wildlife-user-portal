// function to format data returned by neo4j GET request and transform it into something usable by Cytoscape

const process_neo4j_data = (data) => {

    // neo4j returns vis as a flat list of the distinct nodes, relationships, and county/state
    // maps in the result, so each entry maps straight to one cytoscape element
    return data
        .filter((z) => z)
        .map((z) => {

            // if result has a start or end node ID then it must be a relationship, otherwise it is a node
            const dataType = z.startNodeElementId ? 'relationship' : 'node';
            const tagged = {...z, dataType};

            let cleaned;

            if (dataType === 'relationship') {
                cleaned = {
                    id: tagged.elementId,
                    source: tagged.startNodeElementId,
                    target: tagged.endNodeElementId,
                    category: tagged.type,
                    ...tagged
                };
            // site, county, and state nodes are returned as maps due to long property values (specifically geometry)
            } else if (tagged.p1_elementId) {
                cleaned = {
                    id: tagged.p1_elementId,
                    category: "County",
                    properties: {...tagged},
                    ...tagged
                };
            } else if (tagged.p2_elementId) {
                cleaned = {
                    id: tagged.p2_elementId,
                    category: "State",
                    properties: {...tagged},
                    ...tagged
                };
            } else {
                cleaned = {
                    id: tagged.elementId,
                    category: tagged.labels[0],
                    ...tagged
                };
            }

            if (cleaned.category === "Site") {
                return {
                    data: {
                        longitude: cleaned.longitude_dd,
                        latitude: cleaned.latitude_dd,
                        ...cleaned
                    }
                };
            }

            return {data: cleaned};

        });

};




export {process_neo4j_data};

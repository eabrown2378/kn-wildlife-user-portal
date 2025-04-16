import {Fragment, useEffect, useRef} from 'react';
import cytoscape from 'cytoscape';
import fcose from 'cytoscape-fcose';

cytoscape.use( fcose ); // layout of nodes (fast Compound Spring Embedder)


const CytoscapeGraph = ({query, queryResult}) => {


    // container to hold current cytoscape graph
    const graphRef = useRef(null);

    // draw graph based on query results
    const drawGraph = (data) => {

        const cy = cytoscape({

            container: graphRef.current,
            elements: data,
            style: [ // the stylesheet for the graph
                {
                    selector: 'node',
                    style: {
                        'background-color': 'data(data.category)',
                        'label': 'data(properties.name)'
                    }
                },
            
                {
                    selector: 'edge',
                    style: {
                        'width': 3,
                        'line-color': '#ccc',
                        'target-arrow-color': '#ccc',
                        'target-arrow-shape': 'triangle',
                        'curve-style': 'bezier',
                        'label': 'data(type)'
                    }
                },
                {
                    selector: "node[category = 'Species']",
                    style: {
                        'background-color': 'teal'
                    }
                },
                {
                    selector: "node[category = 'Genus']",
                    style: {
                        'background-color': 'blue'
                    }
                },
                {
                    selector: "node[category = 'Family']",
                    style: {
                        'background-color': 'purple'
                    }
                },
                {
                    selector: "node[category = 'Order']",
                    style: {
                        'background-color': 'orange'
                    }
                },
                {
                    selector: "node[category = 'TaxClass']",
                    style: {
                        'background-color': 'red'
                    }
                },
                {
                    selector: "node[category = 'Observation']",
                    style: {
                        'background-color': '#DEB887'
                    }
                },

                // add colors for nodes of each category
            ]

        })

        var layout = cy.layout({ name: 'fcose', nodeRepulsion: 10000000, nodeSeparation: 1000 });

        layout.run(); // apply fcose layout
    };

    // re-render graph when queryResult state changes
    useEffect(() => {
        if (queryResult) {
            drawGraph(queryResult);
        }
    }, [queryResult]);

 return (
  <Fragment>
    <div style={{display:'flex', flexDirection: 'column', gap: '12px', backgroundColor:'#FFF8DC'}}>
        {/* <button style={{height: '32px', width: "124px"}} onClick={() => {apiCall(query)}}>Generate Graph</button> */}
    </div>
    <div ref={graphRef} style={{width: '90%', height: '80vh', border:'3px solid black', backgroundColor:'white'}}>
    </div>
  </Fragment>
 )
}

export default CytoscapeGraph;

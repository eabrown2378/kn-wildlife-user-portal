import {Fragment, useEffect, useRef} from 'react';
import cytoscape from 'cytoscape';
import fcose from 'cytoscape-fcose';

cytoscape.use( fcose ); // layout of nodes (fast Compound Spring Embedder)


const GraphTest = ({query, queryResult}) => {


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
                    'background-color': '#666',
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
                }
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
    <div style={{display:'flex', flexDirection: 'column', gap: '12px'}}>
        {/* <button style={{height: '32px', width: "124px"}} onClick={() => {apiCall(query)}}>Generate Graph</button> */}
    </div>
    <div ref={graphRef} style={{width: '100%', height: '80vh', border:'3px solid black'}}>
    </div>
  </Fragment>
 )
}

export default GraphTest

import {Fragment, useEffect, useRef, useContext} from 'react';
import cytoscape from 'cytoscape';
import { QueryResultContext } from '../Context/QueryResultContext';
import { SelectionDetailsContext } from '../Context/SelectionDetailsContext';
import fcose from 'cytoscape-fcose';

cytoscape.use( fcose );



const CytoscapeGraph = () => {

    // get results of latest search
    const queryResult = useContext(QueryResultContext);

    // get currently selected node or edge
    const [selectionDetails, setSelectionDetails] = useContext(SelectionDetailsContext);

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
                        'label': 'data(properties.name)',
                        'font-size': '20px'
                    }
                },
                {
                    selector: 'node[category = "Observation"]',
                    style: {
                        'label': 'data(properties.date)',
                        'font-size': '20px'
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
                        'label': 'data(type)',
                        'font-size': '16px'
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
                {
                    selector: "node[category = 'Site']",
                    style: {
                        'background-color': 'DarkSalmon'
                    }
                },
                {
                    selector: "node[category = 'County']",
                    style: {
                        'background-color': 'DarkSlateGray'
                    }
                },
                {
                    selector: "node[category = 'State']",
                    style: {
                        'background-color': '#E4D00A'
                    }
                },

                // add colors for nodes of each category
            ]

        });


        cy.on('tap', 'node', function(evt){
            const node = evt.target._private.data;
            const selectedNode = data.filter((item) => item.data.id === node.id)[0]
            console.log(selectedNode)
            setSelectionDetails(
                <div className='selectionDetails'>
                    <p>Type: {selectedNode.data.category}</p>
                    {                    
                        Object.keys(selectedNode.data.properties).map((prop, index) =>{
                            return <p key={prop + index}>{`${prop}: ${selectedNode.data.properties[prop]}`}</p>
                        })                  
                    }
                </div>
            )
        });

        var layout = cy.layout({ name: 'fcose', nodeRepulsion: 10000000, nodeSeparation: 1500, idealEdgeLength: 250 });

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
    <div ref={graphRef} className='cytoscapeGraph'>
    </div>    
    {selectionDetails}
  </Fragment>
 )
}

export default CytoscapeGraph;

import {Fragment, useEffect, useRef, useContext, useState} from 'react';
import cytoscape from 'cytoscape';
import { QueryResultContext } from '../Context/QueryResultContext';
import { SelectionDetailsContext } from '../Context/SelectionDetailsContext';
import LoadingOverlay from './LoadingOverlay';
import fcose from 'cytoscape-fcose';

cytoscape.use( fcose );



const CytoscapeGraph = () => {

    // get results of latest search
    const queryResult = useContext(QueryResultContext);

    // get currently selected node or edge
    const [selectionDetails, setSelectionDetails] = useContext(SelectionDetailsContext);

    // container to hold current cytoscape graph
    const graphRef = useRef(null);

    // current cytoscape instance, so it can be torn down before the next query redraws it
    const cyRef = useRef(null);

    // Which results the graph on screen was drawn from. While this differs from the latest
    // results the graph is out of date, so the overlay belongs up.
    //
    // This is derived during render rather than set from an effect on purpose. An effect
    // runs after the commit, so the overlay would appear one commit late; the search's own
    // overlay has already gone by then and the gap shows as a flicker.
    const [renderedResult, setRenderedResult] = useState(null);
    const isRendering = Boolean(queryResult) && queryResult !== renderedResult;

    // draw graph based on query results
    const drawGraph = (data, onLayoutStop = () => {}) => {

        // without this, re-initializing cytoscape on the same container leaves the previous
        // query's canvas layered underneath the new one instead of replacing it
        if (cyRef.current) {
            cyRef.current.destroy();
        }

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
            const selectedNode = data.find((item) => item.data.id === node.id)
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

        layout.one('layoutstop', onLayoutStop);

        layout.run(); // apply fcose layout

        cyRef.current = cy;
    };

    // re-render graph when queryResult state changes
    useEffect(() => {
        if (!queryResult || queryResult === renderedResult) return;

        // building the graph blocks the main thread, so hand the browser a frame to paint
        // the overlay first, otherwise the UI just freezes with no indication of progress
        const frame = requestAnimationFrame(() => {
            drawGraph(queryResult, () => setRenderedResult(queryResult));
        });

        return () => cancelAnimationFrame(frame);
    }, [queryResult]);

    // tear down the cytoscape instance when the component unmounts
    useEffect(() => {
        return () => {
            if (cyRef.current) {
                cyRef.current.destroy();
            }
        };
    }, []);



 return (
  <Fragment>
    <div style={{display:'flex', flexDirection: 'column', gap: '12px', backgroundColor:'#FFF8DC'}}>
        {/* <button style={{height: '32px', width: "124px"}} onClick={() => {apiCall(query)}}>Generate Graph</button> */}
    </div>
    <div ref={graphRef} className='cytoscapeGraph'>
    </div>
    {isRendering && <LoadingOverlay viewport="cytoscape"/>}
    {selectionDetails}
  </Fragment>
 )
}

export default CytoscapeGraph;

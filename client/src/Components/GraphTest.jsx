import {Fragment, useEffect, useRef, useState} from 'react';
import { process_neo4j_data } from '../Functions/process_neo4j_data';
import { query_to_cypher } from '../Functions/query_to_cypher';
import cytoscape from 'cytoscape';
import fcose from 'cytoscape-fcose';
import axios from 'axios';

cytoscape.use( fcose ); // layout of nodes (fast Compound Spring Embedder)


const GraphTest = ({query}) => {

     //send a query (Cypher code) to neo4j API 
    const apiCall = (query) => {

        const cypher = query_to_cypher(query);

        const call = `http://localhost:8080/test_api/neo4j_get/${cypher}`;

        axios.get(call, { crossDomain: true }).then((data) => {
            if (data !== undefined) {
                console.log(process_neo4j_data(data.data.result))
                setQueryResult(process_neo4j_data(data.data.result));
            }
        })
    }

    
    //MATCH (n) -[r]-> (m) RETURN n, r, m
    // MATCH (p:PLAYER) -[r:PLAYS_FOR]-> (t:TEAM) RETURN p, r, t
    //CREATE (ethan:PLAYER{name:"Ethan Brown", age: 28, number: 0, height: 1.91, weight: 91})

    // state containing latest neo4j query results and the last query
    const [queryResult, setQueryResult] = useState(null);
    
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

        var layout = cy.layout({ name: 'circle', nodeRepulsion: 10000000, nodeSeparation: 1000 });

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
        <button style={{height: '32px', width: "124px"}} onClick={() => {apiCall(query)}}>Generate Graph</button>
    </div>
    <div ref={graphRef} style={{width: '100%', height: '80vh', border:'3px solid black'}}>
    </div>
  </Fragment>
 )
}

export default GraphTest

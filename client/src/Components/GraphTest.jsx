import {Fragment, useEffect, useRef, useState} from 'react';
import { process_neo4j_data } from '../Functions/process_neo4j_data';
import cytoscape from 'cytoscape';
import axios from 'axios';



const GraphTest = () => {

    //send a query (Cypher code) to neo4j API 
    const apiCall = (query) => {

        const queryString = `http://localhost:8080/test_api/neo4j_get/${query}`;

        axios.get(queryString).then((data) => {
            if (data !== undefined) {
                setQueryResult(process_neo4j_data(data.data.result))
            }
        })
    }

    // Cypher code to send to API as GET request from neo4j database
    const query = 'MATCH (n) -[r]-> (m) RETURN n, r, m'
    
    //'MATCH (n) -[r]-> (m) RETURN n, r, m'

    //CREATE (ethan:PLAYER{name:"Ethan Brown", age: 28, number: 0, height: 1.91, weight: 91})

    // state containing latest neo4j query results
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
    };

    // re-render graph when queryResult state changes
    useEffect(() => {
        if (queryResult) {
            drawGraph(queryResult);
        }
    }, [queryResult]);

 return (
  <Fragment>
    <div style={{display:'flex', gap: '12px'}}>
        <button style={{height: '32px'}} onClick={() => {apiCall(query)}}>Generate Graph</button>
        <p>Query: {query}</p>
    </div>
    <div ref={graphRef} style={{width: '100%', height: '80vh', border:'3px solid black'}}>
    </div>
  </Fragment>
 )
}

export default GraphTest

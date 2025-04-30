import { useState, useEffect } from "react";
import OutputWindow from "./OutputWindow";
import TaxSelect from "./SearchFields/TaxSelect";
import LocationParams from "./SearchFields/LocationParams";
import DatasetSelect from "./SearchFields/DatasetSelect";
import TimeOptions from "./SearchFields/TimeOptions";
import { Marker } from "react-leaflet/Marker";
import L from "leaflet";
import marker from "../assets/map-marker.svg";
import { Popup } from "react-leaflet/Popup";
import { process_neo4j_data } from "../Functions/process_neo4j_data";
import { query_to_cypher } from "../Functions/query_to_cypher";
import { QueryResultContext } from "../Context/QueryResultContext";
import { MarkerContext } from "../Context/MarkerContext";
import { SelectionDetailsContext } from "../Context/SelectionDetailsContext";
import ChatbotWindow from './ChatbotWindow';

// const [showChat, setShowChat] = useState(false);


function QueryFields() {


    // default leaflet map marker
    const myIcon = new L.Icon({
        iconUrl: marker,
        iconRetinaUrl: marker,
        popupAnchor:  [-0, -0],
        iconSize: [26, 40],     
    });

    const [showChat, setShowChat] = useState(false);


    // hold query parameters to be used in API call
    // if you change structure of this object, make sure
    // to update the query_to_cypher.js function accordingly
    const [query, setQuery] = useState({
        fromYear: "",
        toYear: "",
        fromMonth: "",
        toMonth: "",
        fromDay: "",
        toDay: "",
        species: [],
        genus: [],
        family: [],
        order: [],
        tax_class: [],
        sites: [],
        states: [],
        counties: [],
        minLat: '',
        maxLat: '',
        minLon: '',
        maxLan: '',
        datasets: []
    });
    
    // state containing latest neo4j query results and the last query
    const [queryResult, setQueryResult] = useState(null);

    // state for map-view markers    
    const position = [41.7, -86.23];
    const [markers, setMarkers] = useState(
        [
            <Marker key = {"Marker0"} position={position} icon={myIcon}>
                <Popup>
                    Your search results will <br /> be mapped here.
                </Popup>
            </Marker>
        ]
    );

    // state to hold information of last node/edge clicked on by user
    const [selectionDetails, setSelectionDetails] = useState(
        <div className='selectionDetails'>
            <h5>{'CLICK ON AN EDGE OR NODE\nTO VIEW DETAILS'}</h5>
        </div>
    );

    // temporary state to hold multi-select selections
    const [tempMulti, setTempMulti] = useState({
        speciesTemp: [],
        genusTemp: [],
        familyTemp: [],
        orderTemp: [],
        classTemp: [],
        sitesTemp: [],
        statesTemp: [],
        countiesTemp: [],
        datasetsTemp: []
    });

    const [searchOptions, setSearchOptions] = useState({
        speciesOptions: [],
        genusOptions: [],
        familyOptions: [],
        orderOptions: [],
        classOptions: [],
        siteOptions: [],
        stateOptions: [],
        countyOptions: [],
        datasetOptions:[],
    });

        

    useEffect(() => {

        // in prod change 'localhost:8080' to 'kn-wildlife.crc.nd.edu'
        fetch("https://kn-wildlife.crc.nd.edu/test_api/neo4j_search_options/", {
            method: 'GET', 
            headers: {
                'Content-Type': 'application/json', 
                'Accept': 'application/json', 
              }
          })
            .then((response) => {
              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
              }
              return response.json();
            })
            .then((data) => {
              setSearchOptions((prev) => {
                const res = data.result;
      
                if (res !== undefined) {
                  return {
                    ...prev,
                    speciesOptions: res.speciesOptions.map((item) => ({
                      value: item,
                      label: item
                    })),
                    genusOptions: res.genusOptions.map((item) => ({
                      value: item,
                      label: item
                    })),
                    familyOptions: res.familyOptions.map((item) => ({
                      value: item,
                      label: item
                    })),
                    orderOptions: res.orderOptions.map((item) => ({
                      value: item,
                      label: item
                    })),
                    classOptions: res.classOptions.map((item) => ({
                      value: item,
                      label: item
                    })),
                    stateOptions: res.stateOptions.map((item) => ({
                      value: item,
                      label: item
                    })),
                    countyOptions: res.countyOptions.map((item) => ({
                      value: item,
                      label: item
                    })),
                    siteOptions: res.siteOptions.map((item) => ({
                      value: item,
                      label: item
                    })),
                  };
                }
      
                console.log("Issue retrieving search options.");
                return { ...prev };
              });
            })
            .catch((err) => {
              console.error("Fetch error:", err);
              setSearchOptions((prev) => prev);
            });

    }, []);


    const [isLoading, setIsLoading] = useState(false);

    function handleChange(e) {
        const {name, checked, type, value} = e.target;

        // handle special cases for numerical input
        const numerical = ['minLat', 'maxLat', "minLon", 'maxLon'];

        let numValue = undefined;
        
        if (numerical.includes(name) && value === "-" || value === "." || !isNaN(Number(value))) {
            numValue = value;
        }


        setQuery((prev) => {
            return {
                ...prev,
                [name]: type === "checkbox" ? checked : numerical.includes(name) ? numValue !== undefined ? numValue : '' : value
            };
        });
        
        if (name === "taxLevel") {
            setIsLoading(true)
        };
    };

    function handleMultiChange(selections, category) {
        setTempMulti((prev) => {
            return {
                ...prev,
                [category]: selections
            };
        });
        setQuery((prev) => {
            return {
                ...prev,
                [category.replace("Temp", '')]: selections.length !== 0 ? 
                    selections.map((s) => {
                        return s.value
                    }) :
                    []
            };
        });
    };
    
    //send a query (Cypher code) to neo4j API 
    const apiCall = (query) => {

        setIsLoading(true);

        const cypher = query_to_cypher(query);

        console.log(cypher);

        // in prod change 'localhost:8080' to 'kn-wildlife.crc.nd.edu'
        const call = `http://localhost:8080/test_api/neo4j_get/${encodeURIComponent(cypher)}`;


        fetch(call, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json', 
                'Accept': 'application/json', 
              }
          })
            .then((response) => {
              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
              }
              return response.json();
            })
            .then((data) => {
              if (data !== undefined) {
                const res = process_neo4j_data(data.result);
                console.log(res);
                setQueryResult(res);
                setIsLoading(false);
              }
            })
            .catch((error) => {
              console.error('Fetch error:', error);
              setIsLoading(false); // Optional: stop loading on error too
            });
    }


    return ( 
        <div className="searchContainer">
            <div className="queryfields">
                <TaxSelect
                    handleChange={handleChange}
                    handleMultiChange={handleMultiChange} 
                    searchOptions={searchOptions} 
                    isLoading={isLoading} 
                    tempMulti={tempMulti}
                    query={query}
                />
                <LocationParams
                    handleMultiChange={handleMultiChange} 
                    searchOptions={searchOptions} 
                    isLoading={isLoading} 
                    tempMulti={tempMulti}
                    query={query}
                    handleChange={handleChange}
                />
                <TimeOptions
                    handleChange={handleChange}
                    query={query}
                    isLoading={isLoading}
                />
                <DatasetSelect
                    handleMultiChange={handleMultiChange} 
                    searchOptions={searchOptions} 
                    isLoading={isLoading} 
                    tempMulti={tempMulti}
                    query={query}
                    handleChange={handleChange}
                />
                <button onClick={() => apiCall(query)}>Generate Results</button>
            </div>
            <QueryResultContext.Provider value={queryResult}>
            <MarkerContext.Provider value={[markers, setMarkers]}>
                <SelectionDetailsContext.Provider value={[selectionDetails, setSelectionDetails]}>
                <OutputWindow query={query} />
                {/* 💬 Chatbot toggle button */}
                <div
                    style={{
                    position: 'fixed',
                    bottom: '20px',
                    right: '20px',
                    backgroundColor: '#007bff',
                    borderRadius: '50%',
                    width: '60px',
                    height: '60px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    color: 'white',
                    fontSize: '30px',
                    cursor: 'pointer',
                    zIndex: 1000
                    }}
                    onClick={() => setShowChat(prev => !prev)}
                >
                    💬
                </div>

                {showChat && <ChatbotWindow onClose={() => setShowChat(false)} /> }
                </SelectionDetailsContext.Provider>
            </MarkerContext.Provider>
            </QueryResultContext.Provider>
        </div>
     );
};

export default QueryFields;
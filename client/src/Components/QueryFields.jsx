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
        iconAnchor: [10, 35],
        popupAnchor:  [-0, -0],
        iconSize: [20, 35],     
    });

    const [showChat, setShowChat] = useState(false);

    const [errorMessage, setErrorMessage] = useState(<p className="errorMessage" style={{height:'0vh', margin: '0', padding: '0'}}></p>);


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
        maxLon: '',
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
        const latVals = ['minLat', 'maxLat'];
        const lonVals = ['minLon', 'maxLon'];

        let coordValue = undefined;
        
        if ((latVals.includes(name) || lonVals.includes(name)) && value === "-" || value === "." || !isNaN(Number(value))) {
            coordValue = value;

            if(value !== "-" && value !== ".") {

                coordValue = Number(value);

                // handle latitude values
                if(latVals.includes(name)) {
                  coordValue = coordValue > 90 ? 90 : coordValue < -90 ? -90 : coordValue;
                }

                // handle longitude values
                if(lonVals.includes(name)) {
                  coordValue = coordValue > 180 ? 180 : coordValue < -180 ? -180 : coordValue;
                }

            }
        }


        setQuery((prev) => {
            return {
                ...prev,
                [name]: type === "checkbox" ? checked : (latVals.includes(name) || lonVals.includes(name)) ? coordValue !== undefined ? coordValue : '' : value
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

        // check for issues with coordinate range
        if ((query.minLat !== '' && query.maxLat !== '' && query.minLat > query.maxLat) ||
              (query.minLon !== '' && query.maxLon !== '' && query.minLon > query.maxLon)) {
          setErrorMessage(<p className="errorMessage">ERROR: Minimum latitude/longitude cannot be greater than maximum latitude/longitude.</p>);
          return;
        }


        setIsLoading(true);

        const cypher = query_to_cypher(query);

        console.log(cypher);
        console.log(query);

        // in prod change 'localhost:8080' to 'kn-wildlife.crc.nd.edu'
        const call = `https://kn-wildlife.crc.nd.edu/test_api/neo4j_get/${encodeURIComponent(cypher)}`;


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
                
                if (res.length !== 0) {                  
                  setErrorMessage(<p className="errorMessage" style={{height:'0vh', margin: '0', padding: '0'}}></p>);
                } else {
                  setErrorMessage(<p className="errorMessage">WARNING: Search retrived zero results. Try adjusting search criteria.</p>)
                }
              }
            })
            .catch((error) => {
              console.error('Fetch error:', error);
              setIsLoading(false); // Optional: stop loading on error too
              setErrorMessage(<p className="errorMessage">ERROR: Issue retrieving data.</p>);
            });
    };


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
                {errorMessage && errorMessage}
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
import { useState, useEffect, useMemo } from "react";
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
import CovariateSelection from "./SearchFields/CovariateSelection";
import { MapDataContext } from "../Context/MapDataContext";
import { MetadataContext } from "../Context/MetadataContext";
import { SearchOptionsContext } from "../Context/SearchOptionsContext";
import ReactGA from 'react-ga4';
import { filterSearchOptions } from "../Functions/filterSearchOptions";

// const [showChat, setShowChat] = useState(false);


function QueryFields() {


    // default leaflet map marker
    const myIcon = new L.Icon({
        iconUrl: marker,
        iconRetinaUrl: marker,
        iconAnchor: [10, 35],
        popupAnchor:  [-0, -35],
        iconSize: [20, 35],     
    });

    const [showChat, setShowChat] = useState(false);

    const [errorMessage, setErrorMessage] = useState(<p className="errorMessage" style={{height:'0vh', margin: '0', padding: '0'}}></p>);
    const [warningMessage, setWarningMessage] = useState(<p className="warningMessage" style={{height:'0vh', margin: '0', padding: '0'}}></p>);


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
        datasets: [],
        dataTypes: [],
        taxHier: false,
        locHier: false,
        covars: []
    });

    
    // state containing latest neo4j query results and the last query
    const [queryResult, setQueryResult] = useState(null);
    const [mapData, setMapData] = useState(null);
    const [metadata, setMetadata] = useState(null);
    const [data, setData] = useState(null);

    // get list of covariates from the last search
    const [returnedCovars, setReturnedCovars] = useState([]);
    
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
        tax_classTemp: [],
        sitesTemp: [],
        statesTemp: [],
        countiesTemp: [],
        datasetsTemp: [],
        dataTypesTemp: [],
        covarsTemp: []
    });

    // for search options, one state variable (searchOptionsMaster) will hold the "complete" object returned from the `neo4j_search_options()` call
    // and the other (searchOptions) hold the filtered subset of search options to be displayed in the selection dropdowns

    const searchObjectTemplate = {
        speciesOptions: [],
        genusOptions: [],
        familyOptions: [],
        orderOptions: [],
        classOptions: [],
        siteOptions: [],
        stateOptions: [],
        countyOptions: [],
        datasetOptions: [],
        covarOptions: [],
        taxMap: [],
        locMap: []
    }

    const [searchOptionsMaster, setSearchOptionsMaster] = useState(searchObjectTemplate)
    
    // the second useEffect hook applies the filterSearchOptions() funtion to searchOptions whenever the query state changes
    const searchOptions = useMemo(() => {
      return filterSearchOptions(searchOptionsMaster, query);
    }, [searchOptionsMaster, query])
        

    useEffect(() => {

      setIsLoading(true);

        // in prod change 'http://localhost:8080' to 'https://kn-wildlife.crc.nd.edu'
        fetch(`https://kn-wildlife.crc.nd.edu/test_api/neo4j_search_options/`, {
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
              setSearchOptionsMaster((prev) => {
                const res = data.result;
      
                if (res !== undefined) {
                  return {
                    ...prev,
                    speciesOptions: res.speciesOptions,
                    genusOptions: res.genusOptions,
                    familyOptions: res.familyOptions,
                    orderOptions: res.orderOptions,
                    classOptions: res.classOptions,
                    stateOptions: res.stateOptions,
                    countyOptions: res.countyOptions,
                    siteOptions: res.siteOptions,
                    datasetOptions: res.datasetOptions,
                    covarOptions: res.covarOptions,
                    taxMap: res.taxMap,
                    locMap: res.locMap
                  };
                }
      
                setErrorMessage("Issue retrieving search options.");
                return { ...prev };
              });              
              setIsLoading(false);
            })
            .catch((err) => {
              console.error("Fetch error:", err);
              setSearchOptionsMaster((prev) => prev);
              setIsLoading(false);
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

        // warnings related to time range selection
        if (([query.toDay, query.toMonth, query.toYear].some(x => x !== "") && [query.toDay, query.toMonth, query.toYear].some(x => x === "")) || 
              ([query.fromDay, query.fromMonth, query.fromYear].some(x => x !== "") && [query.fromDay, query.fromMonth, query.fromYear].some(x => x === ""))) {
                
            if ([query.toDay, query.toMonth, query.toYear].some(x => x !== "") && [query.toDay, query.toMonth, query.toYear].some(x => x === "")) {
              setWarningMessage(<p className="warningMessage">{"WARNING: \"Time Range: 'To'\" options not applied unless Year, Month, AND Day are selected"} </p>)
            }

            if ([query.fromDay, query.fromMonth, query.fromYear].some(x => x !== "") && [query.fromDay, query.fromMonth, query.fromYear].some(x => x === "")) {
              setWarningMessage(<p className="warningMessage">{"WARNING: \"Time Range: 'From'\" options not applied unless Year, Month, AND Day are selected"} </p>)
            }

            if (([query.toDay, query.toMonth, query.toYear].some(x => x !== "") && [query.toDay, query.toMonth, query.toYear].some(x => x === "")) && 
                  ([query.fromDay, query.fromMonth, query.fromYear].some(x => x !== "") && [query.fromDay, query.fromMonth, query.fromYear].some(x => x === ""))) {
              setWarningMessage(<p className="warningMessage">{"WARNING: \"Time Range: 'To' and 'From'\" options not applied unless Year, Month, AND Day are selected"} </p>)
            }

        }

        setIsLoading(true);

        const {knString, csvString, mapString, metaString} = query_to_cypher(query);

        const url = 'https://kn-wildlife.crc.nd.edu/test_api/neo4j_get';

        const body = {
          knString,
          csvString,
          mapString,
          metaString
        };

          fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify(body),
          })
            .then((response) => {
              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
              }
              return response.json();
            })
            .then((data) => {

              if (data !== undefined) {
                // log that a user has successfully queried data
                ReactGA.event({
                  category: "user data search",
                  action: "successful query",
                  label: "query"
                });
                const res = process_neo4j_data(data.result.vis);

                const dat = data.result.csv;

                const mapDat = data.result.map;

                const metaDat = data.result.meta.map((item) => {

                  if (typeof item["downloadDate"] === 'object') {

                    const x = item["downloadDate"];

                    const year = x.year.low.toString();
                    const month = x.month.low.toString().length === 1 ? "0" + x.month.low.toString() : x.month.low.toString();
                    const day = x.day.low.toString().length === 1 ? "0" + x.day.low.toString() : x.day.low.toString();

                      
                    item["downloadDate"] =  [year,month,day].join("-");

                  }

                  return item;

 
                });

                setMetadata(metaDat);
                setQueryResult(res);
                setMapData(mapDat);
                setData(dat);
                setReturnedCovars(Array.from(new Set(query.covars.map((x) => x.match(/^[^_]+/)).flat())));
                
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
              <SearchOptionsContext.Provider value={searchOptions}>
                  <TaxSelect
                      handleChange={handleChange}
                      handleMultiChange={handleMultiChange}
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
                  <CovariateSelection
                      handleMultiChange={handleMultiChange} 
                      searchOptions={searchOptions} 
                      isLoading={isLoading} 
                      tempMulti={tempMulti}
                      query={query}
                      handleChange={handleChange}
                  />
                </SearchOptionsContext.Provider>
                {errorMessage && errorMessage}
                {warningMessage && warningMessage}
                <button onClick={() => apiCall(query)}>Generate Results</button>
            </div>
            <MetadataContext.Provider value={metadata}>
              <QueryResultContext.Provider value={queryResult}>
                <MapDataContext.Provider value={mapData}>
                  <MarkerContext.Provider value={[markers, setMarkers]}>
                      <SelectionDetailsContext.Provider value={[selectionDetails, setSelectionDetails]}>
                      <OutputWindow data={data} isLoading={isLoading} result={queryResult} returnedCovars={returnedCovars}/>
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
                </MapDataContext.Provider>
              </QueryResultContext.Provider>
            </MetadataContext.Provider>
        </div>
     );
};

export default QueryFields;
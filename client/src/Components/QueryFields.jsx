import { useState, useEffect, useMemo, useRef, useContext } from "react";
import OutputWindow from "./OutputWindow";
import TaxSelect from "./SearchFields/TaxSelect";
import LocationParams from "./SearchFields/LocationParams";
import DatasetSelect from "./SearchFields/DatasetSelect";
import TimeOptions from "./SearchFields/TimeOptions";
import { Marker } from "react-leaflet/Marker";
import L from "leaflet";
import marker from "../assets/map-marker.svg";
import { Popup } from "react-leaflet/Popup";
import { query_to_cypher } from "../Functions/query_to_cypher";
import { MarkerContext } from "../Context/MarkerContext";
import ChatbotWindow from './ChatbotWindow';
import CovariateSelection from "./SearchFields/CovariateSelection";
import SearchSection from "./SearchFields/SearchSection";
import { chips_to_query_fields, RANK_TO_QUERY_FIELD } from "../Functions/build_chip_options";
import { MapDataContext } from "../Context/MapDataContext";
import { MetadataContext } from "../Context/MetadataContext";
import { SearchOptionsContext } from "../Context/SearchOptionsContext";
import * as analytics from '../Functions/analytics';
import { filterSearchOptions } from "../Functions/filterSearchOptions";
import { getToken, API_BASE } from "../Functions/api";
import { AuthContext } from "../Context/AuthContext";

// const [showChat, setShowChat] = useState(false);


function QueryFields() {

    // Retrieving records needs an account; browsing the search options does not.
    const { user, promptSignIn } = useContext(AuthContext);


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
        phyla: [],
        kingdoms: [],
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
    const [mapData, setMapData] = useState(null);
    const [metadata, setMetadata] = useState(null);
    const [data, setData] = useState(null);

    // get list of covariates from the last search
    const [returnedCovars, setReturnedCovars] = useState([]);

    // cache of raw API responses keyed by the exact cypher query sent, capped at
    // MAX_CACHED_QUERIES since responses for large data pulls can be sizable
    const queryCacheRef = useRef(new Map());
    const MAX_CACHED_QUERIES = 5;
    
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

    // The taxa and places chosen as chips. These are the search UI's own state; they are
    // translated into the per-rank query arrays below, so the Cypher builder and the API
    // contract stay exactly as they were and only the way a user expresses a search changed.
    const [taxonChips, setTaxonChips] = useState([]);
    const [placeChips, setPlaceChips] = useState([]);

    // Chips are unioned, which is the only reading that makes sense across taxa, so the
    // hierarchical modes the old per-rank dropdowns needed are held off permanently rather
    // than being surfaced as a control nobody could interpret.
    const applyTaxonChips = (chips) => {
        setTaxonChips(chips);
        const grouped = chips_to_query_fields(chips, RANK_TO_QUERY_FIELD);
        setQuery((prev) => ({
            ...prev,
            species: grouped.species,
            genus: grouped.genus,
            family: grouped.family,
            order: grouped.order,
            tax_class: grouped.tax_class,
            kingdoms: grouped.kingdoms,
            phyla: grouped.phyla,
            taxHier: false,
        }));
    };

    const applyPlaceChips = (chips) => {
        setPlaceChips(chips);
        setQuery((prev) => ({
            ...prev,
            states: chips.filter((chip) => chip.rank === "state").map((chip) => chip.name),
            counties: chips.filter((chip) => chip.rank === "county").map((chip) => chip.name),
            locHier: false,
        }));
    };

    // temporary state to hold multi-select selections
    const [tempMulti, setTempMulti] = useState({
        speciesTemp: [],
        genusTemp: [],
        familyTemp: [],
        orderTemp: [],
        tax_classTemp: [],
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

        fetch(`${API_BASE}/test_api/neo4j_search_options/`, {
            method: 'GET', 
            headers: {
                'Content-Type': 'application/json', 
                'Accept': 'application/json',
                ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
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

        if (latVals.includes(name) || lonVals.includes(name)) {

            // an empty box means "no filter" and must stay '', not fall through to Number('') === 0;
            // "-"/"." alone and a trailing "." (e.g. "43.") are valid mid-typing states that aren't
            // complete numbers yet, so they're kept as-is rather than clamped/coerced
            if (value !== '' && !/^-?\d*\.?\d*$/.test(value)) {
                return;
            }

            let coordValue = value;

            if (value !== '' && value !== '-' && !value.endsWith('.')) {

                coordValue = Number(value);

                // handle latitude values
                if (latVals.includes(name)) {
                  coordValue = coordValue > 90 ? 90 : coordValue < -90 ? -90 : coordValue;
                }

                // handle longitude values
                if (lonVals.includes(name)) {
                  coordValue = coordValue > 180 ? 180 : coordValue < -180 ? -180 : coordValue;
                }

            }

            setQuery((prev) => {
                return {
                    ...prev,
                    [name]: coordValue
                };
            });

            return;
        }

        setQuery((prev) => {
            return {
                ...prev,
                [name]: type === "checkbox" ? checked : value
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

        if (!user) {
            promptSignIn();
            return;
        }

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

        const {cypherQuery} = query_to_cypher(query);

        // A search with no criteria builds no query, because it would ask for every record in
        // the graph. Say so here; the server has nothing to answer with.
        if (!cypherQuery) {
          setErrorMessage(
            <p className="errorMessage">
              Choose at least one search criterion: a taxon, a place, a coordinate range, a
              time range, or a dataset.
            </p>
          );
          return;
        }

        setIsLoading(true);
        const cached = queryCacheRef.current.get(cypherQuery);

        if (cached !== undefined) {
          applyResult(cached, query, { cached: true });
          return;
        }

        const url = `${API_BASE}/test_api/neo4j_get`;

        const searchDescription = analytics.describeSearch(query, taxonChips, placeChips);

        const body = {
          cypherQuery,
          // What the search asked for, in counts and flags. The server stores this beside the
          // account so a retrieval can be attributed later; it holds no taxon or place names.
          filters: searchDescription
        };

          fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
                ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
              },
            body: JSON.stringify(body),
          })
            .then(async (response) => {
              if (!response.ok) {
                // the route sends an explanatory message for a search too large to assemble,
                // which is more actionable to the user than the status code alone
                const detail = await response.json().catch(() => null);
                const err = new Error(`HTTP error! status: ${response.status}`);
                err.detail = detail && detail.error;
                throw err;
              }
              return response.json();
            })
            .then((data) => {

              if (data !== undefined) {

                // cache the raw response, evicting the oldest entry once past the cap
                queryCacheRef.current.set(cypherQuery, data);

                if (queryCacheRef.current.size > MAX_CACHED_QUERIES) {
                  const oldestKey = queryCacheRef.current.keys().next().value;
                  queryCacheRef.current.delete(oldestKey);
                }

                applyResult(data, query, { cached: false });
              }
            })
            .catch((error) => {
              console.error('Fetch error:', error);
              // A refused search is worth counting too; most refusals are a search too large
              // to assemble, which says the interface let someone ask for too much.
              analytics.searchFailed({
                description: searchDescription,
                reason: error.detail ? 'too_large' : 'error',
              });
              setIsLoading(false); // Optional: stop loading on error too
              setErrorMessage(
                <p className="errorMessage">
                  {error.detail ? `ERROR: ${error.detail}` : 'ERROR: Issue retrieving data.'}
                </p>
              );
            });
    };

    // The search behind the result currently on screen, kept so a download can describe what
    // it contains. Held in a ref because nothing renders from it.
    const lastSearchRef = useRef(null);

    // shared handling for both a fresh API response and a cache hit for an identical query
    function applyResult(data, query, { cached = false } = {}) {

        // Counted with what the search contained and how much it returned, and marked when it
        // came from the cache: an identical search repeated five times is one trip to the
        // database, and counting all five as queries overstates the load.
        lastSearchRef.current = analytics.describeSearch(query, taxonChips, placeChips);
        analytics.searchRun({
            description: lastSearchRef.current,
            rows: Array.isArray(data?.result?.csv) ? data.result.csv.length : 0,
            cached,
        });
        // The server answers with a null result when it has nothing to return. Reading the
        // rows off it directly ends the search in a TypeError, so the absence is checked here.
        if (!data || !data.result) {
          setIsLoading(false);
          setErrorMessage(
            <p className="errorMessage">
              WARNING: Search retrived zero results. Try adjusting search criteria.
            </p>
          );
          return;
        }

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
        setMapData(mapDat);
        setData(dat);
        // Name the source of each selected covariate, so the download credits it. This used
        // to take the text before the first underscore in the property name, which worked
        // only while every covariate property happened to be prefixed with its source.
        // The source now comes from the CovariateSource node the covariate is linked to.
        setReturnedCovars(Array.from(new Set(
            query.covars
                .map((key) => {
                    const declared = searchOptions.covarOptions.find((option) => option.value === key);
                    // sourceKey is the short name the disclaimers file is keyed by
                    return declared?.sourceKey || declared?.source || key.match(/^[^_]+/)?.[0];
                })
                .filter(Boolean)
        )));

        setIsLoading(false);

        if (dat.length !== 0) {
          setErrorMessage(<p className="errorMessage" style={{height:'0vh', margin: '0', padding: '0'}}></p>);
        } else {
          setErrorMessage(<p className="errorMessage">WARNING: Search retrived zero results. Try adjusting search criteria.</p>)
        }
    };


    // How many criteria each collapsed group currently holds, so a section that is shaping
    // the results says so from its header, whether or not it is open. The count comes from the
    // committed query, which is what a search will actually use, and a coordinate box or a
    // date bound counts as one criterion each.
    const filled = (values) => (Array.isArray(values) ? values.length : 0);
    const set = (value) => (value !== "" && value !== null && value !== undefined ? 1 : 0);

    const activeCounts = {
        taxonomy: taxonChips.length,
        location: placeChips.length
            + set(query.minLat) + set(query.maxLat) + set(query.minLon) + set(query.maxLon),
        time: set(query.fromYear) + set(query.toYear) + set(query.fromMonth)
            + set(query.toMonth) + set(query.fromDay) + set(query.toDay),
        datasets: filled(query.datasets) + filled(query.dataTypes),
        covariates: filled(query.covars),
    };

    // What a search can be built from. Covariates are left out: they add columns to a result
    // and cannot select records, so choosing only covariates builds no query.
    const hasCriteria = activeCounts.taxonomy + activeCounts.location
        + activeCounts.time + activeCounts.datasets > 0;

    return (
        <div className="searchContainer">
            <div className="queryfields">              
              <SearchOptionsContext.Provider value={searchOptions}>
                  <SearchSection title="Taxonomy" activeCount={activeCounts.taxonomy}>
                      <TaxSelect
                          isLoading={isLoading}
                          taxonChips={taxonChips}
                          onTaxonChipsChange={applyTaxonChips}
                      />
                  </SearchSection>
                  <SearchSection title="Location" activeCount={activeCounts.location}>
                      <LocationParams
                          isLoading={isLoading}
                          query={query}
                          handleChange={handleChange}
                          placeChips={placeChips}
                          onPlaceChipsChange={applyPlaceChips}
                      />
                  </SearchSection>
                  <SearchSection title="Time period" activeCount={activeCounts.time}>
                      <TimeOptions
                          handleChange={handleChange}
                          query={query}
                          isLoading={isLoading}
                      />
                  </SearchSection>
                  <SearchSection title="Datasets" activeCount={activeCounts.datasets}>
                      <DatasetSelect
                          handleMultiChange={handleMultiChange}
                          searchOptions={searchOptions}
                          isLoading={isLoading}
                          tempMulti={tempMulti}
                          query={query}
                          handleChange={handleChange}
                      />
                  </SearchSection>
                  <SearchSection title="Covariates" activeCount={activeCounts.covariates}>
                      <CovariateSelection
                          handleMultiChange={handleMultiChange}
                          searchOptions={searchOptions}
                          isLoading={isLoading}
                          tempMulti={tempMulti}
                          query={query}
                          handleChange={handleChange}
                      />
                  </SearchSection>
                </SearchOptionsContext.Provider>
                {errorMessage && errorMessage}
                {warningMessage && warningMessage}
                <button type="button" className="generate--button"
                        onClick={() => apiCall(query)}
                        disabled={isLoading || !hasCriteria}
                        title={hasCriteria ? undefined
                            : "Choose a taxon, a place, a time period or a dataset first"}>
                    {isLoading ? "Searching..." : "Generate Results"}
                </button>
            </div>
            <MetadataContext.Provider value={metadata}>
                <MapDataContext.Provider value={mapData}>
                  <MarkerContext.Provider value={[markers, setMarkers]}>
                      <OutputWindow data={data} isLoading={isLoading}
                                    returnedCovars={returnedCovars}
                                    searchDescription={lastSearchRef.current}/>
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
                  </MarkerContext.Provider>
                </MapDataContext.Provider>
            </MetadataContext.Provider>
        </div>
     );
};

export default QueryFields;
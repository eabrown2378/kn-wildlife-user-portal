import { useState, useEffect } from "react";
import axios from "axios";
import OutputWindow from "./OutputWindow";
import TaxSelect from "./SearchFields/TaxSelect";
import LocationParams from "./SearchFields/LocationParams";
import TimeOptions from "./SearchFields/TimeOptions";
import states from "../data/states.json";
import counties from "../data/counties.json";
//import {generateSearchRequest} from "../functions/generateSearchRequest";


function QueryFields() {

    function onlyUnique(value, index, array) {
        return array.indexOf(value) === index;
    };

    // hold query parameters to be used in API call
    // if you change structure of this object, make sure to modify the paramChain
    // in rAPI.js accordingly
    const [query, setQuery] = useState({
        taxExclude: false,
        siteExclude: true,
        fromYear: "",
        toYear: "",
        fromMonth: "",
        toMonth: "",
        fromDay: "",
        toDay: "",
        taxLevel: "genus",
        species: ['all'],
        genus: ['all'],
        family: ['all'],
        order: ['all'],
        class: ['all'],
        phylum: ['all'],
        sites: ['all'],
        states: ['all'],
        counties: ['all'],
        minLat: null,
        maxLat: null,
        minLon: null,
        maxLan: null
    });

    useEffect(() => {
        console.log(query)
    }, [query])


    const [graphics, setGraphics] = useState([<h2>Graphs/Maps/Summary stats will appear here</h2>]);
    const [results, setResults] = useState([]);

    // temporary state to hold multi-select selections
    const [tempMulti, setTempMulti] = useState({
        speciesTemp: [],
        genusTemp: [],
        familyTemp: [],
        orderTemp: [],
        classTemp: [],
        phylumTemp: [],
        sitesTemp: [],
        statesTemp: [],
        countiesTemp: []
    });

    const [searchOptions, setSearchOptions] = useState({
        speciesOptions: [],
        genusOptions: [],
        familyOptions: [],
        orderOptions: [],
        classOptions: [],
        phylumOptions: [],
        siteOptions: [],
        stateOptions: [],
        countyOptions: []
    });

    const [isLoading, setIsLoading] = useState(false);

    // call to change options on load or when risk checkbox is toggled
    useEffect(() => {

         setSearchOptions({
/*             taxaOptions: metaData.map((item) => {
                    return item.taxa.split('|');
            }).flat().filter(onlyUnique).map((item) => {
                return {value: item, label: item};
            }),
            siteOptions: metaData.map((item) => {
                    return {value: item.SiteName, label: item.SiteName};
            }).filter(Boolean), */
            stateOptions: states.map((item) => {
                return {value: item.abbreviation, label: `${item.name} (${item.abbreviation})`};
            }),
            countyOptions: counties.map((item) => {
                return {value: item.properties.NAME, label: item.properties.NAME}
            }).sort((a, b) => {
                return a.label.localeCompare(b.label);
             })
        });

        setTempMulti({
            speciesTemp: [],
            genusTemp: [],
            familyTemp: [],
            orderTemp: [],
            classTemp: [],
            phylumTemp: [],
            sitesTemp: []
        });

        setQuery((prev) => {
            return {
                ...prev,
                species: ['all'],
                genus: ['all'],
                family: ['all'],
                order: ['all'],
                class: ['all'],
                phylum: ['all'],
                sites: ['all']
            };
        });
        
        setIsLoading(false); 

    }, [query.taxLevel]);


    function handleChange(e) {
        const {name, checked, type, value} = e.target;

        setQuery((prev) => {
            return {
                ...prev,
                [name]: type === "checkbox" ? checked : type === 'number' ? !isNaN(Number(value))? Number(value) : null : value
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
                    ['all']
            };
        });
    };

    function handleSearch() {

/*         setIsLoading(true);

        const call = generateSearchRequest(query);

        console.log(call);
        
        axios
        .get(String(call))
        .then((res) => setResults(res.data.data[0] !== undefined ? JSON.parse(res.data.data) : []))
        .then(() => {
            console.log(results);
            setIsLoading(false);
        })
        .catch((err) => {
            console.log(err);
            setIsLoading(false);
        }) */

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
                <button onClick={handleSearch}>Generate Results</button>
            </div>
            <OutputWindow data={results} graphics={graphics}/>
        </div>
     );
};

export default QueryFields;
import { useState, useEffect } from "react";
import axios from "axios";
import OutputWindow from "./OutputWindow";
import TaxSelect from "./SearchFields/TaxSelect";
import LocationParams from "./SearchFields/LocationParams";
import TimeOptions from "./SearchFields/TimeOptions";
import states from "../data/states.json";
import counties from "../data/counties.json";
import { query_to_cypher } from "../functions/query_to_cypher";


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
        species: [],
        genus: [],
        family: [],
        order: [],
        class: [],
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


    const [results, setResults] = useState([]);

    // temporary state to hold multi-select selections
    const [tempMulti, setTempMulti] = useState({
        speciesTemp: [],
        genusTemp: [],
        familyTemp: [],
        orderTemp: [],
        classTemp: [],
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
        siteOptions: [],
        stateOptions: [],
        countyOptions: []
    });

        

    useEffect(() => {

        axios.get("http://localhost:8080/test_api/neo4j_search_options/", { crossDomain: true }).then((data) => {


            setSearchOptions((prev) => {
                
                const res = data.data.result;

                return {
                    ...prev,
                    speciesOptions: res.speciesOptions.map((item) => {
                        return {
                            value: item, 
                            label: item
                        }
                    }),
                    genusOptions: res.genusOptions.map((item) => {
                        return {
                            value: item, 
                            label: item
                        }
                    }),
                    familyOptions: res.familyOptions.map((item) => {
                        return {
                            value: item, 
                            label: item
                        }
                    }),
                    orderOptions: res.orderOptions.map((item) => {
                        return {
                            value: item, 
                            label: item
                        }
                    }),
                    classOptions: res.classOptions.map((item) => {
                        return {
                            value: item, 
                            label: item
                        }
                    }),
                }
            });
        });
    }, [])


    useEffect(() => {
        console.log(searchOptions)
    }, [searchOptions])

    const [isLoading, setIsLoading] = useState(false);

    // call to change options on load or when risk checkbox is toggled
    useEffect(() => {

         setSearchOptions((prev) => {
/*             taxaOptions: metaData.map((item) => {
                    return item.taxa.split('|');
            }).flat().filter(onlyUnique).map((item) => {
                return {value: item, label: item};
            }),
            siteOptions: metaData.map((item) => {
                    return {value: item.SiteName, label: item.SiteName};
            }).filter(Boolean), */
            return {
                ...prev,
                stateOptions: states.map((item) => {
                    return {value: item.abbreviation, label: `${item.name} (${item.abbreviation})`};
                }),
                countyOptions: counties.map((item) => {
                    return {value: item.properties.NAME, label: item.properties.NAME}
                }).sort((a, b) => {
                    return a.label.localeCompare(b.label);
                })
            }
        });

        setTempMulti({
            speciesTemp: [],
            genusTemp: [],
            familyTemp: [],
            orderTemp: [],
            classTemp: [],
            sitesTemp: []
        });

        setQuery((prev) => {
            return {
                ...prev,
                species: [],
                genus: [],
                family: [],
                order: [],
                class: [],
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
                    []
            };
        });
    };

    function handleSearch() {

        setIsLoading(true);

        const call = query_to_cypher(query);

        console.log(call)
        
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
            }) 

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
            <OutputWindow data={results} query={query}/>
        </div>
     );
};

export default QueryFields;
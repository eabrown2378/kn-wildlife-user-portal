

const filterSearchOptions = (options, query) => {  
       
        // TAXONOMIC SEARCH OPTIONS


        const taxOptions = query.taxHier || query.datasets.length > 0 ? options.taxMap.map((item) => {

        }) : options.taxMap;

        const locOptions = query.locHier || query.datasets.length > 0 ? options.locMap.map((item) => {

        }) : options.locMap;


        const search_options = {
            speciesOptions: (taxOptions.species.filter((value) => value !== null)).sort(),
            genusOptions: [...new Set(taxOptions.genus.filter((value) => value !== null))].sort(),
            familyOptions: [...new Set(taxOptions.family.filter((value) => value !== null))].sort(),
            orderOptions: [...new Set(taxOptions.order.filter((value) => value !== null))].sort(),
            classOptions: [...new Set(taxOptions.tax_class.filter((value) => value !== null))].sort(),
            stateOptions: [...new Set(locOptions.state.filter((value) => value !== null))].sort(),
            countyOptions: [...new Set(locOptions.county.filter((value) => value !== null))].sort(),
            // for some reason, neo4j is returning some site names as lists/arrays, so we need to resolve that:
            siteOptions: locOptions.site.map((record) => {
                                                if (Array.isArray(record)) {
                                                    return record.join("")
                                                } else {
                                                    return record
                                                }}).filter((value) => value !== null).sort(),
            datasetOptions: options.datasetOptions,
            covarOptions: options.covarOptions,
            taxMap: options.taxMap,
            locMap: options.locMap
        };

        //console.log(search_options);

        return search_options;

  };

  export { filterSearchOptions };
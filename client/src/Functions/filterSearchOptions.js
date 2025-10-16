

const filterSearchOptions = (options, query) => {  
       
        // TAXONOMIC SEARCH OPTIONS


        const taxOptions = query.taxHier || query.datasets.length > 0 ? options.taxMap.map((item) => {

            if (query.datasets.length > 0 && !query.datasets.some((dataset) => dataset === item.dataset)) {
                return null;
            }

            let res = {
                species: item.species,
                genus: item.genus,
                family: item.family,
                order: item.order,
                tax_class: item.tax_class
            };

            if (query.taxHier) {

                if (query.tax_class.length > 0 && !query.tax_class.some((x) => x === item.tax_class)) {
                    res['order'] = null;
                    res['family'] = null;
                    res['genus'] = null;
                    res['species'] = null;

                    return res;
                }

                if (query.order.length > 0 && !query.order.some((x) => x === item.order)) {
                    res['family'] = null;
                    res['genus'] = null;
                    res['species'] = null;

                    return res;
                }

                if (query.family.length > 0 && !query.family.some((x) => x === item.family)) {
                    res['genus'] = null;
                    res['species'] = null;

                    return res;
                }

                if (query.genus.length > 0 && !query.genus.some((x) => x === item.genus)) {
                    res['species'] = null;

                    return res;
                }

            }

            return res;

        }).filter(item => item !== null) : options.taxMap;

        const locOptions = query.locHier || query.datasets.length > 0 ? options.locMap.map((item) => {

            if (query.datasets.length > 0 && !query.datasets.some((dataset) => dataset === item.dataset)) {
                return null;
            }

            let res = {
                state: item.state,
                county: item.county,
                site: item.site
            };

            if (query.locHier) {

                if (query.states.length > 0 && !query.states.some((x) => x === item.state)) {
                    res['county'] = null;
                    res['site'] = null;

                    return res;
                }

                if (query.counties.length > 0 && !query.counties.some((x) => x === item.county)) {
                    res['site'] = null;

                    return res;
                }

            }

            return res;

        }).filter(item => item !== null) : options.locMap;


        const search_options = {
            speciesOptions: [...new Set(taxOptions.map(x => x.species).filter((value) => value !== null))].sort().map((item) => ({
                      value: item,
                      label: item
                    })),
            genusOptions: [...new Set(taxOptions.map(x => x.genus).filter((value) => value !== null))].sort().map((item) => ({
                      value: item,
                      label: item
                    })),
            familyOptions: [...new Set(taxOptions.map(x => x.family).filter((value) => value !== null))].sort().map((item) => ({
                      value: item,
                      label: item
                    })),
            orderOptions: [...new Set(taxOptions.map(x => x.order).filter((value) => value !== null))].sort().map((item) => ({
                      value: item,
                      label: item
                    })),
            classOptions: [...new Set(taxOptions.map(x => x.tax_class).filter((value) => value !== null))].sort().map((item) => ({
                      value: item,
                      label: item
                    })),
            stateOptions: [...new Set(locOptions.map(x => x.state).filter((value) => value !== null))].sort().map((item) => ({
                      value: item,
                      label: item
                    })),
            countyOptions: [...new Set(locOptions.map(x => x.county).filter((value) => value !== null))].sort().map((item) => ({
                      value: item,
                      label: item
                    })),
            siteOptions: [...new Set(locOptions.map(x => x.site).filter((value) => value !== null))].sort().map((item) => ({
                      value: item,
                      label: item
                    })),
            datasetOptions: options.datasetOptions.map((item) => ({
                      value: item,
                      label: item
                    })),
            covarOptions: options.covarOptions.map((item) => ({
                      value: item,
                      label: item
                    })),
            taxMap: options.taxMap,
            locMap: options.locMap
        };


        return search_options;

  };

  export { filterSearchOptions };


// build a sorted {value,label} option list from a Set of distinct values
const toOptionList = (set) => [...set].sort().map((item) => ({
    value: item,
    label: item
}));

const filterSearchOptions = (options, query) => {

        // TAXONOMIC SEARCH OPTIONS
        //
        // each level is added to its Set before checking whether that level's own filter
        // narrows the *next* level down: a level's dropdown should show every option
        // consistent with the levels above it, not narrow itself based on its own selection.

        const speciesSet = new Set();
        const genusSet = new Set();
        const familySet = new Set();
        const orderSet = new Set();
        const classSet = new Set();

        // Rows outside the chosen datasets, so the chip browser and its search index are
        // built from the same rows these per-rank dropdown lists are.
        const taxMapFiltered = [];

        for (const item of options.taxMap) {

            if (query.datasets.length > 0 && !query.datasets.includes(item.dataset)) {
                continue;
            }

            taxMapFiltered.push(item);

            if (item.tax_class !== null) classSet.add(item.tax_class);

            if (query.taxHier && query.tax_class.length > 0 && !query.tax_class.includes(item.tax_class)) {
                continue;
            }

            if (item.order !== null) orderSet.add(item.order);

            if (query.taxHier && query.order.length > 0 && !query.order.includes(item.order)) {
                continue;
            }

            if (item.family !== null) familySet.add(item.family);

            if (query.taxHier && query.family.length > 0 && !query.family.includes(item.family)) {
                continue;
            }

            if (item.genus !== null) genusSet.add(item.genus);

            if (query.taxHier && query.genus.length > 0 && !query.genus.includes(item.genus)) {
                continue;
            }

            if (item.species !== null) speciesSet.add(item.species);

        }

        // LOCATION SEARCH OPTIONS
        //
        // same hierarchy logic as above, applied to state/county/site

        const stateSet = new Set();
        const countySet = new Set();

        const locMapFiltered = [];

        for (const item of options.locMap) {

            if (query.datasets.length > 0 && !query.datasets.includes(item.dataset)) {
                continue;
            }

            locMapFiltered.push(item);

            if (item.state !== null) stateSet.add(item.state);

            if (query.locHier && query.states.length > 0 && !query.states.includes(item.state)) {
                continue;
            }

            if (item.county !== null) countySet.add(item.county);

        }

        const search_options = {
            speciesOptions: toOptionList(speciesSet),
            genusOptions: toOptionList(genusSet),
            familyOptions: toOptionList(familySet),
            orderOptions: toOptionList(orderSet),
            classOptions: toOptionList(classSet),
            stateOptions: toOptionList(stateSet),
            countyOptions: toOptionList(countySet),
            // The server sends each dataset's credit and provenance so the "about the data"
            // window and the download attribution read from the graph. A plain string is
            // accepted too, for a server that does not send them.
            datasetOptions: options.datasetOptions.map((item) =>
                typeof item === "string"
                    ? { value: item, label: item }
                    : {
                        value: item.name,
                        label: item.name,
                        program: item.program,
                        agency: item.agency,
                        dataTypes: item.dataTypes,
                        downloadDate: item.downloadDate,
                        retrievedVia: item.retrievedVia,
                        citations: item.citations,
                        urls: item.urls,
                        notes: item.notes
                      }),
            // The server sends covariate declarations, so the dropdown shows a readable label
            // while the query uses the property key. A plain string is accepted too, for a
            // server that does not send declarations.
            covarOptions: options.covarOptions.map((item) =>
                typeof item === "string"
                    ? { value: item, label: item }
                    : {
                        value: item.key,
                        label: item.label || item.key,
                        shortLabel: item.shortLabel || item.label || item.key,
                        group: item.group,
                        temporalScope: item.temporalScope,
                        bioclimEquivalent: item.bioclimEquivalent,
                        sourceUrls: item.sourceUrls,
                        units: item.units,
                        description: item.description,
                        source: item.source,
                        sourceKey: item.sourceKey,
                        citation: item.citation,
                        licence: item.licence,
                        disclaimer: item.disclaimer,
                        usageCaution: item.usageCaution
                      }),
            // These are what the taxon and place chip browsers actually build their lists
            // from, so filtering has to happen here rather than only in the option lists
            // above, which nothing else reads.
            taxMap: taxMapFiltered,
            locMap: locMapFiltered
        };


        return search_options;

  };

  export { filterSearchOptions };



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

        for (const item of options.taxMap) {

            if (query.datasets.length > 0 && !query.datasets.includes(item.dataset)) {
                continue;
            }

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

        for (const item of options.locMap) {

            if (query.datasets.length > 0 && !query.datasets.includes(item.dataset)) {
                continue;
            }

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
            datasetOptions: options.datasetOptions.map((item) => ({
                      value: item,
                      label: item
                    })),
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
            taxMap: options.taxMap,
            locMap: options.locMap
        };


        return search_options;

  };

  export { filterSearchOptions };

import { useContext, useMemo } from "react";
import Information from "../Information";
import OptionBrowser from "./OptionBrowser";
import { SearchOptionsContext } from "../../Context/SearchOptionsContext";
import { build_taxon_options, TAX_RANKS } from "../../Functions/build_chip_options";

// Search by taxonomy, at any level, in one field.
//
// This replaced five per-rank dropdowns and a "hierarchical search" checkbox. Those could
// express combinations that mean nothing - class Aves together with family Cyprinidae - so
// the checkbox existed to guess which reading was intended, and because it applied to the
// whole search at once it could not express a mixture of levels. Turning it on discarded the
// coarser selections; turning it off collapsed a nested pair into its broader member. Naming
// each taxon directly removes the ambiguity instead of arbitrating it, and lets one search
// hold a class, a genus and a species side by side.
function TaxSelect({ isLoading, taxonChips, onTaxonChipsChange }) {

    const searchOptions = useContext(SearchOptionsContext);

    // The index depends only on what the datasets contain, so it is built once per options
    // change rather than on every keystroke.
    const options = useMemo(
        () => build_taxon_options(searchOptions.taxMap),
        [searchOptions.taxMap]
    );

    // Selecting is a toggle: picking the same taxon again removes it, so a list you are
    // browsing doubles as the record of what you have chosen.
    const onToggle = (option) => {
        const already = taxonChips.some((chip) => chip.value === option.value);
        onTaxonChipsChange(already
            ? taxonChips.filter((chip) => chip.value !== option.value)
            : [...taxonChips, option]);
    };

    return (
        <fieldset>
            <legend style={{color:"white"}}>Search by Taxonomy</legend>
            <div style={{display:"flex"}}>
                <label className="query--label">Taxa:</label>
                <Information blurb="taxonChips"/>
            </div>
            <OptionBrowser
                options={options}
                ranks={TAX_RANKS}
                selected={taxonChips}
                onToggle={onToggle}
                onClear={() => onTaxonChipsChange([])}
                isLoading={isLoading}
                emptyMessage="No taxon matches"
            />
            <p className="fieldHint">
                Pick a level to browse, or leave it on all levels. Add as many taxa as you
                like at any mix of levels; results include everything within each one.
            </p>
        </fieldset>
    );
};

export default TaxSelect;

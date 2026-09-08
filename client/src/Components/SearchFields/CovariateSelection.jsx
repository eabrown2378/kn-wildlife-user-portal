
import Select from "react-select";
import { unitSymbol } from "../../Functions/covariate_units";
import { selectStyles } from "../../Functions/select_theme";
import Information from "../Information";
import { useContext, useState } from "react";
import { SearchOptionsContext } from "../../Context/SearchOptionsContext";
import CovariateMetadata from "./CovariateMetadata";

function CovariateSelection({ handleMultiChange, isLoading, tempMulti }) {

    const searchOptions = useContext(SearchOptionsContext);
    const [showMetadata, setShowMetadata] = useState(false);

    const covariates = searchOptions.covarOptions || [];

    // The dropdown shows the short label and the units; the precise definition, the source
    // and the provider's usage notes live in the metadata window.
    //
    // A label names both the quantity and the period it covers, because the same quantity
    // exists for the observation's year and for its month, and a selected chip shows only the
    // label. The unit is bracketed after the name and abbreviated, so the row stays short.
    const options = covariates.map((c) => ({
        ...c,
        label: c.units ? `${c.shortLabel || c.label} (${unitSymbol(c.units)})`
                       : (c.shortLabel || c.label),
    }));

    return (
        <fieldset>
            <legend className="field--legend">Select Covariates</legend>
            <div className="field--labelRow">
                <label className="query--label" htmlFor="covarsTemp">Covariates:</label>
                <Information blurb="covars"/>
                <button
                    type="button"
                    className="covariateMetadataButton"
                    onClick={() => setShowMetadata(true)}
                    disabled={covariates.length === 0}
                    title="Descriptions, sources and usage notes for each covariate"
                >
                    About these covariates
                </button>
            </div>
            <Select
                isMulti={true}
                options={options}
                value={tempMulti.covarsTemp}
                onChange={(selections) => {handleMultiChange(selections, "covarsTemp")}}
                name="covarsTemp"
                id="covarsTemp"
                className="field"
                isDisabled={isLoading}
                styles={selectStyles}
                />

            {showMetadata && (
                <CovariateMetadata covariates={options} onClose={() => setShowMetadata(false)} />
            )}
        </fieldset>
    );
}

export default CovariateSelection;

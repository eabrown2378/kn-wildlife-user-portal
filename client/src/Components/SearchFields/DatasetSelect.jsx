import { useContext, useState } from "react";
import Information from "../Information";
import Select from "react-select";
import { selectStyles } from "../../Functions/select_theme";
import { SearchOptionsContext } from "../../Context/SearchOptionsContext";
import DatasetMetadata from "./DatasetMetadata";

function DatasetSelect({ handleMultiChange, isLoading, tempMulti }) {
          
    const searchOptions = useContext(SearchOptionsContext);
    const [showMetadata, setShowMetadata] = useState(false);

    const datasets = searchOptions.datasetOptions || [];

    return ( 
        <fieldset>
            <legend className="field--legend">Search by Dataset</legend>
            <div className="field--labelRow">
                <label htmlFor="datasetSelect">Dataset:</label>
                <Information blurb="datasetSelect"/>
                <button
                    type="button"
                    className="covariateMetadataButton"
                    onClick={() => setShowMetadata(true)}
                    disabled={datasets.length === 0}
                    title="Producers, retrieval dates, citations and provider disclaimers"
                >
                    About these datasets
                </button>
            </div>
            <Select
                isMulti={true}
                options={searchOptions.datasetOptions}
                value={tempMulti.datasetsTemp}
                onChange={(selections) => {handleMultiChange(selections, "datasetsTemp")}}
                name="datasetsTemp"
                id="datasetSelect"
                className="field"
                placeholder="Default: all datasets"
                isDisabled={isLoading}
                styles={selectStyles}
                />
            <div className="field--labelRow">
                <label htmlFor="dataTypeSelect">Data Type:</label>
                <Information blurb="dataTypeSelect"/>
            </div>
            <Select
                isMulti={true}
                options={[
                    {value: "occurrence", label: "Occurrence"},
                    {value: "density", label: "Density"},
                    {value: "abundance", label: "Abundance"}
                ]}
                value={tempMulti.dataTypesTemp}
                onChange={(selections) => {handleMultiChange(selections, "dataTypesTemp")}}
                name="dataTypesTemp"
                id="dataTypeSelect"
                className="field"
                placeholder="Default: any data type"
                isDisabled={isLoading}
                styles={selectStyles}
                />

            {showMetadata && (
                <DatasetMetadata datasets={datasets} onClose={() => setShowMetadata(false)} />
            )}
        </fieldset>        
     );
}

export default DatasetSelect;
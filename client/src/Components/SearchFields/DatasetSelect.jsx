import { useContext } from "react";
import Information from "../Information";
import Select from "react-select";
import { SearchOptionsContext } from "../../Context/SearchOptionsContext";

function DatasetSelect({ handleMultiChange, isLoading, tempMulti }) {
          
    const searchOptions = useContext(SearchOptionsContext);

    return ( 
        <fieldset>
            <legend style={{color:"white"}}>Search by Dataset</legend>
            <div style={{display:"flex"}}>
                <label htmlFor="datasetSelect">Dataset:</label>
                <Information blurb="datasetSelect"/>
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
            />
            <div style={{display:"flex"}}>
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
            />


        </fieldset>        
     );
}

export default DatasetSelect;
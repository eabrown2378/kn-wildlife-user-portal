
import Information from "../Information";
import Select from "react-select";

function DatasetSelect({ handleMultiChange, searchOptions, isLoading, tempMulti, query, handleChange }) {





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


        </fieldset>        
     );
}

export default DatasetSelect;
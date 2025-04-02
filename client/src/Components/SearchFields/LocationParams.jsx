import Select from "react-select";
import Information from "../Information";

function LocationParams({ handleMultiChange, searchOptions, isLoading, tempMulti, query, handleChange }) {
    return (  
        <fieldset>
            <legend style={{color:"white"}}>Location Parameters</legend>
            <div style={{display:"flex"}}>
                <label htmlFor="stateSelect">States:</label>
                <Information blurb="stateSelect"/>
            </div>
            <Select
                isMulti={true}
                options={searchOptions.stateOptions}
                value={tempMulti.statesTemp}
                onChange={(selections) => {handleMultiChange(selections, "statesTemp")}}
                name="statesTemp"
                id="stateSelect"
                className="field"
                placeholder="Default: all states"
                isDisabled={isLoading}
            />
            <div style={{display:"flex"}}>
                <label htmlFor="countySelect">Counties:</label>
                <Information blurb="countySelect"/>
            </div>
            <Select
                isMulti={true}
                options={searchOptions.countyOptions}
                value={tempMulti.countiesTemp}
                onChange={(selections) => {handleMultiChange(selections, "countiesTemp")}}
                name="countiesTemp"
                id="countySelect"
                className="field"
                placeholder="Default: all counties"
                isDisabled={isLoading}
            />
            <div style={{display:"flex"}}>
                <label htmlFor="siteSelect">Sampling Locations:</label>
                <Information blurb="siteSelect"/>
            </div>
            <Select
                isMulti={true}
                options={searchOptions.siteOptions}
                value={tempMulti.sitesTemp}
                onChange={(selections) => {handleMultiChange(selections, "sitesTemp")}}
                name="sitesTemp"
                id="siteSelect"
                className="field"
                placeholder="Default: all sites"
                isDisabled={isLoading}
            />
            <div style={{display:"flex"}}>
                <label htmlFor="siteExclude">Location-exclusive search?</label>
                <Information blurb="siteExclude"/>
                <input type="checkbox" id="siteExclude" name="siteExclude" checked={query.siteExclude} onChange={handleChange} disabled={isLoading}/>
            </div>
        </fieldset>
    );
}

export default LocationParams;
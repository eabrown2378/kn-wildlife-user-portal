import Select from "react-select";
import Information from "../Information";

function LocationParams({ handleMultiChange, searchOptions, isLoading, tempMulti, query, handleChange }) {
    return (  
        <fieldset>
            <legend style={{color:"white"}}>Search by Location</legend>
            <div style={{display:"flex"}}>
                <label className="query--label" htmlFor="stateSelect">States:</label>
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
                <label className="query--label" htmlFor="countySelect">Counties:</label>
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
                <label className="query--label" htmlFor="siteSelect">Sampling Locations:</label>
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
                <label className="query--label" htmlFor="coordRange">Coordinate Range:</label>
                <Information blurb="coordRange"/>
            </div>
            <div id="coordrange--div">
                <label className="query--label" htmlFor="latitudeDiv">{'Latitude (\u00b0)'}:</label>
                <div id = "latitudeDiv" style={{display:"flex"}}>
                    <label className="query--label" htmlFor="minLat">Min:</label>
                    <input id = "minLat" name = "minLat" value={query.minLat} onChange={(e) => handleChange(e)}/>
                    <label className="query--label" htmlFor="maxLat">Max:</label>
                    <input id = "maxLat" name = "maxLat" value={query.maxLat} onChange={(e) => handleChange(e)}/>
                </div>
                <label className="query--label" htmlFor="longitudeDiv">{'Longitude (\u00b0)'}</label>
                <div id = "longitudeDiv"  style={{display:"flex"}}>
                    <label className="query--label" htmlFor="minLon">Min:</label>
                    <input id = "minLon" name = "minLon" value={query.minLon} onChange={(e) => handleChange(e)}/>
                    <label className="query--label" htmlFor="maxLon">Max:</label>
                    <input id = "maxLon" name = "maxLon" value={query.maxLon} onChange={(e) => handleChange(e)}/>
                </div>
            </div>
            <div className="checkbox--class">
                <div style={{display:"flex"}}>
                    <label className="query--label" htmlFor="class">Hierarchical Search:</label>
                </div>
                <input
                    type="checkbox"
                    value={query.locHier}
                    onChange={(e) => handleChange(e)}
                    name="locHier"
                    id="locHier"
                    className="field"
                    isDisabled={isLoading}
                />
                <Information blurb="locHier"/>
            </div>
        </fieldset>
    );
}

export default LocationParams;
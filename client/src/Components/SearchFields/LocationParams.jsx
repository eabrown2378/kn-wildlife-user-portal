import Information from "../Information";
import { useContext, useMemo } from "react";
import OptionBrowser from "./OptionBrowser";
import { SearchOptionsContext } from "../../Context/SearchOptionsContext";
import { build_place_options } from "../../Functions/build_chip_options";

// Search by place, at any level, in one field.
//
// This replaced separate state and county dropdowns with a "hierarchical search" checkbox.
// The checkbox was there because selecting Iowa alongside a county of Iowa had no defined
// meaning; naming places directly makes the question disappear, since Adair sits inside Iowa
// and the union of the two simply is Iowa. It also allows what the old pair could not
// express at all: all of one state plus a couple of counties in another.
//
// County names already carry their state - "Adair (Iowa)" - so a chip identifies exactly one
// county without a second field beside it.
// States and counties are the only two levels a place can be chosen at.
const PLACE_RANKS = [
    {key: "state", label: "state"},
    {key: "county", label: "county"},
];

function LocationParams({ isLoading, query, handleChange, placeChips, onPlaceChipsChange }) {

    const searchOptions = useContext(SearchOptionsContext);

    const options = useMemo(
        () => build_place_options(searchOptions.locMap),
        [searchOptions.locMap]
    );

    const onToggle = (option) => {
        const already = placeChips.some((chip) => chip.value === option.value);
        onPlaceChipsChange(already
            ? placeChips.filter((chip) => chip.value !== option.value)
            : [...placeChips, option]);
    };

    return (
        <fieldset>
            <legend style={{color:"white"}}>Search by Location</legend>
            <div style={{display:"flex"}}>
                <label className="query--label">Places:</label>
                <Information blurb="placeChips"/>
            </div>
            <OptionBrowser
                options={options}
                ranks={PLACE_RANKS}
                selected={placeChips}
                onToggle={onToggle}
                onClear={() => onPlaceChipsChange([])}
                isLoading={isLoading}
                emptyMessage="No state or county matches"
            />
            <p className="fieldHint">
                Browse states or counties, or both. Naming a state includes all of its
                counties, so the two can be mixed freely.
            </p>
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
        </fieldset>
    );
}

export default LocationParams;
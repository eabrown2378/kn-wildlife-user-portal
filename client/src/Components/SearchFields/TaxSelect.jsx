import Select from "react-select";
import Information from "../Information";

function TaxSelect({ handleChange, handleMultiChange, searchOptions, isLoading, tempMulti, query }) {
    return (  
        <fieldset style={{display:'flex', flexDirection:'column'}}>            
            <legend style={{color:"white"}}>Biological Parameters</legend>
            <div style={{display:"flex"}}>
                <label htmlFor="taxLevel">Taxonomic Organization:</label>
                <Information blurb="taxLevel"/>
            </div>
            <select id="taxLevel" name="taxLevel" value={query.taxLevel} onChange={handleChange} disabled={isLoading} className="field">
                <option value="species">Species</option>
                <option value="genus">Genus</option>
                <option value="family">Family</option>
                <option value="order">Order</option>
                <option value="class">Class</option>
                <option value="Phylum">Phylum</option>
            </select>
            <div style={{display:"flex"}}>
                <label htmlFor="taxa">Taxa:</label>
                <Information blurb="taxa"/>
            </div>
            <Select
                isMulti={true}
                options={searchOptions.taxaOptions}
                value={tempMulti.taxaTemp}
                onChange={(selections) => {handleMultiChange(selections, "taxaTemp")}}
                name="taxaTemp"
                id="taxa"
                className="field"
                isDisabled={isLoading}
            />
            <div style={{display:"flex"}}>
                <label htmlFor="taxExlcude">Taxa-exclusive search?</label>
                <Information blurb="taxExclude"/>
                <input type="checkbox" id="taxExclude" name="taxExclude" checked={query.taxExclude} onChange={handleChange} disabled={isLoading}/>
            </div>
        </fieldset>
    );
};
;
export default TaxSelect;
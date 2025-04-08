import Select from "react-select";
import Information from "../Information";

function TaxSelect({ handleChange, handleMultiChange, searchOptions, isLoading, tempMulti, query }) {
    return (  
        <fieldset>            
            <legend style={{color:"white"}}>Search by Taxonomy</legend>
{/*             <div style={{display:"flex"}}>
                <label htmlFor="taxLevel">Taxonomic Organization:</label>
                <Information blurb="taxLevel"/>
            </div>
            <select id="taxLevel" name="taxLevel" value={query.taxLevel} onChange={handleChange} disabled={isLoading} className="field">
                <option value="species">Species</option>
                <option value="genus">Genus</option>
                <option value="family">Family</option>
                <option value="order">Order</option>
                <option value="class">Class</option>
                <option value="phylum">Phylum</option>
            </select> */}
            <div style={{display:"flex"}}>
                <label htmlFor="species">Species:</label>
                <Information blurb="species"/>
            </div>
            <Select
                isMulti={true}
                options={searchOptions.speciesOptions}
                value={tempMulti.speciesTemp}
                onChange={(selections) => {handleMultiChange(selections, "speciesTemp")}}
                name="speciesTemp"
                id="species"
                className="field"
                isDisabled={isLoading}
            />
            <div style={{display:"flex"}}>
                <label htmlFor="genus">Genus:</label>
                <Information blurb="genus"/>
            </div>
            <Select
                isMulti={true}
                options={searchOptions.genusOptions}
                value={tempMulti.genusTemp}
                onChange={(selections) => {handleMultiChange(selections, "genusTemp")}}
                name="genusTemp"
                id="genus"
                className="field"
                isDisabled={isLoading}
            />
            <div style={{display:"flex"}}>
                <label htmlFor="family">Family:</label>
                <Information blurb="family"/>
            </div>
            <Select
                isMulti={true}
                options={searchOptions.familyOptions}
                value={tempMulti.familyTemp}
                onChange={(selections) => {handleMultiChange(selections, "familyTemp")}}
                name="familyTemp"
                id="family"
                className="field"
                isDisabled={isLoading}
            />
            <div style={{display:"flex"}}>
                <label htmlFor="order">Order:</label>
                <Information blurb="order"/>
            </div>
            <Select
                isMulti={true}
                options={searchOptions.orderOptions}
                value={tempMulti.orderTemp}
                onChange={(selections) => {handleMultiChange(selections, "orderTemp")}}
                name="orderTemp"
                id="order"
                className="field"
                isDisabled={isLoading}
            />
            <div style={{display:"flex"}}>
                <label htmlFor="class">Class:</label>
                <Information blurb="class"/>
            </div>
            <Select
                isMulti={true}
                options={searchOptions.classOptions}
                value={tempMulti.classTemp}
                onChange={(selections) => {handleMultiChange(selections, "classTemp")}}
                name="classTemp"
                id="class"
                className="field"
                isDisabled={isLoading}
            />
        </fieldset>
    );
};
;
export default TaxSelect;
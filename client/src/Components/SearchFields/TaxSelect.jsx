import Select from "react-select";
import Information from "../Information";

function TaxSelect({ handleChange, handleMultiChange, searchOptions, isLoading, tempMulti, query }) {
    return (  
        <fieldset>            
            <legend style={{color:"white"}}>Search by Taxonomy</legend>
            <div className="checkbox--class">
                <div style={{display:"flex"}}>
                    <label className="query--label" htmlFor="taxHier">Hierarchical Search:</label>
                </div>
                <input
                    type="checkbox"
                    value={query.taxHier}
                    onChange={(e) => handleChange(e)}
                    name="taxHier"
                    id="taxHier"
                    className="field"
                    isDisabled={isLoading}
                />
                <Information blurb="taxHier"/>
            </div>
            <div style={{display:"flex"}}>
                <label className="query--label" htmlFor="class">Class:</label>
                <Information blurb="class"/>
            </div>
            <Select
                isMulti={true}
                options={searchOptions.classOptions}
                value={tempMulti.tax_classTemp}
                onChange={(selections) => {handleMultiChange(selections, "tax_classTemp")}}
                name="tax_classTemp"
                id="tax_class"
                className="field"
                isDisabled={isLoading}
            />
            <div style={{display:"flex"}}>
                <label className="query--label" htmlFor="order">Order:</label>
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
                <label className="query--label" htmlFor="family">Family:</label>
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
                <label className="query--label" htmlFor="genus">Genus:</label>
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
                <label className="query--label" htmlFor="species">Species:</label>
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
        </fieldset>
    );
};
;
export default TaxSelect;
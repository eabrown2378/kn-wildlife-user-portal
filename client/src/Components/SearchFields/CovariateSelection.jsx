
import Select from "react-select";
import Information from "../Information";

function CovariateSelection({ handleMultiChange, searchOptions, isLoading, tempMulti }) {
    
    
    return ( 
        <fieldset>            
            <legend style={{color:"white"}}>Select Covariates</legend>
            <div style={{display:"flex"}}>
                <label className="query--label" htmlFor="class">Covariates:</label>
                <Information blurb="covars"/>
            </div>
            <Select
                isMulti={true}
                options={searchOptions.covarOptions}
                value={tempMulti.covarsTemp}
                onChange={(selections) => {handleMultiChange(selections, "covarsTemp")}}
                name="covarsTemp"
                id="covarsTemp"
                className="field"
                isDisabled={isLoading}
            />
          
        </fieldset>
    );
}

export default CovariateSelection;
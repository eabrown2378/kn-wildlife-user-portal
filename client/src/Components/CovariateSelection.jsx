
import { useContext } from "react";
import { CovariateContext } from "../Context/CovariateContext";

function CovariateSelection() {
    
    
    const [covariates, setCovariates] = useContext(CovariateContext);
    
    return ( 
        <div className="covariateSelect">

        </div> 
    );
}

export default CovariateSelection;
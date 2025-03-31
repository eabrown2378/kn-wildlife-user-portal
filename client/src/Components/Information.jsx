import { useState, useEffect } from "react";
import blurbs from "../data/blurbs.json";


function Information(props) {

    const [hovered, setHovered] = useState(false);
    const [blurbCoords, setBlurbCoords] = useState({
        x: 0,
        y: 0
    });
    const [field, setField] = useState();

    useEffect(() => {
        setField(document.getElementById(props.blurb + "_info"));
    }, []);

    useEffect(() => {
        if (field) {
            const rect = field.getBoundingClientRect(); 
            setBlurbCoords({
                x: 20 + rect.left,
                y: 5 + rect.top
            })
        }
    }, [field]);

    return (  
        <div className="information">
            <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} id={props.blurb + "_info"} className="iContainer">
                ?
            </div>        
            {hovered && <p className="blurbContainer" style={{top:blurbCoords.y, left:blurbCoords.x}}>{blurbs[0][props.blurb]}</p>}
        </div>
    );
}

export default Information;
import CsvDownloader from 'react-csv-downloader';
import CytoscapeGraph from './CytoscapeGraph';
import { useState } from 'react';
import LeafletGraph from './LeafletGraph';
import KNW_Logo from "../assets/Logo.png";
import NSF_Logo from "../assets/NSF_Official_logo_Med_Res_600ppi_rectangle.png";


export default function OutputWindow() {

    // state to control what graphs users are seeing
    // defaults to "cytoscape" (i.e. knowledge graph) view
    const [viewport, setViewport] = useState("leaflet");

    const date = new Date();
    const day = date.getDate().length === 2 ? date.getDate() : "0" + String(date.getDate());
    const mo = (date.getMonth() + 1).length === 2 ? date.getMonth() : "0" + String(date.getMonth() + 1);
    const yr = date.getFullYear();

    const fn = "knw_query_" + String(yr) + String(mo) + String(day);

    return (
        <div className="outputwindow">
            <div className="viewportSelect">
                <p>Select View:</p>
                <button className='viewport--button' onClick={() => setViewport("leaflet")} disabled={viewport === "leaflet"}>Map</button>
                <button className='viewport--button' onClick={() => setViewport("cytoscape")} disabled={viewport === "cytoscape"}>Knowledge Graph</button>
            </div>
            <div className="output--container">
                {viewport === "cytoscape" && <CytoscapeGraph/>}
                {viewport === "leaflet" && <LeafletGraph/>}
            </div>       
            
            <div className='logo--container'>
                <img src={KNW_Logo} className='knwLogo' alt="" />
                <img src={NSF_Logo} className='nsfLogo' alt="" />
                
            <CsvDownloader className='download--button' datas={[]} filename={fn} separator="|" extension=".tsv">
                <button disabled={true}>Download data as *.tsv file</button>
            </CsvDownloader>

            </div>
        </div>
    );
};
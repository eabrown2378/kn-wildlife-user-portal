import CsvDownloader from 'react-csv-downloader';
import CytoscapeGraph from './CytoscapeGraph';
import { useState } from 'react';
import LeafletGraph from './LeafletGraph';
import KNW_Logo from "../assets/Logo.png";
import NSF_Logo from "../assets/NSF_Official_logo_Med_Res_600ppi_rectangle.png";
import TableView from './TableView';

export default function OutputWindow({data}) {

    const handleDownload = (csvString, filename) => {
        const blob = new Blob([csvString], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename || 'data.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

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
                <button className='viewport--button' onClick={() => setViewport("table")} disabled={viewport === "table"}>Table</button>
            </div>
            <div className="output--container">
                {viewport === "cytoscape" && <CytoscapeGraph/>}
                {viewport === "leaflet" && <LeafletGraph/>}
                {viewport === "table" && <TableView/>}
            </div>       
            
            <div className='logo--container'>
                <img src={KNW_Logo} className='knwLogo' alt="" />
                <img src={NSF_Logo} className='nsfLogo' alt="" />                
                <button onClick={() => handleDownload(data, `${fn}.csv`)} 
                        disabled={!data}
                        className='csv--button'
                >
                    Download data as *.csv
                </button>
            </div>
        </div>
    );
};
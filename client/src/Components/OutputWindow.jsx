import CsvDownloader from 'react-csv-downloader';
import CytoscapeGraph from './CytoscapeGraph';
import { useState } from 'react';


export default function OutputWindow({query, queryResult}) {

    // state to control what graphs users are seeing
    // defaults to "cytoscape" (i.e. knowledge graph) view
    const [viewport, setViewport] = useState("cytoscape");

    const date = new Date();
    const day = date.getDate().length === 2 ? date.getDate() : "0" + String(date.getDate());
    const mo = (date.getMonth() + 1).length === 2 ? date.getMonth() : "0" + String(date.getMonth() + 1);
    const yr = date.getFullYear();

    const fn = "knw_query_" + String(yr) + String(mo) + String(day)

    return (
        <div className="outputwindow">
            <div className="viewportselect">

            </div>
            <div className="output--container">
                {viewport === "cytoscape" && <CytoscapeGraph query={query} queryResult={queryResult}/>}
            </div>
            <CsvDownloader datas={[]} filename={fn} separator="|" extension=".tsv">
                <button disabled={true}>Download data as *.tsv file</button>
            </CsvDownloader>
        </div>
    );
};
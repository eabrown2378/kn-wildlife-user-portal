import CytoscapeGraph from './CytoscapeGraph';
import { useState, useEffect, useContext } from 'react';
import LeafletGraph from './LeafletGraph';
import KNW_Logo from "../assets/Logo.png";
import NSF_Logo from "../assets/NSF_Official_logo_Med_Res_600ppi_rectangle.png";
import GitHub_Logo from "../assets/github-mark-white.png";
import TableView from './TableView';
import CircularProgress from '@mui/material/CircularProgress';
import JSZip from 'jszip';
import disclaimers from '../data/disclaimers.json';
import MetadataContext from '../Context/MetadataContext';

export default function OutputWindow({data, isLoading, result}) {


    const handleDownload = async (csvString, filename, disclaimerText, citationsText) => {
        const zip = new JSZip();

        // Add the CSV file
        zip.file(`${filename}.csv`, csvString);

        // Add the DISCLAIMERS.txt file
        zip.file('DISCLAIMERS.txt', disclaimerText);
        zip.file('CITATIONS.txt', citationsText);

        // Generate the zip and trigger download
        const content = await zip.generateAsync({ type: 'blob' });

        const url = URL.createObjectURL(content);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    // pull metadata from context
    const metadata = useContext(MetadataContext);

    // state to control what graphs users are seeing
    // defaults to "cytoscape" (i.e. knowledge graph) view
    const [viewport, setViewport] = useState("leaflet");

    // state to generate the contents of DISCLAIMERS.txt and CITATIONS.txt
    const [disclaim, setDisclaim] = useState("");
    const [citations, setCitations] = useState("");

    // when query result changes, make sure the DISCLAIMERS.txt and CITATIONS.txt
    // contents are updated accordingly
    useEffect(() => {

        if (result) {

            const datasets = result.filter((x) => x.data.category === "Dataset").filter((value, index, self) => index === self.findIndex(t => t.elementId === value.elementId));

            const datasetNames = datasets.map((x) => x.data.properties.name);

            const discs = disclaimers.filter((x) => x.dataset.some((y) => datasetNames.includes(y)));

            const discString = discs.map((x) => {
                return (`See below for a list of disclaimers associated with the returned datasets:\n\n\n\nDisclaimers for the following dataset(s): ${x.dataset.join(' AND ')}\n\n${x.disclaimer}`)
            }).join("\n\n\n\n");

            const citeString = datasets.map((x) => {
                return (
                    `Citations for dataset [${x.data.properties.name}]:\n\n${x.data.properties.dataset_citations.join("\n\n")}\n\n\nRelevant URLs:\n\n${x.data.properties.dataset_urls.join("\n\n")}`
                );
            }).join("\n\n\n\n");

            setDisclaim(discString);
            setCitations(citeString);
        }

    }, [result]);

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
                {viewport === "table" && <TableView data={data}/>}
            </div>       
            
            <div className='logo--container'>
                <img src={KNW_Logo} className='knwLogo' alt="" />
                <img src={NSF_Logo} className='nsfLogo' alt="" />
                <div className='github--div'>
                    <div>
                        <img src={GitHub_Logo} id='gitLogo' alt="" />
                    </div>
                    <div className='github-links--div'>
                        <a href="https://github.com/eabrown2378/kn-wildlife-user-portal">Follow us on GitHub</a>
                        <a href="https://github.com/eabrown2378/kn-wildlife-user-portal/issues/new?labels=dataset&template=suggest-dataset---.md">Suggest dataset</a>
                        <a href="https://github.com/eabrown2378/kn-wildlife-user-portal/issues/new?labels=taxonomy&template=taxonomy-fix---.md">Report taxonomic error</a>
                        <a href="https://github.com/eabrown2378/kn-wildlife-user-portal/issues/new?labels=bug&template=bug-report---.md">Report bug</a>
                        <a href="https://github.com/eabrown2378/kn-wildlife-user-portal/issues/new?labels=enhancement&template=feature-request---.md">Suggest feature</a>   
                    </div>
                </div>                
                <button onClick={() => handleDownload(data, fn, disclaim, citations)} 
                        disabled={!data || isLoading}
                        className='csv--button'
                >
                    Download data as *.csv
                </button>
                {isLoading && <CircularProgress style={{color:'white', width:'2%', marginTop: '2vh'}}/>}
            </div>
        </div>
    );
};
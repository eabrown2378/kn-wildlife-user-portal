import CytoscapeGraph from './CytoscapeGraph';
import { useState, useEffect, useContext } from 'react';
import LeafletGraph from './LeafletGraph';
import KNW_Logo from "../assets/Logo.png";
import NSF_Logo from "../assets/NSF_Official_logo_Med_Res_600ppi_rectangle.png";
import GitHub_Logo from "../assets/github-mark-white.png";
import TableView from './TableView';
import LoadingOverlay from './LoadingOverlay';
import CircularProgress from '@mui/material/CircularProgress';
import JSZip from 'jszip';
import disclaimers from '../data/disclaimers.json';
import { licences_present } from '../Functions/attribution_columns';
import {MetadataContext} from '../Context/MetadataContext';
import ReactGA from 'react-ga4';
import { array_to_csv } from '../Functions/array_to_csv';


export default function OutputWindow({data, isLoading, result, returnedCovars}) {


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
        // log that a user has successfully downloaded data
        ReactGA.event({
            category: "user data download",
            action: "successful data download",
            label: "download"
        });
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

        if (metadata) {

            const datasetNames = Array.prototype.concat(metadata.map((x) => x.datasetName), returnedCovars);

            const discs = disclaimers.filter((x) => x.dataset.some((y) => datasetNames.includes(y)));

            const discString = discs.map((x) => {
                const notes = x.notes !== undefined ? `\n\n\n***Also see these notes from the KN-Wildlife team:***\n\n${x.notes}` : `\n\n\n***Also see these notes from the KN-Wildlife team:***\n\n${metadata.filter((y) => x.dataset.some((z)=>  z === y.datasetName)).map((y) => y.notes)}`

                return (`***See below for a list of disclaimers associated with the returned datasets:\n\n\nDisclaimers for the following dataset(s): ${x.dataset.join(' AND ')}***\n\n${x.disclaimer}` + notes)
            }).join(`\n\n${'*'.repeat(100)}\n\n`);

            const citeString = Array.prototype.concat(
                metadata.map((x) => {
                    return (
                        `***Citations for dataset [${x.datasetName}]:***\n\n${x.citations.join("\n\n")}\n\n\n***Relevant URLs:***\n\n${x.urls.join("\n\n")}\n\n\n`
                    );
                }),                
                discs.map((x) => {
                    if (x.citations !== undefined) {
                        return (
                            `***Citations for dataset [${x.dataset.join(' AND ')}]:***\n\n${x.citations.join("\n\n")}\n\n\n***Relevant URLs:***\n\n${x.urls.join("\n\n")}\n\n\n`
                        );
                    }
                }).filter((x) => x !== undefined),
            ).join(`${'*'.repeat(100)}\n\n`);

            // The licence a publisher chose governs what a record may be used for, and a
            // single extract mixes several - most iNaturalist records are non-commercial.
            // GBIF's terms require the licensing information to travel with the download,
            // so the licences actually present in this result are listed rather than a
            // generic statement that some exist.
            const licences = licences_present(data);
            const licenceNote = licences.length === 0 ? "" : [
                "*".repeat(100),
                "",
                "***Licences covering the records in this download:***",
                "",
                ...licences,
                "",
                "Each record carries its own licence in the record_licence column, and its",
                "owner in rights_holder. Where a publisher's licence conflicts with any other",
                "term, the publisher's licence prevails. Records under a non-commercial (NC)",
                "licence may not be used commercially.",
                "",
                "",
            ].join("\n");

            setDisclaim(discString);
            setCitations(citeString + licenceNote);
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
                {isLoading && <LoadingOverlay viewport={viewport}/>}
            </div>
            
            <footer className='portalFooter'>

                <div className='portalFooter--brand'>
                    <img src={KNW_Logo} className='knwLogo' alt="KN-Wildlife" />
                    <img src={NSF_Logo} className='nsfLogo' alt="National Science Foundation" />
                </div>

                <div className='portalFooter--action'>
                    <button onClick={() => handleDownload(array_to_csv(data), fn, disclaim, citations)}
                            disabled={!data || isLoading}
                            className='csv--button'
                    >
                        Download data as *.csv
                    </button>
                    {isLoading && <CircularProgress size={18} style={{color:'#2a2a2a'}}/>}
                </div>

                <nav className='portalFooter--links' aria-label="Project links">
                    <img src={GitHub_Logo} id='gitLogo' alt="" />
                    <a target="_blank" rel="noopener noreferrer" href="https://github.com/eabrown2378/kn-wildlife-user-portal">Follow us on GitHub</a>
                    <a target="_blank" rel="noopener noreferrer" href="https://github.com/eabrown2378/kn-wildlife-user-portal/issues/new?labels=dataset&template=suggest-dataset---.md">Suggest a dataset</a>
                    <a target="_blank" rel="noopener noreferrer" href="https://github.com/eabrown2378/kn-wildlife-user-portal/issues/new?labels=taxonomy&template=taxonomy-fix---.md">Report a taxonomic error</a>
                    <a target="_blank" rel="noopener noreferrer" href="https://github.com/eabrown2378/kn-wildlife-user-portal/issues/new?labels=bug&template=bug-report---.md">Report a bug</a>
                    <a target="_blank" rel="noopener noreferrer" href="https://github.com/eabrown2378/kn-wildlife-user-portal/issues/new?labels=enhancement&template=feature-request---.md">Suggest a feature</a>
                </nav>

                <a className='portalFooter--survey' target="_blank" rel="noopener noreferrer" href='https://docs.google.com/forms/d/e/1FAIpQLScRwMbBeeuv8X5ZGul_-Px6RaPP4sGJAyr1DtNaFSsQsiAgHw/viewform?usp=dialog'>Take our user survey</a>

            </footer>
        </div>
    );
};
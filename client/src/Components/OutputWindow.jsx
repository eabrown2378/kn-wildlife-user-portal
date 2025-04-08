import CsvDownloader from 'react-csv-downloader';
import GraphTest from './GraphTest';

export default function OutputWindow({query, data}) {

    const date = new Date();
    const day = date.getDate().length === 2 ? date.getDate() : "0" + String(date.getDate());
    const mo = (date.getMonth() + 1).length === 2 ? date.getMonth() : "0" + String(date.getMonth() + 1);
    const yr = date.getFullYear();

    const fn = "query_" + String(yr) + String(mo) + String(day)

    return (
        <div className="outputwindow">
            <div className="output--container">
                <GraphTest query={query}/>
            </div>
            <CsvDownloader datas={data} filename={fn} separator="|" extension=".tsv">
                <button disabled={data.length === 0}>Download data as *.tsv file</button>
            </CsvDownloader>
        </div>
    );
};
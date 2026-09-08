import { Fragment, useEffect, useContext, useState } from "react";
import { MapContainer } from "react-leaflet/MapContainer";
import { TileLayer } from "react-leaflet/TileLayer";
import { Marker } from "react-leaflet/Marker";
import { Popup } from "react-leaflet/Popup";
import { useMapEvent } from 'react-leaflet/hooks';
import { MarkerContext } from "../Context/MarkerContext";
import get_average from "../Functions/get_average";
import L from "leaflet";
import marker from "../assets/map-marker.svg";
import 'leaflet/dist/leaflet.css';
import { MapDataContext } from "../Context/MapDataContext";
import MarkerClusterGroup from "react-leaflet-markercluster";
import LoadingOverlay from "./LoadingOverlay";
import { summarize_sites } from "../Functions/summarize_sites";
import { format_measurement } from "../Functions/format_measurement";


// component so set map center when query result changes
function MapViewComponent({position}) {
    const map = useMapEvent('click', () => {
      map.setView(position, map.getZoom());
    });
    return null;
};

const date_range = (earliest, latest) =>
    (earliest === latest ? earliest : `${earliest} to ${latest}`);

// What one taxon's numbers say at this site.
//
// Most NRSA and BioData sites were visited once. Where a taxon's summary rests on a single
// sampling event the mean, median, minimum and maximum are all the same number, and printing
// five identical figures implies a spread that was never measured. So a single-event taxon
// reports the one value it has and says so; the distribution appears only once there is a
// distribution to describe.
function TaxonSummary({taxon, unit}) {
    if (!taxon.measured) {
        return (
            <>
                {taxon.records.toLocaleString()} record{taxon.records === 1 ? "" : "s"}
                {taxon.earliest ? `, ${date_range(taxon.earliest, taxon.latest)}` : ""}
            </>
        );
    }

    // "detected in" only where absences are actually recorded; otherwise the data cannot
    // tell a genuine absence from a taxon the dataset simply did not list that day
    const frequency = taxon.assessed > 1
        ? `${taxon.zerosRecorded ? "detected" : "recorded"} in ${taxon.detections} of ${taxon.assessed} events`
        : null;

    if (taxon.events <= 1) {
        return (
            <>
                {format_measurement(taxon.mean)}{unit ? ` ${unit}` : ""}
                <span className="sitePopup--note">
                    {" "}({frequency || "one sampling event"}{taxon.earliest ? `, ${taxon.earliest}` : ""})
                </span>
            </>
        );
    }

    return (
        <>
            {format_measurement(taxon.mean)}{unit ? ` ${unit}` : ""} mean when present
            <span className="sitePopup--note">
                {" "}(median {format_measurement(taxon.median)}, range {format_measurement(taxon.min)}–{format_measurement(taxon.max)}
                {frequency ? `, ${frequency}` : ""}{taxon.earliest ? `, ${date_range(taxon.earliest, taxon.latest)}` : ""})
            </span>
        </>
    );
}

// what was recorded at one sampling site, rather than one row of the result set
function SiteSummary({site}) {
    const {summary} = site;

    return (
        <div className="sitePopup">
            <p className="leafletP"><strong>{site.name || "Unnamed site"}</strong></p>
            <p className="leafletP">{site.latitude.toFixed(4)}, {site.longitude.toFixed(4)}</p>
            <p className="leafletP">
                {summary.observations.toLocaleString()} observation{summary.observations === 1 ? "" : "s"}
                {summary.samplingEvents > 0 && ` across ${summary.samplingEvents.toLocaleString()} sampling event${summary.samplingEvents === 1 ? "" : "s"}`}
                {summary.earliest ? `, ${date_range(summary.earliest, summary.latest)}` : ""}
            </p>
            <p className="leafletP">
                {summary.speciesCount} species &middot; {summary.generaCount} genera &middot; {summary.familiesCount} families
            </p>
            {summary.topTaxa.length > 0 && (
                <>
                    <p className="leafletP">
                        <strong>{summary.measured ? "Most abundant" : "Most frequently detected"}</strong>
                        {summary.measured && summary.measurementType ? ` — ${summary.measurementType}` : ""}
                    </p>
                    <ul className="sitePopup--taxa">
                        {summary.topTaxa.map((taxon) => (
                            <li key={taxon.name}>
                                <em>{taxon.name}</em>
                                {" — "}
                                <TaxonSummary taxon={taxon} unit={summary.measurementUnit}/>
                            </li>
                        ))}
                    </ul>
                </>
            )}
            <p className="leafletP">{summary.datasets.join("; ")}</p>
        </div>
    );
}

 function LeafletGraph() {   

        
    // define custom leaflet map marker
    const myIcon = new L.Icon({
        iconUrl: marker,
        iconRetinaUrl: marker,
        iconAnchor: [10, 35],
        popupAnchor:  [-0, -35],
        iconSize: [20, 35],     
    });    


    const [position, setPosition] = useState([41.7, -86.23]);

    const mapData = useContext(MapDataContext);

    const [markers, setMarkers] = useContext(MarkerContext);

    // Which results the markers currently on the map were built from. While this differs
    // from the latest results the map is out of date, so the overlay belongs up.
    //
    // This is derived during render rather than set from an effect on purpose. An effect
    // runs after the commit, so the overlay would appear one commit late; the search's own
    // overlay has already gone by then and the gap shows as a flicker.
    const [renderedData, setRenderedData] = useState(null);
    const isRendering = Boolean(mapData) && mapData !== renderedData;

    // generate map every time query results change
    useEffect(() => {
        if (!mapData || mapData === renderedData) return undefined;

        let innerFrame = null;

        // building the markers blocks the main thread, so hand the browser a frame to paint
        // the overlay first; otherwise it unmounts before the map has anything to show and
        // the user watches an empty map for several seconds
        const frame = requestAnimationFrame(() => {

            // one marker per sampling site, not per observation: rows sharing a coordinate
            // are the same place recorded repeatedly, and plotting each one stacks hundreds
            // of identical pins that the cluster then fans out into a meaningless circle
            const sites = summarize_sites(mapData);

            // first, get average lat/long of query results to determine map center position
            const {latValues, lonValues} = sites.reduce((acc, site) => {
                acc.latValues.push(site.latitude);
                acc.lonValues.push(site.longitude);
                return acc;
            }, {latValues: [], lonValues: []});

            const avgLat = get_average(latValues);
            const avgLon = get_average(lonValues);

            setPosition([avgLat,avgLon]);

            setMarkers(sites.map((site) => (
                <Marker key={site.key} icon={myIcon} position={[site.latitude, site.longitude]}>
                    <Popup>
                        <SiteSummary site={site}/>
                    </Popup>
                </Marker>
            )))

            // Lift the overlay only after the markers have been committed and painted, so
            // it covers the clustering rather than ending when the data merely arrived.
            // Doing this here, rather than from a second effect watching the markers, keeps
            // the order unambiguous: the overlay cannot clear before the build that follows it.
            innerFrame = requestAnimationFrame(() => {
                innerFrame = requestAnimationFrame(() => setRenderedData(mapData));
            });
        });

        return () => {
            cancelAnimationFrame(frame);
            if (innerFrame) cancelAnimationFrame(innerFrame);
        };
    }, [mapData]);

    return (
        <Fragment>
            <MapContainer className="leafletMap" center={position} zoom={3} scrollWheelZoom={true}>
                <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {/* chunkedLoading adds the markers in batches with breaks between them, so a
                    large result set does not freeze the page while it clusters */}
                <MarkerClusterGroup chunkedLoading>
                    {markers}
                </MarkerClusterGroup>
                <MapViewComponent position={position}/>
            </MapContainer>
            {isRendering && <LoadingOverlay viewport="leaflet"/>}
        </Fragment>
     );
}

export default LeafletGraph;
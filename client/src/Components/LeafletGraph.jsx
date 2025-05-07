import { useEffect, useContext, useState } from "react";
import { MapContainer } from "react-leaflet/MapContainer";
import { TileLayer } from "react-leaflet/TileLayer";
import { Marker } from "react-leaflet/Marker";
import { Popup } from "react-leaflet/Popup";
import { useMapEvent } from 'react-leaflet/hooks';
import { QueryResultContext } from "../Context/QueryResultContext";
import { MarkerContext } from "../Context/MarkerContext";
import get_average from "../Functions/get_average";
import L from "leaflet";
import marker from "../assets/map-marker.svg";
import 'leaflet/dist/leaflet.css';


// component so set map center when query result changes
function MapViewComponent({position}) {
    const map = useMapEvent('click', () => {
      map.setView(position, map.getZoom());
    });
    return null;
};

 function LeafletGraph() {   
    


    
    const myIcon = new L.Icon({
        iconUrl: marker,
        iconRetinaUrl: marker,
        popupAnchor:  [-0, -0],
        iconSize: [26,40],     
    }); 

    

    

    const [position, setPosition] = useState([41.7, -86.23]);

    const queryResult = useContext(QueryResultContext);

    const [markers, setMarkers] = useContext(MarkerContext);

    // generate map every time query results change
    useEffect(() => {
        if (queryResult) {
            
            // first, get average lat/long of query results to determine map center position
            const avgLat = get_average(queryResult.filter((item) => item.data.category === "Site").map((item) => item.data.properties.latitudes[0])); 
            const avgLon = get_average(queryResult.filter((item) => item.data.category === "Site").map((item) => item.data.properties.longitudes[0])); 

            setPosition([avgLat,avgLon]);

            setMarkers(queryResult.map((item, index) => {

                if (item.data.category === 'Site') {
                    return (
                        <Marker key = {`Marker${index}`} icon={myIcon} position={[item.data.latitude, item.data.longitude]}>
                            <Popup>
                                <p className="leafletP">Site Name/Code: <a href={item.data.properties.api_url} target="_blank">{item.data.properties.name}</a></p>
                                <p className="leafletP">{`Longitude: ${item.data.properties.longitudes[0].toPrecision(5)}`}</p>
                                <p className="leafletP">{`Latitude: ${item.data.properties.latitudes[0].toPrecision(5)}`}</p>
                                <p className="leafletP">{`Sampling Dates: ${queryResult.filter((x) => {
                                    return x.data.category === "Observation" && x.data.properties.site_name === item.data.properties.name
                                }).map((x) => x.data.properties.date).sort((a, b) => {
                                    const dateA = new Date(a);
                                    const dateB = new Date(b);
                                    return dateA - dateB;
                                  }).join(", ")}`}</p>                                
                            </Popup>
                        </Marker>
                    )
                } else {
                    return null
                }

            }).filter(item => item !== null));
        }        
    }, [queryResult]);

    return (
        <MapContainer className="leafletMap"  style={{ height: '80vh' }} center={position} zoom={3} scrollWheelZoom={true}>
            <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {markers}
            <MapViewComponent position={position}/>
        </MapContainer>

     );
}

export default LeafletGraph;
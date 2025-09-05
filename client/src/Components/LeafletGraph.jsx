import { useEffect, useContext, useState } from "react";
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


// component so set map center when query result changes
function MapViewComponent({position}) {
    const map = useMapEvent('click', () => {
      map.setView(position, map.getZoom());
    });
    return null;
};

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

    // generate map every time query results change
    useEffect(() => {
        if (mapData) {
            
            // first, get average lat/long of query results to determine map center position
            const avgLat = get_average(mapData.map((item) => Number(item.latitude_dd))); 
            const avgLon = get_average(mapData.map((item) => Number(item.longitude_dd))); 

            setPosition([avgLat,avgLon]);

            setMarkers(mapData.map((item, index) => {

                    return (
                        <Marker key = {`Marker${index}`} icon={myIcon} position={[item.latitude_dd, item.longitude_dd]}>
                            <Popup>
                                <p className="leafletP">Site Name/Code: {item.site}</p>
                                <p className="leafletP">{`Longitude: ${item.longitude_dd}`}</p>
                                <p className="leafletP">{`Latitude: ${item.latitude_dd}`}</p>                                                          
                            </Popup>
                        </Marker>
                    )
                
            }))
        }        
    }, [mapData]);

    return (
        <MapContainer className="leafletMap"  style={{ height: '75vh' }} center={position} zoom={3} scrollWheelZoom={true}>
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
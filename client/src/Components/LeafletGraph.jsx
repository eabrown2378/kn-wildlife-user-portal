import { useState, useEffect } from "react";
import { MapContainer } from "react-leaflet/MapContainer";
import { TileLayer } from "react-leaflet/TileLayer";
import { Marker } from "react-leaflet/Marker";
import { Popup } from "react-leaflet/Popup";
import 'leaflet/dist/leaflet.css';

function LeafletGraph({queryResult}) {

    const position = [51.505, -0.09];

    const [markers, setMarkers] = useState(
        [
            <Marker key = {"Marker0"} position={position}>
                <Popup>
                    Your search results will <br /> be mapped here.
                </Popup>
            </Marker>
        ]
    )

    // generate map every time query results change
    useEffect(() => {
        if (queryResult) {
            setMarkers();
        }        
    }, [queryResult]);

    return ( 
            <MapContainer className="leafletMap"  style={{ height: '500px' }} center={position} zoom={13} scrollWheelZoom={false}>
                <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {markers}
            </MapContainer>

     );
}

export default LeafletGraph;
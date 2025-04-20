import { useEffect, useContext } from "react";
import { MapContainer } from "react-leaflet/MapContainer";
import { TileLayer } from "react-leaflet/TileLayer";
import { Marker } from "react-leaflet/Marker";
import { Popup } from "react-leaflet/Popup";
import 'leaflet/dist/leaflet.css';
import { QueryResultContext } from "../Context/QueryResultContext";
import { MarkerContext } from "../Context/MarkerContext";

function LeafletGraph() {    

    
    const position = [41.7, -86.23];

    const queryResult = useContext(QueryResultContext);

    const [markers, setMarkers] = useContext(MarkerContext);

    // generate map every time query results change
    useEffect(() => {
        if (queryResult) {
            setMarkers(queryResult.map((item, index) => {

                if (item.data.category === 'Site') {
                    return (
                        <Marker key = {`Marker${index}`} position={[item.data.latitude, item.data.longitude]}>
                            <Popup>
                                <p className="leafletP">Site Name: <a href={item.data.properties.api_url} target="_blank">{item.data.properties.name}</a></p>
                                <p className="leafletP">{`Longitude: ${item.data.properties.longitudes[0].toPrecision(5)}`}</p>
                                <p className="leafletP">{`Latitude: ${item.data.properties.latitudes[0].toPrecision(5)}`}</p>
                                <p className="leafletP">{`Sampling Dates: ${queryResult.filter((x) => {
                                    return x.data.category === "Observation" && x.data.properties.site_name === item.data.properties.name
                                }).map((x) => x.data.properties.date).join(', ')}`}</p>                                
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
            <MapContainer className="leafletMap"  style={{ height: '80vh' }} center={position} zoom={13} scrollWheelZoom={false}>
                <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {markers}
            </MapContainer>

     );
}

export default LeafletGraph;

// function to translate query object to cypher code

const query_to_cypher = ({       
            species, genus, family, order, tax_class, 
            maxLat, minLat, maxLon, minLon, 
            sites, states, counties, datasets, 
            fromMonth, toMonth, fromDay, toDay, fromYear, toYear
        }) => {

    // initial match statement to return complete chain of nodes and edges from neo4j
    const matchString = "MATCH (c:TaxClass)<-[b4:BELONGS_TO]-(o:Order)<-[b3:BELONGS_TO]-(f:Family)<-[b2:BELONGS_TO]-(g:Genus)<-[b1:BELONGS_TO]-(n:Species)<-[r:OBSERVED_ORGANISM]-(p:Observation)-[i:OBSERVED_IN]->(s:Site)-[s1:IN_COUNTY]->(p1:County)-[s2:IN_STATE]->(p2:State) WHERE";

    // concatenate dates
    let fromDate = undefined;
    let toDate = undefined;

    if (fromMonth !== "" && fromDay !== "" && fromYear !== "") {
        fromDate = [fromYear, fromMonth, fromDay].join("/");
    }

    if (toMonth !== "" && toDay !== "" && toYear !== "") {
        toDate = [toYear, toMonth, toDay].join("/");
    }

    // query by date
    let dateString = '';

    if (fromDate !== undefined || toDate !== undefined) {
        
        // all data after fromDate
        if (fromDate !== undefined && toDate === undefined) {
            dateString = ``;
        }

        // all data before toDate
        if (toDate !== undefined && fromDate === undefined) {
            dateString = ``;
        }

        // all data between fromDate and toDate
        if (fromDate !== undefined && toDate !== undefined) {
            dateString = ``;
        }

    }

    // handle location search
    let locationString = '';

    if (sites.length !== 0 || counties.length !== 0 || states.length !== 0) {
        locationString = 
        `
            (
            p2.name IN ['${states.join("','")}']
            OR p1.name IN ['${counties.join("','")}']
            OR p.name IN ['${sites.join("','")}']            
            )
        `;
    }


    // handle coordinate range
    let coordString = '';

    if ((minLat !== '' && maxLat !== '') || (minLon !== '' && maxLon !== '')) {

        // if latitude range is defined and longitude isn't
        if ((minLat !== '' && maxLat !== '') && (minLon === '' || maxLon === '')) {
            coordString = 
            `
                (
                s.latitudes[0] >= ${minLat} 
                AND s.latitudes[0] <= ${maxLat}
                )
            `;
        }
        // if longitude range is defined and latitude isn't
        if ((minLon !== '' && maxLon !== '') && (minLat === '' || maxLat === '')) {
            coordString = 
            `
                (
                s.longitudes[0] >= ${minLon} 
                AND s.longitudes[0] <= ${maxLon}
                )
            `;
        }
        // if both latitude and longitude ranges are defined
        if (minLat !== '' && maxLat !== '' && minLon !== '' && maxLon !== '') {
            coordString = 
            `
                (
                s.longitudes[0] >= ${minLon} 
                AND s.longitudes[0] <= ${maxLon} 
                AND s.latitudes[0] >= ${minLat} 
                AND s.latitudes[0] <= ${maxLat}
                )
            `;
        }

    }


    // handle taxonomic search
    let taxString = 
    `
        (
        n.name IN ['${species.join("','")}'] 
        OR g.name IN ['${genus.join("','")}']
        OR f.name IN ['${family.join("','")}']
        OR o.name IN ['${order.join("','")}']
        OR c.name IN ['${tax_class.join("','")}']
        )
    `;

    
    if (species.length === 0 && genus.length === 0 && family.length === 0 && order.length === 0 && tax_class.length === 0) {
        
        taxString = '';

    }

    let cypherString = '';
    
    cypherString = taxString !== '' || locationString !== '' || coordString !== '' ? matchString : '';

    cypherString = cypherString !== '' ? taxString !== '' ? cypherString + taxString : cypherString : '';

    cypherString = cypherString !== '' ? locationString !== '' ? taxString !== '' ? cypherString + " AND " + locationString : cypherString + locationString : cypherString : '';

    cypherString = cypherString !== '' ? coordString !== '' ? taxString !== '' || locationString !== '' ? cypherString + " AND " + coordString : cypherString + coordString : cypherString : '';

    cypherString = cypherString !== '' ? dateString !== '' ? taxString !== '' || locationString !== '' || coordString !== '' ? cypherString + " AND " + dateString : cypherString + dateString : cypherString : '';

    cypherString = cypherString !== '' ? cypherString + " RETURN * " : '';


    return cypherString;


};




export {query_to_cypher};
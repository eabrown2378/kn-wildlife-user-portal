
// function to translate query object to cypher code

const query_to_cypher = ({       
            species, genus, family, order, tax_class, 
            maxLat, minLat, maxLon, minLon, 
            sites, states, counties, datasets, 
            fromMonth, toMonth, fromDay, toDay, fromYear, toYear
        }) => {

    // initial match statement to return complete chain of nodes and edges from neo4j
    let matchString = "MATCH (c:TaxClass)<-[b4:BELONGS_TO]-(o:Order)<-[b3:BELONGS_TO]-(f:Family)<-[b2:BELONGS_TO]-(g:Genus)<-[b1:BELONGS_TO]-(n:Species)<-[r:OBSERVED_ORGANISM]-(p:Observation)-[i:OBSERVED_IN]->(s:Site)-[s1:IN_COUNTY]->(p1:County)-[s2:IN_STATE]->(p2:State)";

    // concatenate dates
    let fromDate = undefined;
    let toDate = undefined;

    if (fromMonth !== "" && fromDay !== "" && fromYear !== "") {
        fromDate = [fromYear, fromMonth, fromDay].join("-");
    }

    if (toMonth !== "" && toDay !== "" && toYear !== "") {
        toDate = [toYear, toMonth, toDay].join("-");
    }

    // query by date
    let dateString = '';

    if (fromDate !== undefined || toDate !== undefined) {
        
        // all data after fromDate
        if (fromDate !== undefined && toDate === undefined) {
            dateString = 
            `
                (
                datesFormatted >= date("${fromDate}")
                )
            `;
        }

        // all data before toDate
        if (toDate !== undefined && fromDate === undefined) {
            dateString = 
            `
                (
                datesFormatted <= date("${toDate}")
                )
            `;
        }

        // all data between fromDate and toDate
        if (fromDate !== undefined && toDate !== undefined) {
            dateString = 
            `
                (
                datesFormatted >= date("${fromDate}")
                AND datesFormatted <= date("${toDate}")
                )
            `;
        }

    }

    if (dateString !== '') {
        matchString = matchString + 
            `            
                UNWIND p.date AS dates 
                WITH c, b4, o, b3, f, b2, g, b1, n, r, p, i, s, s1, p1, s2, p2, [item in split(dates, "-") | toInteger(item)] AS dateComponents
                WITH c, b4, o, b3, f, b2, g, b1, n, r, p, i, s, s1, p1, s2, p2, date({day: dateComponents[1], month: dateComponents[0], year: dateComponents[2]}) AS datesFormatted
                WHERE
            `;        
    } else {
        matchString = matchString + ' WHERE ';
    }

    // handle location search
    let locationString = '';

    if (sites.length !== 0 || counties.length !== 0 || states.length !== 0) {
        locationString = 
        `
            (
            p2.name IN ['${states.join("','")}']
            OR p1.name IN ['${counties.join("','")}']
            OR s.name IN ['${sites.join("','")}']            
            )
        `;
    }


    // handle coordinate range
    let coordString = '';

    if (minLat !== '' || maxLat !== '' || minLon !== '' || maxLon !== '') {
            coordString = 
            `
                (
                s.longitudes[0] >= ${minLon === '' ? -180 : minLon} 
                AND s.longitudes[0] <= ${maxLon === '' ? 180 : maxLon} 
                AND s.latitudes[0] >= ${minLat === '' ? -90 : minLat} 
                AND s.latitudes[0] <= ${maxLat === '' ? 90 : maxLat}
                )
            `;

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
    
    cypherString = taxString !== '' || locationString !== '' || coordString !== '' || dateString !== '' ? matchString : '';

    cypherString = cypherString !== '' ? taxString !== '' ? cypherString + taxString : cypherString : '';

    cypherString = cypherString !== '' ? locationString !== '' ? taxString !== '' ? cypherString + " AND " + locationString : cypherString + locationString : cypherString : '';

    cypherString = cypherString !== '' ? coordString !== '' ? taxString !== '' || locationString !== '' ? cypherString + " AND " + coordString : cypherString + coordString : cypherString : '';

    cypherString = cypherString !== '' ? dateString !== '' ? taxString !== '' || locationString !== '' || coordString !== '' ? cypherString + " AND " + dateString : cypherString + dateString : cypherString : '';

    cypherString = cypherString !== '' ? cypherString + " RETURN c, b4, o, b3, f, b2, g, b1, n, r, p, i, s, s1, p1, s2, p2 " : '';


    return cypherString;


};




export {query_to_cypher};
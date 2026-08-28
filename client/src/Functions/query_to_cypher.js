
/**
 * The last day of a month, so an open-ended "to" bound covers the whole month.
 *
 * Day 0 of the following month is the last day of this one, and December rolls over to
 * January on its own. Leap-year correct for century years, where a `year % 4` test is not.
 */
function lastDayOfMonth(year, month) {
    return new Date(year, month, 0).getDate();
}


// function to translate query object to cypher code

const query_to_cypher = ({       
            species, genus, family, order, tax_class, 
            maxLat, minLat, maxLon, minLon, 
            states, counties, datasets, dataTypes,
            fromMonth, toMonth, fromDay, toDay, fromYear, toYear,
            locHier, taxHier, covars
        }) => {

    // whether the search constrains the county/state hierarchy at all
    const hasLocationFilter = states.length !== 0 || counties.length !== 0;

    // A site on open water sits in no county and no state, because county boundaries stop
    // at the shoreline and a point in the middle of a lake lies between states rather than
    // inside one. The database records those sites against their Country instead, so the
    // county and state come back empty for them and reach the user as NA.
    //
    // When the search filters on state or county, the county chain is required: such a site
    // has no state and so cannot satisfy those filters anyway, and requiring it lets neo4j
    // seek from the State index rather than scan every observation.
    const locationMatch = hasLocationFilter
        ? `MATCH (p2:State)<-[s2:IN_STATE]-(p1:County)<-[s1:IN_COUNTY]-(s:Site)<-[i:OBSERVED_IN]-(p:Observation)-[z:FROM_DATASET]->(d:Dataset)`
        : `MATCH (s:Site)<-[i:OBSERVED_IN]-(p:Observation)-[z:FROM_DATASET]->(d:Dataset)
            OPTIONAL MATCH (s)-[s1:IN_COUNTY]->(p1:County)-[s2:IN_STATE]->(p2:State)`;

    // The spatial filter is applied here, against the first MATCH, rather than being left to
    // the WHERE further down.
    //
    // Everything below expands three OPTIONAL MATCH chains through the taxonomy for every
    // observation the first MATCH produced, and the WHERE cannot run before that because it
    // tests the coalesced taxonomy variables. So a search for one genus in one state was
    // expanding all 1.17 million observations across the whole taxonomy and only then
    // discarding the 99% that were not in Iowa - which exhausted the transaction memory and
    // was reported to the user as "this search returned too much data" for a result of a few
    // hundred rows.
    //
    // p2 and p1 are bound by the first MATCH, so the same predicate placed here cuts the row
    // count before any of that expansion happens. It is repeated in the WHERE below rather
    // than moved, which costs nothing and keeps the two readable independently.
    const earlyLocationFilter = hasLocationFilter
        ? `\n            WHERE (p2.name IN ['${states.join("','")}'] OR p1.name IN ['${counties.join("','")}'])`
        : '';

    // initial match statement to return complete chain of nodes and edges from neo4j
    let matchString = `
        ${locationMatch}${earlyLocationFilter}
            OPTIONAL MATCH (p)-[r1:OBSERVED_ORGANISM]->(n:Species)-[b1:BELONGS_TO]->(g1:Genus)-[b21:BELONGS_TO]->(f1:Family)-[b31:BELONGS_TO]->(o1:Order)-[b41:BELONGS_TO]->(c1:TaxClass)
            OPTIONAL MATCH (p)-[r2:OBSERVED_ORGANISM]->(g2:Genus)-[b22:BELONGS_TO]->(f2:Family)-[b32:BELONGS_TO]->(o2:Order)-[b42:BELONGS_TO]->(c2:TaxClass)
            OPTIONAL MATCH (p)-[r3:OBSERVED_ORGANISM]->(f3:Family)-[b33:BELONGS_TO]->(o3:Order)-[b43:BELONGS_TO]->(c3:TaxClass)
            WITH p, n, z, d, b1, p1, p2, s, s1, s2, i, coalesce(g1, g2) AS g, coalesce(r1, r2, r3) AS r, coalesce(b21, b22) AS b2, coalesce(f1, f2, f3) AS f, coalesce(b31, b32, b33) AS b3, coalesce(o1, o2, o3) AS o, coalesce(b41, b42, b43) AS b4, coalesce(c1, c2, c3) AS c
    `;

    /*"MATCH (p:Observation)-[i:OBSERVED_IN]->(s:Site)-[s1:IN_COUNTY]->(p1:County)-[s2:IN_STATE]->(p2:State), 
    (p)-[z:FROM_DATASET]->(d:Dataset) OPTIONAL MATCH (c:TaxClass)<-[b4:BELONGS_TO]-(o:Order)<-[b3:BELONGS_TO]-(f:Family)
    <-[b2:BELONGS_TO]-(g:Genus)<-[b1:BELONGS_TO]-(n:Species)<-[r:OBSERVED_ORGANISM]-(p)"*/

    // concatenate dates
    let fromDate = undefined;
    let toDate = undefined;

    // A year on its own is a complete request: "from 2000 to 2010" means the whole of both
    // years. The open end of each bound is filled in - the start of the period for "from",
    // the end of it for "to".
    if (fromYear !== "") {
        fromDate = [fromYear,
                    fromMonth !== "" ? fromMonth : "01",
                    fromDay !== "" ? String(fromDay).padStart(2, "0") : "01"].join("-");
    }

    if (toYear !== "") {
        const month = toMonth !== "" ? toMonth : "12";
        const day = toDay !== "" ? String(toDay).padStart(2, "0")
                                 : String(lastDayOfMonth(Number(toYear), Number(month))).padStart(2, "0");
        toDate = [toYear, month, day].join("-");
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
                UNWIND toString(p.date) AS dates 
                WITH c, b4, o, b3, f, b2, g, b1, n, r, p, i, s, s1, p1, s2, p2, z, d, [item in split(dates, "-") | toInteger(item)] AS dateComponents
                WITH c, b4, o, b3, f, b2, g, b1, n, r, p, i, s, s1, p1, s2, p2, z, d, date({day: dateComponents[2], month: dateComponents[1], year: dateComponents[0]}) AS datesFormatted
                WHERE
            `;        
    } else {
        matchString = matchString + ' WHERE ';
    }

    // handle location search
    let locationString = '';

    if (counties.length !== 0 || states.length !== 0) {
        // States and counties are OR'd, for the same reason the taxonomic ranks are. Naming
        // Iowa together with a county of Iowa is not a contradiction to be arbitrated: Adair
        // sits inside Iowa, so the union is simply Iowa. Dropping the state list whenever a
        // county was chosen - which is what `locHier` did - made "all of Iowa plus two
        // counties in Nebraska" impossible to ask for.
        locationString =
        `
            (
            p2.name IN ['${states.join("','")}']
            OR p1.name IN ['${counties.join("','")}']
            )
        `;
    }


    // handle coordinate range
    let coordString = '';

    if (minLat !== '' || maxLat !== '' || minLon !== '' || maxLon !== '') {
            coordString = 
            `
                (
                toFloat(s.longitude_dd) >= ${minLon === '' ? -180 : minLon} 
                AND toFloat(s.longitude_dd) <= ${maxLon === '' ? 180 : maxLon} 
                AND toFloat(s.latitude_dd) >= ${minLat === '' ? -90 : minLat} 
                AND toFloat(s.latitude_dd) <= ${maxLat === '' ? 90 : maxLat}
                )
            `;

    }


    // Handle taxonomic search.
    //
    // Every named taxon is included, whatever rank it sits at, and the ranks are OR'd. That
    // is the union of the groups the user named, which is the only reading that makes sense
    // across taxa: nothing is both Aves and Micropterus, so there is no intersection to
    // offer. Naming a taxon and something inside it is not a contradiction either - the
    // union of a group and its subset is the group - so no rule is needed to arbitrate it.
    //
    // This is why `taxHier` is gone. It existed because five independent rank dropdowns
    // could express combinations with no meaning, and it resolved them by discarding the
    // coarser selections. That made it impossible to search a class, a genus and a species
    // together, which is precisely what the chip search is for.
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

    // handle dataset search
    let datasetString = '';

    if (datasets.length !== 0) {
        datasetString =
        `
            (
                d.name IN ['${datasets.join("','")}'] 
            )
        `;
    }

    // handle data type search
    let dataTypeString = '';

    if (dataTypes.length !== 0) {
        dataTypeString =
        `
            (
                r.measurement_type IN ['${dataTypes.join("','")}'] 
            )
        `;
    }

    let cypherString = '';
    
    cypherString = taxString !== '' || locationString !== '' || coordString !== '' || dateString !== '' || datasetString !== '' || dataTypeString !== '' ? matchString : '';

    cypherString = cypherString !== '' ? taxString !== '' ? cypherString + taxString : cypherString : '';

    cypherString = cypherString !== '' ? locationString !== '' ? taxString !== '' ? cypherString + " AND " + locationString : cypherString + locationString : cypherString : '';

    cypherString = cypherString !== '' ? coordString !== '' ? taxString !== '' || locationString !== '' ? cypherString + " AND " + coordString : cypherString + coordString : cypherString : '';

    cypherString = cypherString !== '' ? dateString !== '' ? taxString !== '' || locationString !== '' || coordString !== '' ? cypherString + " AND " + dateString : cypherString + dateString : cypherString : '';

    cypherString = cypherString !== '' ? datasetString !== '' ? taxString !== '' || locationString !== '' || coordString !== '' || dateString !== '' ? cypherString + " AND " + datasetString : cypherString + datasetString : cypherString : '';
    
    cypherString = cypherString !== '' ? dataTypeString !== '' ? taxString !== '' || locationString !== '' || coordString !== '' || dateString !== '' || datasetString !== '' ? cypherString + " AND " + dataTypeString : cypherString + dataTypeString : cypherString : '';


    // "MATCH (c:TaxClass)<-[b4:BELONGS_TO]-(o:Order)<-[b3:BELONGS_TO]-(f:Family)<-[b2:BELONGS_TO]-(g:Genus)<-[b1:BELONGS_TO]-(n:Species)<-[r:OBSERVED_ORGANISM]-(p:Observation)
    // -[i:OBSERVED_IN]->(s:Site)-[s1:IN_COUNTY]->(p1:County)-[s2:IN_STATE]->(p2:State), (p)-[z:FROM_DATASET]->(d:Dataset)"

    // covariate fields to fold into the csv projection's map literal
    const covarMapString = covars.map((item) => `, ${item}: p.${item}`).join("");

    // derive all four output shapes (vis: graph nodes/relationships, csv: flat observation rows,
    // map: leaflet marker rows, meta: dataset metadata) from the same matched rows via one
    // aggregating WITH
    const cypherQuery = cypherString !== '' ? cypherString + `
        WITH collect(DISTINCT n) + collect(DISTINCT g) + collect(DISTINCT f) + collect(DISTINCT o) + collect(DISTINCT c) AS visNodes,
            collect(DISTINCT b1) + collect(DISTINCT b2) + collect(DISTINCT b3) + collect(DISTINCT b4) + collect(DISTINCT s2) AS visRels,
            collect(DISTINCT CASE WHEN p1 IS NOT NULL THEN {p1_elementId: elementId(p1), county_fips: p1.county_fips, name: p1.name} END) AS visCounties,
            collect(DISTINCT CASE WHEN p2 IS NOT NULL THEN {p2_elementId: elementId(p2), state_fips: p2.state_fips, state_abbrev: p2.state_abbrev, name: p2.name} END) AS visStates,
            collect({
                species: n.name, genus: g.name, family: f.name, \`order\`: o.name, class: c.name,
                longitude_dd: s.longitude_dd, latitude_dd: s.latitude_dd,
                coordinate_uncertainty_m: s.coordinate_uncertainty_m,
                is_polygon: coalesce(s.is_polygon, false), geo_asWKT: s.geo_asWKT,
                state: p2.name, county: p1.name, state_fips: p2.state_fips, county_fips: p1.county_fips,
                date: toString(p.date), dataset: d.name,
                observation_url: p.source_url, record_licence: p.record_licence,
                rights_holder: p.rights_holder,
                agency_organization_researchGroup: d.agency_organization_researchGroup, program_name: d.program_name,
                measurement_result: coalesce(r.measurement_value_numeric, r.measurement_value_text),
                measurement_unit: r.measurement_unit, measurement_type: r.measurement_type,
                sampling_method: r.sampling_method,
                sampling_effort: coalesce(r.sampling_effort_numeric, r.sampling_effort_text),
                sampling_effort_unit: r.sampling_effort_unit${covarMapString}
            }) AS csv,
            collect({
                site: s.name, date: toString(p.date),
                longitude_dd: s.longitude_dd, latitude_dd: s.latitude_dd,
                species: n.name, genus: g.name, family: f.name,
                dataset: d.name,
                measurement_result: r.measurement_value_numeric, measurement_type: r.measurement_type,
                measurement_unit: r.measurement_unit
            }) AS map,
            collect(DISTINCT {
                datasetName: d.name, citations: d.dataset_citations, urls: d.dataset_urls, downloadDate: d.download_date, notes: d.additional_notes
            }) AS meta
        RETURN visNodes + visRels + visCounties + visStates AS vis, csv, map, meta
    ` : '';

    return {cypherQuery};


};




export {query_to_cypher};
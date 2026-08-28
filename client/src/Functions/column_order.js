// Put result columns in a readable order.
//
// The query builds its rows as a Cypher map, and the driver hands the keys back sorted
// alphabetically. That scatters columns that belong together: the taxonomic ranks arrive as
// class, then family and genus several columns later, then order, then species, with county
// and dates interleaved between them. Nothing is wrong with the data, but a reader has to
// hunt across the table to assemble one idea.
//
// So columns are grouped by what they describe, and each group is ordered the way a person
// reads it. The taxonomy runs from the broadest rank to the finest, matching the column
// order of the taxonomy CSVs the database is built from. A value is followed immediately by
// the unit that qualifies it, because a number without its unit is not an answer.
//
// Anything not named here keeps its relative order and goes at the end. Covariate columns
// are added to the query dynamically and cannot be listed in advance, so an unrecognised
// column must never be dropped.

const COLUMN_GROUPS = [
    // what was found
    ["class", "order", "family", "genus", "species"],
    // where it was found, each coordinate followed by how precisely it is known
    ["latitude_dd", "longitude_dd", "coordinate_uncertainty_m", "is_polygon", "geo_asWKT",
     "county", "county_fips", "state", "state_fips"],
    // when
    ["date"],
    // what was measured, each value beside its unit
    ["measurement_type", "measurement_result", "measurement_unit"],
    // how the measuring was done
    ["sampling_method", "sampling_effort", "sampling_effort_unit"],
    // where the record came from, and who owns it
    ["dataset", "program_name", "agency_organization_researchGroup",
     "observation_url", "record_licence", "rights_holder"],
];

const PREFERRED = COLUMN_GROUPS.flat();

/**
 * Order a set of column names for display and for the CSV download.
 *
 * @param {string[]} headers column names as they arrived
 * @returns {string[]} the same names, grouped and ordered; unknown names keep their
 *                     original relative order and follow the known ones
 */
function order_columns(headers) {
    if (!Array.isArray(headers)) return [];

    const present = new Set(headers);
    const known = PREFERRED.filter((name) => present.has(name));
    const knownSet = new Set(known);
    const rest = headers.filter((name) => !knownSet.has(name));

    return [...known, ...rest];
}

export { order_columns, COLUMN_GROUPS };

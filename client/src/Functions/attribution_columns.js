// Columns that carry attribution for the records a download contains.
//
// GBIF's data user agreement requires two things of anyone passing records on. The
// identifier of ownership has to travel with every record shared onward for reuse, and the
// licence each publisher selected governs what may be done with that record - a single
// download mixes CC0, CC-BY and CC-BY-NC, so the licence is per record and not per dataset.
// Roughly nine in ten iNaturalist records are non-commercial, which a user downloading a
// CSV has no way to discover unless the column is there.
//
// They are only meaningful for the sources that supply them. finsyncR observations have no
// per-record licence or occurrence URL, so on a result set with no iNaturalist rows at all
// the columns would be three empty columns and nothing else; they are dropped in that case.
// Where a search returns both, the columns stay and the non-iNaturalist rows read NA, which
// is what every other absent value in these exports reads.

const ATTRIBUTION_COLUMNS = ["observation_url", "record_licence", "rights_holder"];

const has_value = (value) =>
    value !== null && value !== undefined && String(value).trim() !== "";

/**
 * Drop the attribution columns when nothing in the result set fills them.
 *
 * @param {Array} rows result rows, as objects
 * @returns {Array} the same rows, without attribution keys if no row carried one
 */
function strip_unused_attribution(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return rows;

    const used = ATTRIBUTION_COLUMNS.filter((column) =>
        rows.some((row) => has_value(row[column])));
    if (used.length === ATTRIBUTION_COLUMNS.length) return rows;

    const drop = new Set(ATTRIBUTION_COLUMNS.filter((column) => !used.includes(column)));
    return rows.map((row) => {
        const kept = {};
        for (const [key, value] of Object.entries(row)) {
            if (!drop.has(key)) kept[key] = value;
        }
        return kept;
    });
}

/** The distinct licences present, for the note that ships with a download. */
function licences_present(rows) {
    if (!Array.isArray(rows)) return [];
    return [...new Set(rows.map((row) => row.record_licence).filter(has_value))].sort();
}

export { strip_unused_attribution, licences_present, ATTRIBUTION_COLUMNS };

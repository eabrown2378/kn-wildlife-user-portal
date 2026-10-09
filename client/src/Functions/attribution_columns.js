// Attribution for the records a download contains.
//
// GBIF's data user agreement requires two things of anyone passing records on. The
// identifier of ownership has to travel with every record shared onward for reuse, and the
// licence each publisher selected governs what may be done with that record. A single
// download mixes CC0, CC-BY and CC-BY-NC, so the licence is per record. The record_licence and
// rights_holder columns appear whenever a returned dataset carries them.

const has_value = (value) =>
    value !== null && value !== undefined && String(value).trim() !== "";

/** The distinct licences present, for the note that ships with a download. */
function licences_present(rows) {
    if (!Array.isArray(rows)) return [];
    return [...new Set(rows.map((row) => row.record_licence).filter(has_value))].sort();
}

export { licences_present };

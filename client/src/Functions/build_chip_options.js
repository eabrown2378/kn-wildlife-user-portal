// Build one flat, searchable list of taxa (and one of places) for the chip search fields.
//
// The search used to offer a separate dropdown per rank, which forced two awkward things on
// a user. They had to know which rank a taxon sits at before they could find it, and because
// five independent lists can express combinations that mean nothing - class Aves together
// with family Cyprinidae - the app needed a "hierarchical" switch to guess which reading was
// intended. That switch applied to the whole search at once, so it could not express "all
// herons, plus this one bass genus, plus that one species": turning it on discarded the
// coarser selections, and turning it off collapsed any nested pair into its broader member.
//
// A flat index removes the problem rather than resolving it. Every taxon at every rank is one
// entry, labelled with its rank and its lineage, and the search returns the union of whatever
// entries were chosen. Each chip is its own group named at whatever level suits it, so mixing
// levels is the normal case rather than a mode.
//
// The same applies to places. Selecting Iowa and Adair (Iowa) is not a contradiction needing
// a rule: Adair sits inside Iowa, so the union simply is Iowa. And "all of Iowa plus two
// counties in Nebraska", which the old state/county pair could not express at all, is just
// three chips.

// Broadest first, so a search for a name that exists at several ranks offers the coarser
// reading first and the label reads like a lineage.
const TAX_RANKS = [
    {key: "kingdom", label: "kingdom"},
    {key: "phylum", label: "phylum"},
    {key: "tax_class", label: "class"},
    {key: "order", label: "order"},
    {key: "family", label: "family"},
    {key: "genus", label: "genus"},
    {key: "species", label: "species"},
];

// Which query field each rank's chips are written back into. The chip UI is a presentation
// layer over the existing per-rank query arrays, so the Cypher builder and the API contract
// are untouched by the redesign.
const RANK_TO_QUERY_FIELD = {
    kingdom: "kingdoms",
    phylum: "phyla",
    tax_class: "tax_class",
    order: "order",
    family: "family",
    genus: "genus",
    species: "species",
};

const clean = (value) => (typeof value === "string" ? value.trim() : "");

/**
 * One searchable entry per distinct taxon, at every rank present in the data.
 *
 * @param {Array} taxMap rows of {kingdom, phylum, tax_class, order, family, genus, species, dataset}
 * @returns {Array} react-select options carrying the rank and lineage of each taxon
 */
function build_taxon_options(taxMap) {
    if (!Array.isArray(taxMap)) return [];

    // Keyed by rank, name *and* lineage. Keying by rank and name alone silently drops one of
    // every homonym: Arenaria is a sandpiper in Scolopacidae and a sandwort in
    // Caryophyllaceae, and whichever the loop met second would vanish, leaving a user
    // searching for a plant to pick a bird without being told. Because the resolved taxonomy
    // guarantees one parent per taxon, a genuine taxon has exactly one lineage and only a
    // true homonym produces two entries - which is what the lineage on each row is for.
    const seen = new Map();

    for (const row of taxMap) {
        // the lineage above whichever rank we are recording, built as we descend
        const ancestors = [];
        for (const {key, label} of TAX_RANKS) {
            const name = clean(row[key]);
            if (!name) continue;

            const lineage = ancestors.join(" › ");
            const id = `${key}::${name}::${lineage}`;
            if (!seen.has(id)) {
                seen.set(id, {
                    value: id,
                    name,
                    rank: key,
                    rankLabel: label,
                    lineage,
                    // kept as a list as well as a string so the browser can restrict itself
                    // to what sits inside a chosen group without parsing the display text
                    ancestors: [...ancestors],
                    label: name,
                });
            }
            ancestors.push(name);
        }
    }

    return [...seen.values()].sort((a, b) => {
        const rankOrder = TAX_RANKS.findIndex((r) => r.key === a.rank)
            - TAX_RANKS.findIndex((r) => r.key === b.rank);
        return a.name.localeCompare(b.name) || rankOrder;
    });
}

/**
 * One searchable entry per distinct state and county.
 *
 * County names already carry their state - "Adair (Iowa)" - so a chip identifies exactly one
 * county without needing the state field beside it.
 */
function build_place_options(locMap) {
    if (!Array.isArray(locMap)) return [];

    const seen = new Map();
    for (const row of locMap) {
        const state = clean(row.state);
        const county = clean(row.county);
        if (state && !seen.has(`state::${state}`)) {
            seen.set(`state::${state}`, {
                value: `state::${state}`, name: state, rank: "state",
                rankLabel: "state", lineage: "", ancestors: [], label: state,
            });
        }
        if (county && !seen.has(`county::${county}`)) {
            seen.set(`county::${county}`, {
                value: `county::${county}`, name: county, rank: "county",
                rankLabel: "county", lineage: state, ancestors: state ? [state] : [],
                label: county,
            });
        }
    }

    return [...seen.values()].sort((a, b) =>
        a.name.localeCompare(b.name) || a.rank.localeCompare(b.rank));
}

/**
 * Turn the chosen chips back into the per-rank arrays the query already expects.
 *
 * Returns an object of {queryField: [names]} covering every rank, so ranks with no chips are
 * explicitly cleared rather than left holding a previous search's values.
 */
function chips_to_query_fields(chips, rankToField) {
    const result = {};
    for (const field of Object.values(rankToField)) {
        result[field] = [];
    }
    for (const chip of chips || []) {
        const field = rankToField[chip.rank];
        if (field) result[field].push(chip.name);
    }
    return result;
}

export {
    build_taxon_options,
    build_place_options,
    chips_to_query_fields,
    TAX_RANKS,
    RANK_TO_QUERY_FIELD,
};

/**
 * What a search returns to somebody who is not signed in.
 *
 * Searching and looking at the results is open, so a visitor can judge whether the data suits
 * them. The records themselves are not: anything the server sends can be read by whatever is
 * driving the browser, scrapers and AI agents included, so a visitor is sent summaries the map
 * and graph can draw and nothing a record could be rebuilt from.
 *
 * Kept: sites merged onto a grid of about a kilometre, with how many records each holds, which
 * taxa, and the years they span; how many records fall under each taxon in each dataset; and
 * the dataset citations. Left out: every record row, exact coordinates, site names, dates
 * finer than a year, and measured values.
 */

// Decimal places a site's coordinates are rounded to. Two is about 1.1 km of latitude, which
// still places a site on a river or a county but not on a sampling point.
const SITE_PRECISION = 2;

// How many taxa each site names; the full site list is not sent.
const TOP_TAXA = 5;

const year = (date) => (typeof date === 'string' && /^\d{4}/.test(date) ? date.slice(0, 4) : null);

const round = (value) => Number(value.toFixed(SITE_PRECISION));

const finestTaxon = (row) => row.species || row.genus || row.family || null;

function widen(range, value) {
    if (value === null) return;
    if (range.earliest === null || value < range.earliest) range.earliest = value;
    if (range.latest === null || value > range.latest) range.latest = value;
}

/**
 * One entry per grid cell that holds records, in the shape the map's site popup reads.
 *
 * @param {Array} mapRows the search's per-observation map rows
 */
function previewSites(mapRows) {
    const cells = new Map();

    for (const row of mapRows || []) {
        const latitude = Number(row.latitude_dd);
        const longitude = Number(row.longitude_dd);
        if (row.latitude_dd === null || row.longitude_dd === null
            || !Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

        const lat = round(latitude);
        const lon = round(longitude);
        const key = `${lat},${lon}`;

        let cell = cells.get(key);
        if (!cell) {
            cell = {
                key, latitude: lat, longitude: lon, observations: 0,
                datasets: new Set(), species: new Set(), genera: new Set(), families: new Set(),
                taxa: new Map(), earliest: null, latest: null,
            };
            cells.set(key, cell);
        }

        cell.observations += 1;
        if (row.dataset) cell.datasets.add(row.dataset);
        if (row.species) cell.species.add(row.species);
        if (row.genus) cell.genera.add(row.genus);
        if (row.family) cell.families.add(row.family);
        const y = year(row.date);
        widen(cell, y);

        const name = finestTaxon(row);
        if (!name) continue;
        let taxon = cell.taxa.get(name);
        if (!taxon) {
            taxon = { name, records: 0, earliest: null, latest: null };
            cell.taxa.set(name, taxon);
        }
        taxon.records += 1;
        widen(taxon, y);
    }

    return [...cells.values()].map((cell) => ({
        key: cell.key,
        latitude: cell.latitude,
        longitude: cell.longitude,
        name: null,
        approximate: true,
        summary: {
            observations: cell.observations,
            samplingEvents: 0,
            datasets: [...cell.datasets].sort(),
            speciesCount: cell.species.size,
            generaCount: cell.genera.size,
            familiesCount: cell.families.size,
            earliest: cell.earliest,
            latest: cell.latest,
            topTaxa: [...cell.taxa.values()]
                .sort((a, b) => b.records - a.records || a.name.localeCompare(b.name))
                .slice(0, TOP_TAXA)
                .map((taxon) => ({ ...taxon, measured: false })),
            measured: false,
            measurementUnit: null,
            measurementType: null,
        },
    }));
}

const TAXON_KEYS = ['dataset', 'class', 'order', 'family', 'genus', 'species'];

/**
 * How many records fall under each lineage in each dataset, which is all the knowledge graph
 * needs. Each entry carries a `count` the graph builder weights it by.
 *
 * @param {Array} rows the search's record rows
 */
function previewTaxa(rows) {
    const lineages = new Map();
    for (const row of rows || []) {
        const entry = {};
        for (const key of TAXON_KEYS) entry[key] = row[key] ?? null;
        const id = TAXON_KEYS.map((key) => entry[key] ?? '').join('|');
        const seen = lineages.get(id);
        if (seen) seen.count += 1;
        else lineages.set(id, { ...entry, count: 1 });
    }
    return [...lineages.values()];
}

/** The preview of a full search result. */
function previewOf(result) {
    const rows = (result && result.csv) || [];
    return {
        preview: true,
        recordCount: rows.length,
        sites: previewSites(result && result.map),
        taxa: previewTaxa(rows),
        meta: (result && result.meta) || [],
    };
}

module.exports = { previewOf, previewSites, previewTaxa, SITE_PRECISION };

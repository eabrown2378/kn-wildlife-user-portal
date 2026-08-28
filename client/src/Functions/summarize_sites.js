// Collapse per-observation map rows into one entry per sampling site.
//
// The map projection returns a row per observation, and a busy site can hold hundreds of
// them at identical coordinates. Plotted one marker per row, those markers stack exactly
// on top of each other and the cluster fans them into a spoked circle that says nothing
// about the place. One marker per site, carrying a summary of what was recorded there, is
// both far fewer markers and far more informative.
//
// What the summary should say depends on what the dataset records. A density dataset gives a
// value per taxon per sampling event, so the useful summary is the distribution of those
// values and how many events it covers. An occurrence dataset gives no value at all, so the
// useful summary is how often the taxon was recorded and over what period.

// Records identified only to genus or family have no species name, so the taxon shown is
// the finest rank the observation actually reached.
const finest_taxon = (row) => row.species || row.genus || row.family || null;

const rank_of = (row) => (row.species ? "species" : row.genus ? "genus" : row.family ? "family" : null);

// A measurement is only comparable within a dataset that reports one; occurrence records
// carry no value and are summarised by how often a taxon was seen instead.
const measured_value = (row) => {
    // Number(null) is 0, so an absent measurement would otherwise rank as a real zero and
    // the "most abundant" list would come back sorted alphabetically at nought.
    if (row.measurement_result === null || row.measurement_result === undefined || row.measurement_result === "") {
        return null;
    }
    const value = Number(row.measurement_result);
    return Number.isFinite(value) ? value : null;
};

// A sampling event is one visit: one date, in one dataset, at this site. Two datasets that
// happen to have sampled the same place on the same day are separate events, and collapsing
// them would understate the effort behind a summary.
const event_key = (row) => `${row.dataset || ""}|${row.date || ""}`;

/** Median of an already-sorted array of numbers. */
const median_of = (sorted) => {
    if (sorted.length === 0) return null;
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1
        ? sorted[middle]
        : (sorted[middle - 1] + sorted[middle]) / 2;
};

/**
 * Summarise one taxon's measured values across the sampling events at a site.
 *
 * Two decisions matter here.
 *
 * Values are averaged per event rather than summed. A sum of densities across visits is not
 * a density and not a count; it grows with how often somebody happened to sample the site,
 * so a well-studied place would always outrank a rich one.
 *
 * The average covers only the events where the taxon was present. The benthic matrices
 * record a genuine zero when a taxon was looked for and not found, and averaging those in
 * mixes two different questions - how much of it is there when it is there, against how
 * often it is there at all - so that a locally abundant but patchy taxon and a uniformly
 * sparse one report the same figure. How often it was found is reported separately instead.
 *
 * @param {number[]} values one value per event in which the taxon has a record
 * @returns {object|null} the distribution over events where it was present, or null
 */
const describe_measurements = (values) => {
    if (values.length === 0) return null;
    const present = values.filter((value) => value > 0).sort((a, b) => a - b);
    if (present.length === 0) {
        // looked for at least once and never found: a real result, but not a density
        return {assessed: values.length, detections: 0};
    }
    const total = present.reduce((sum, value) => sum + value, 0);
    return {
        assessed: values.length,
        detections: present.length,
        events: present.length,
        mean: total / present.length,
        median: median_of(present),
        min: present[0],
        max: present[present.length - 1],
    };
};

/**
 * Group map rows by site coordinate.
 *
 * @param {Array} mapData rows from the query's `map` projection
 * @param {number} topTaxaLimit how many taxa to name in each summary
 * @returns {Array} one entry per site, each with a `summary` describing its observations
 */
function summarize_sites(mapData, topTaxaLimit = 5) {
    if (!Array.isArray(mapData)) return [];

    const sites = new Map();

    for (const row of mapData) {
        const latitude = Number(row.latitude_dd);
        const longitude = Number(row.longitude_dd);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

        // the coordinate identifies the site; names are absent for many sources
        const key = `${latitude},${longitude}`;
        let site = sites.get(key);
        if (!site) {
            site = {
                key,
                latitude,
                longitude,
                names: new Set(),
                datasets: new Set(),
                species: new Set(),
                genera: new Set(),
                families: new Set(),
                observations: 0,
                events: new Set(),
                earliest: null,
                latest: null,
                taxa: new Map(),
                measurementUnits: new Set(),
                measurementTypes: new Set(),
            };
            sites.set(key, site);
        }

        site.observations += 1;
        if (row.site) site.names.add(row.site);
        if (row.dataset) site.datasets.add(row.dataset);
        if (row.species) site.species.add(row.species);
        if (row.genus) site.genera.add(row.genus);
        if (row.family) site.families.add(row.family);
        if (row.date) {
            site.events.add(event_key(row));
            if (site.earliest === null || row.date < site.earliest) site.earliest = row.date;
            if (site.latest === null || row.date > site.latest) site.latest = row.date;
        }

        const name = finest_taxon(row);
        if (!name) continue;

        let taxon = site.taxa.get(name);
        if (!taxon) {
            taxon = {name, records: 0, values: [], events: new Set(), earliest: null, latest: null};
            site.taxa.set(name, taxon);
        }
        taxon.records += 1;
        if (row.date) {
            taxon.events.add(event_key(row));
            if (taxon.earliest === null || row.date < taxon.earliest) taxon.earliest = row.date;
            if (taxon.latest === null || row.date > taxon.latest) taxon.latest = row.date;
        }

        const value = measured_value(row);
        if (value !== null) {
            taxon.values.push(value);
            if (row.measurement_unit) site.measurementUnits.add(row.measurement_unit);
            if (row.measurement_type) site.measurementTypes.add(row.measurement_type);
        }
    }

    return [...sites.values()].map((site) => {
        const taxa = [...site.taxa.values()].map((taxon) => {
            const stats = describe_measurements(taxon.values);
            const detected = stats !== null && stats.detections > 0;

            // How often it was found, and out of what. Where the dataset records zeros, the
            // denominator is the events in which this taxon was assessed and "detected in"
            // is a true statement. Where it records only positive rows, absence is not
            // evidenced anywhere, so the denominator is the site's sampling events and the
            // honest wording is "recorded in" - the popup picks its words from this flag.
            const zerosRecorded = stats !== null && stats.assessed > stats.detections;

            return {
                name: taxon.name,
                measured: detected,
                detections: stats ? stats.detections : taxon.events.size,
                assessed: zerosRecorded ? stats.assessed : site.events.size,
                zerosRecorded,
                // how many visits this taxon's summary is built from, which is what tells a
                // reader whether a spread is meaningful or is one number wearing five hats
                events: detected ? stats.events : taxon.events.size,
                records: taxon.records,
                earliest: taxon.earliest,
                latest: taxon.latest,
                ...(detected ? {mean: stats.mean, median: stats.median, min: stats.min, max: stats.max} : {}),
                // what the list is ranked and labelled by
                value: detected ? stats.mean : taxon.records,
            };
        });

        // Rank by mean measured amount where the dataset reports one, and by how often the
        // taxon was recorded where it does not, so the list means the same thing as the
        // label above it.
        const measured = taxa.some((taxon) => taxon.measured);
        const ranked = taxa
            .filter((taxon) => (measured ? taxon.measured : true))
            .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));

        return {
            key: site.key,
            latitude: site.latitude,
            longitude: site.longitude,
            name: [...site.names][0] || null,
            summary: {
                observations: site.observations,
                samplingEvents: site.events.size,
                datasets: [...site.datasets].sort(),
                speciesCount: site.species.size,
                generaCount: site.genera.size,
                familiesCount: site.families.size,
                earliest: site.earliest,
                latest: site.latest,
                topTaxa: ranked.slice(0, topTaxaLimit),
                measured,
                measurementUnit: [...site.measurementUnits][0] || null,
                measurementType: [...site.measurementTypes][0] || null,
            },
        };
    });
}

export { summarize_sites, finest_taxon, rank_of, describe_measurements, median_of };

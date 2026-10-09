/**
 * The columns a search result can carry, where each one is read from, and when it appears.
 *
 * A universal column appears in every result and reads NA wherever a record has no value, as
 * species does on a record identified only to genus. A dataset-specific column appears when a
 * dataset in the result declares one of the graph properties it lists under `requires`, and
 * reads NA on rows from the other datasets. The pipeline writes those declarations onto each
 * Dataset node (observation_fields, site_fields, organism_fields, dataset_fields), so this file
 * names graph properties by the same element and property names the pipeline uses.
 *
 * A column is filled in one of two ways:
 *
 * - `cypher` reads a per-record value in the search query, from nodes it has already matched:
 *   p the Observation, s its Site, r the OBSERVED_ORGANISM relationship, the rank variables and
 *   the county and state.
 * - `dataset` names a value the pipeline stores once on the Dataset node. The query reads it
 *   once per dataset into meta, and completeRows copies it onto each row. A column with both
 *   takes the record's value where there is one, which covers a graph built before the value
 *   moved to the Dataset node.
 *
 * Reading dataset values once per dataset keeps the per-row projection small, and a projection
 * with more expressions is measurably slower to evaluate across the rows a search walks.
 */

const COLUMNS = [
    { name: 'class', cypher: 'c.name' },
    { name: 'order', cypher: 'o.name' },
    { name: 'family', cypher: 'f.name' },
    { name: 'genus', cypher: 'g.name' },
    { name: 'species', cypher: 'n.name' },

    { name: 'site', cypher: 's.name' },
    { name: 'latitude_dd', cypher: 's.latitude_dd' },
    { name: 'longitude_dd', cypher: 's.longitude_dd' },
    { name: 'coordinate_uncertainty_m', cypher: 's.coordinate_uncertainty_m',
      requires: [['Site', 'coordinate_uncertainty_m']] },
    { name: 'is_polygon', cypher: 'coalesce(s.is_polygon, false)' },
    { name: 'geo_asWKT', cypher: 's.geo_asWKT' },
    { name: 'coordinate_datum', dataset: 'coordinateDatum' },
    // True when the stored coordinate was converted from the datum the source published on. The
    // source datum itself is not a column, so a reader is never shown a second datum beside
    // coordinates that are already converted. Worked out in completeRows.
    { name: 'datum_converted', derived: true },
    { name: 'county', cypher: 'p1.name' },
    { name: 'county_fips', cypher: 'p1.county_fips' },
    { name: 'state', cypher: 'p2.name' },
    { name: 'state_fips', cypher: 'p2.state_fips' },

    { name: 'date', cypher: 'toString(p.date)' },

    { name: 'measurement_type', dataset: 'dataType' },
    { name: 'measurement_result', cypher: 'coalesce(r.measurement_value_numeric, r.measurement_value_text)',
      dataset: 'measurementValue' },
    { name: 'measurement_unit', cypher: 'r.measurement_unit', dataset: 'measurementUnit',
      requires: [['Dataset', 'measurement_unit']] },

    { name: 'sampling_method', cypher: 'coalesce(p.sampling_method, r.sampling_method)',
      dataset: 'samplingMethod',
      requires: [['Observation', 'sampling_method'], ['Dataset', 'sampling_method']] },
    { name: 'sampling_effort',
      cypher: 'coalesce(p.sampling_effort_numeric, r.sampling_effort_numeric, r.sampling_effort_text)',
      requires: [['Observation', 'sampling_effort_numeric']] },
    { name: 'sampling_effort_unit', cypher: 'coalesce(p.sampling_effort_unit, r.sampling_effort_unit)',
      dataset: 'samplingEffortUnit',
      requires: [['Observation', 'sampling_effort_unit'], ['Dataset', 'sampling_effort_unit']] },
    { name: 'reach_length_fished_m', cypher: 'p.reach_length_fished_m',
      requires: [['Observation', 'reach_length_fished_m']] },
    { name: 'PropID', cypher: 'p.prop_id', requires: [['Observation', 'prop_id']] },
    { name: 'Gen_ID_Prop', cypher: 'p.gen_id_prop', requires: [['Observation', 'gen_id_prop']] },

    { name: 'dataset', cypher: 'd.name' },
    { name: 'program_name', dataset: 'programName' },
    { name: 'agency_organization_researchGroup', dataset: 'agency' },
    { name: 'observation_url', cypher: 'p.source_url', requires: [['Observation', 'source_url']] },
    { name: 'record_licence', cypher: 'p.record_licence', requires: [['Observation', 'record_licence']] },
    { name: 'rights_holder', cypher: 'p.rights_holder', requires: [['Observation', 'rights_holder']] },
];

// Read per row so datum_converted can be worked out, and removed from the row afterwards.
const SITE_SOURCE_DATUM = 'source_datum';

// The list that says a dataset declares its columns at all. An element a dataset collects
// nothing for has no property, so the other three can be absent on a dataset that declares them.
const MARKER_LIST = 'observationFields';

/** The Dataset property each element's declared fields are stored under, and its key in meta. */
const FIELD_LISTS = [
    { element: 'Observation', property: 'observation_fields', key: 'observationFields' },
    { element: 'Site', property: 'site_fields', key: 'siteFields' },
    { element: 'OBSERVED_ORGANISM', property: 'organism_fields', key: 'organismFields' },
    { element: 'Dataset', property: 'dataset_fields', key: 'datasetFields' },
];

/** The per-dataset values meta carries, by meta key. */
const DATASET_VALUES = {
    programName: 'd.program_name',
    agency: 'd.agency_organization_researchGroup',
    dataType: 'head(d.data_type)',
    measurementValue: 'd.measurement_value',
    measurementUnit: 'd.measurement_unit',
    samplingMethod: 'd.sampling_method',
    samplingEffortUnit: 'd.sampling_effort_unit',
    coordinateDatum: 'd.coordinate_datum',
    sourceDatum: 'd.source_datum',
};

/** The csv map entries read per record: every column with a query expression, and the site's source datum. */
function csvProjectionEntries() {
    const entries = COLUMNS.filter((column) => column.cypher)
        .map((column) => `\`${column.name}\`: ${column.cypher}`);
    entries.push(`\`${SITE_SOURCE_DATUM}\`: s.source_datum`);
    return entries.join(',\n            ');
}

/** The meta map entries that carry a dataset's declared fields and its per-dataset values. */
function datasetMetaEntries() {
    const fields = FIELD_LISTS.map((list) => `${list.key}: d.${list.property}`);
    const values = Object.entries(DATASET_VALUES).map(([key, cypher]) => `${key}: ${cypher}`);
    return [...fields, ...values].join(', ');
}

/** The declared field lists, for a query reading Dataset nodes on their own. */
function fieldListEntries(alias = 'd') {
    return FIELD_LISTS.map((list) => `${list.key}: ${alias}.${list.property}`).join(', ');
}

const present = (value) => value !== null && value !== undefined;

/**
 * Copy each dataset's values onto its rows and work out datum_converted.
 *
 * `meta` holds at most one entry per dataset in the result, so this is a lookup per row.
 */
function completeRows(rows, meta) {
    const byName = new Map((meta || []).map((entry) => [entry.datasetName, entry]));
    const datasetColumns = COLUMNS.filter((column) => column.dataset);
    for (const row of rows || []) {
        const dataset = byName.get(row.dataset) || {};
        for (const column of datasetColumns) {
            if (!present(row[column.name])) {
                row[column.name] = present(dataset[column.dataset]) ? dataset[column.dataset] : null;
            }
        }
        const sourceDatum = present(row[SITE_SOURCE_DATUM]) ? row[SITE_SOURCE_DATUM] : dataset.sourceDatum;
        row.datum_converted = present(sourceDatum) && present(dataset.coordinateDatum)
            ? sourceDatum !== dataset.coordinateDatum
            : null;
        // Undefined keys are left out when the response is serialised.
        row[SITE_SOURCE_DATUM] = undefined;
    }
    return rows;
}

/** Fill the map rows' measurement type and unit from their datasets. */
function completeMapRows(rows, meta) {
    const byName = new Map((meta || []).map((entry) => [entry.datasetName, entry]));
    for (const row of rows || []) {
        const dataset = byName.get(row.dataset) || {};
        if (present(dataset.dataType)) row.measurement_type = dataset.dataType;
        if (!present(row.measurement_unit) && present(dataset.measurementUnit)) {
            row.measurement_unit = dataset.measurementUnit;
        }
    }
    return rows;
}

/**
 * True when a dataset carries field lists; a graph built before the lists existed has none.
 *
 * A dataset declares nothing for an element by holding no property for it, so only
 * observation_fields decides. Every dataset declares at least one observation column, and a
 * pre-construction test keeps that true.
 */
function hasFieldLists(dataset) {
    return Array.isArray(dataset && dataset[MARKER_LIST]);
}

/** The "Element.property" names a set of datasets declares. An absent list declares nothing. */
function declaredFields(datasets) {
    const declared = new Set();
    for (const dataset of datasets) {
        for (const list of FIELD_LISTS) {
            for (const property of dataset[list.key] || []) {
                declared.add(`${list.element}.${property}`);
            }
        }
    }
    return declared;
}

function appears(column, declared) {
    return !column.requires
        || column.requires.some(([element, property]) => declared.has(`${element}.${property}`));
}

/**
 * The columns a result carries, in registry order, followed by the covariates chosen.
 *
 * `datasets` are the meta entries of the result. When any of them has no field lists the graph
 * predates them, and every column is returned so nothing a record holds is hidden.
 */
function columnsFor(datasets, covariates = []) {
    const entries = Array.isArray(datasets) ? datasets : [];
    let names = COLUMNS.map((column) => column.name);
    if (entries.every(hasFieldLists)) {
        const declared = declaredFields(entries);
        names = COLUMNS.filter((column) => appears(column, declared)).map((column) => column.name);
    }
    return [...names, ...covariates.filter((key) => !names.includes(key))];
}

/** The dataset-specific columns one dataset adds, or null when the graph has no field lists. */
function datasetColumns(dataset) {
    if (!hasFieldLists(dataset)) return null;
    const declared = declaredFields([dataset]);
    return COLUMNS.filter((column) => column.requires && appears(column, declared))
        .map((column) => column.name);
}

/**
 * Write null for every property the database has never stored.
 *
 * Neo4j resolves a known property name once when it plans a query, but looks up a name it has
 * never seen on every row, which is several times slower on a search that walks many rows. A
 * property the database has never stored is null on every record, so null gives the same result.
 * `knownKeys` is the database's property names; without it the query is returned unchanged.
 */
function nullUnknownProperties(query, knownKeys) {
    if (!knownKeys) return query;
    return query.replace(/\b(p|s|r|d)\.([A-Za-z_][A-Za-z0-9_]*)\b/g,
        (match, alias, key) => (knownKeys.has(key) ? match : 'null'));
}

module.exports = {
    COLUMNS,
    FIELD_LISTS,
    DATASET_VALUES,
    csvProjectionEntries,
    datasetMetaEntries,
    fieldListEntries,
    completeRows,
    completeMapRows,
    columnsFor,
    datasetColumns,
    nullUnknownProperties,
};

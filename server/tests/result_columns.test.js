const test = require('node:test');
const assert = require('node:assert');

const { COLUMNS, FIELD_LISTS, columnsFor, completeMapRows, completeRows, datasetColumns,
        nullUnknownProperties } = require('../neo4j_calls/result_columns');
const { projection } = require('../neo4j_calls/build_cypher');

// The pipeline writes a list only when it has entries, so a dataset that collects nothing
// for an element arrives with no property for it.
function dataset(fields = {}) {
    const node = {};
    for (const [element, key] of [['Observation', 'observationFields'], ['Site', 'siteFields'],
                                  ['OBSERVED_ORGANISM', 'organismFields'],
                                  ['Dataset', 'datasetFields']]) {
        if (fields[element]) node[key] = fields[element];
    }
    return node;
}

const INATURALIST = dataset({ Observation: ['source_url', 'record_licence', 'rights_holder'],
                              Site: ['coordinate_uncertainty_m'] });
const FISH = dataset({ Observation: ['sampling_method', 'sampling_effort_numeric', 'sampling_effort_unit',
                                     'reach_length_fished_m'],
                       OBSERVED_ORGANISM: ['measurement_value_numeric'], Dataset: ['measurement_unit'] });
const BENTHIC = dataset({ Observation: ['sampling_effort_numeric', 'prop_id', 'gen_id_prop'],
                          OBSERVED_ORGANISM: ['measurement_value_numeric'],
                          Dataset: ['measurement_unit', 'sampling_method', 'sampling_effort_unit'] });

const UNIVERSAL = COLUMNS.filter((column) => !column.requires).map((column) => column.name);

test('column names are unique', () => {
    const names = COLUMNS.map((column) => column.name);
    assert.equal(new Set(names).size, names.length);
});

test('every requirement names an element the pipeline declares', () => {
    const elements = new Set(FIELD_LISTS.map((list) => list.element));
    for (const column of COLUMNS) {
        for (const [element] of column.requires || []) {
            assert.ok(elements.has(element), `${column.name} requires unknown element ${element}`);
        }
    }
});

test('the projection reads every per-record column and meta every dataset value', () => {
    const text = projection(['tmean_annual']);
    for (const column of COLUMNS.filter((c) => c.cypher)) {
        assert.ok(text.includes(`\`${column.name}\`:`), `${column.name} is not projected`);
    }
    for (const column of COLUMNS.filter((c) => c.dataset && !c.cypher)) {
        assert.ok(!text.includes(`\`${column.name}\`:`), `${column.name} is read per row`);
    }
    assert.match(text, /tmean_annual: p\.tmean_annual/);
    assert.match(text, /observationFields: d\.observation_fields/);
    assert.match(text, /coordinateDatum: d\.coordinate_datum/);
});

test('every column is filled one way or another', () => {
    for (const column of COLUMNS) {
        assert.ok(column.cypher || column.dataset || column.derived, `${column.name} has no source`);
    }
});

test('universal columns appear in every result', () => {
    for (const datasets of [[], [INATURALIST], [FISH], [BENTHIC]]) {
        const columns = columnsFor(datasets);
        for (const name of UNIVERSAL) assert.ok(columns.includes(name), `${name} missing`);
    }
});

test('an iNaturalist result carries attribution and uncertainty and no sampling columns', () => {
    const columns = columnsFor([INATURALIST]);
    for (const name of ['observation_url', 'record_licence', 'rights_holder', 'coordinate_uncertainty_m']) {
        assert.ok(columns.includes(name), name);
    }
    for (const name of ['measurement_unit', 'sampling_method', 'sampling_effort', 'reach_length_fished_m', 'PropID']) {
        assert.ok(!columns.includes(name), name);
    }
});

test('a fish result carries reach length and effort and no identification proportions', () => {
    const columns = columnsFor([FISH]);
    for (const name of ['measurement_unit', 'sampling_method', 'sampling_effort', 'sampling_effort_unit',
                        'reach_length_fished_m']) {
        assert.ok(columns.includes(name), name);
    }
    assert.ok(!columns.includes('PropID'));
    assert.ok(!columns.includes('observation_url'));
});

test('a benthic result carries the identification proportions and the dataset-level method', () => {
    const columns = columnsFor([BENTHIC]);
    for (const name of ['PropID', 'Gen_ID_Prop', 'sampling_method', 'sampling_effort_unit', 'measurement_unit']) {
        assert.ok(columns.includes(name), name);
    }
    assert.ok(!columns.includes('reach_length_fished_m'));
});

test('a mixed result carries the columns of every dataset in it', () => {
    const columns = columnsFor([INATURALIST, BENTHIC]);
    assert.ok(columns.includes('observation_url'));
    assert.ok(columns.includes('PropID'));
});

test('a graph without field lists returns every column', () => {
    assert.deepEqual(columnsFor([{ datasetName: 'old' }]), COLUMNS.map((column) => column.name));
});

test('covariates follow the columns', () => {
    const columns = columnsFor([INATURALIST], ['tmean_annual']);
    assert.equal(columns[columns.length - 1], 'tmean_annual');
});

test('a dataset lists only the columns it adds', () => {
    assert.deepEqual(datasetColumns(INATURALIST),
        ['coordinate_uncertainty_m', 'observation_url', 'record_licence', 'rights_holder']);
    assert.equal(datasetColumns({}), null);
});

test('dataset values are copied onto rows, and a record value is kept where there is one', () => {
    const meta = [{ datasetName: 'fish', measurementUnit: 'individuals/unit_sampling_effort/reach_length_fished_m',
                    dataType: 'density', programName: 'BioData', coordinateDatum: 'NAD83' }];
    const rows = completeRows([
        { dataset: 'fish', measurement_unit: null, sampling_method: 'Seine', source_datum: 'NAD27' },
        { dataset: 'fish', measurement_unit: 'kept', sampling_method: null, source_datum: 'NAD83' },
    ], meta);
    assert.equal(rows[0].measurement_unit, 'individuals/unit_sampling_effort/reach_length_fished_m');
    assert.equal(rows[1].measurement_unit, 'kept');
    assert.equal(rows[0].measurement_type, 'density');
    assert.equal(rows[0].program_name, 'BioData');
    assert.equal(rows[0].sampling_method, 'Seine');
    assert.equal(rows[1].sampling_method, null);
    assert.equal(rows[0].coordinate_datum, 'NAD83');
});

test('datum_converted compares the source datum with the stored one', () => {
    const meta = [
        { datasetName: 'biodata', coordinateDatum: 'NAD83' },
        { datasetName: 'inat', coordinateDatum: 'WGS84', sourceDatum: 'WGS84' },
        { datasetName: 'old graph' },
    ];
    const rows = completeRows([
        { dataset: 'biodata', source_datum: 'NAD27' },
        { dataset: 'biodata', source_datum: 'NAD83' },
        { dataset: 'inat', source_datum: null },
        { dataset: 'old graph', source_datum: null },
    ], meta);
    assert.deepEqual(rows.map((row) => row.datum_converted), [true, false, false, null]);
    assert.ok(rows.every((row) => row.source_datum === undefined));
    assert.ok(!JSON.stringify(rows).includes('source_datum'));
});

test('map rows take their measurement type and unit from the dataset', () => {
    const rows = completeMapRows([{ dataset: 'fish', measurement_type: null, measurement_unit: null }],
        [{ datasetName: 'fish', dataType: 'density', measurementUnit: 'u' }]);
    assert.equal(rows[0].measurement_type, 'density');
    assert.equal(rows[0].measurement_unit, 'u');
});

test('properties the database has never stored are written as null', () => {
    const known = new Set(['name', 'latitude_dd']);
    const query = 'RETURN s.name, s.source_datum, p.prop_id, p1.name, anchorTaxon.name, d.name, x:Species';
    assert.equal(nullUnknownProperties(query, known),
        'RETURN s.name, null, null, p1.name, anchorTaxon.name, d.name, x:Species');
    assert.equal(nullUnknownProperties(query, null), query);
});

test('a dataset with no list for an element still declares its columns', () => {
    // Every finsyncR dataset arrives without siteFields, and both iNaturalist datasets without
    // organismFields or datasetFields.
    assert.ok(!('siteFields' in FISH), 'the fixture should omit the empty list');
    const columns = columnsFor([FISH]);
    assert.ok(columns.includes('reach_length_fished_m'), 'declared columns must still appear');
    assert.ok(!columns.includes('coordinate_uncertainty_m'),
              'a column no dataset declares must stay out');
    assert.deepEqual(datasetColumns(FISH).includes('reach_length_fished_m'), true);
});

test('a dataset from a graph built before the lists existed returns every column', () => {
    const columns = columnsFor([{}]);
    assert.equal(columns.length, COLUMNS.length);
    assert.equal(datasetColumns({}), null);
});

test('mixing a declaring dataset with a pre-declaration one returns every column', () => {
    assert.equal(columnsFor([FISH, {}]).length, COLUMNS.length);
});

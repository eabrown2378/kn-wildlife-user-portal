const test = require('node:test');
const assert = require('node:assert');

const { previewOf } = require('../neo4j_calls/preview');

function result() {
    const csv = [
        { dataset: 'A', class: 'Insecta', order: 'Diptera', family: 'Chironomidae', genus: 'Tanytarsus', species: null,
          site: 'Secret Creek 1', latitude_dd: 41.70312, longitude_dd: -86.23891, date: '2019-06-14' },
        { dataset: 'A', class: 'Insecta', order: 'Diptera', family: 'Chironomidae', genus: 'Tanytarsus', species: null,
          site: 'Secret Creek 2', latitude_dd: 41.70388, longitude_dd: -86.23802, date: '2021-07-02' },
        { dataset: 'B', class: 'Aves', order: 'Passeriformes', family: 'Turdidae', genus: 'Turdus', species: 'Turdus migratorius',
          site: 'Far Field', latitude_dd: 40.1, longitude_dd: -85.5, date: '2020-01-01' },
    ];
    const map = csv.map((row) => ({
        site: row.site, date: row.date, latitude_dd: row.latitude_dd, longitude_dd: row.longitude_dd,
        species: row.species, genus: row.genus, family: row.family, dataset: row.dataset,
        measurement_result: 12.5, measurement_type: 'density', measurement_unit: 'n/m2',
    }));
    return { csv, map, meta: [{ datasetName: 'A' }, { datasetName: 'B' }], columns: ['class'] };
}

test('a preview carries no record rows and no column list', () => {
    const preview = previewOf(result());
    assert.strictEqual(preview.preview, true);
    assert.strictEqual(preview.recordCount, 3);
    assert.strictEqual(preview.csv, undefined);
    assert.strictEqual(preview.map, undefined);
    assert.strictEqual(preview.columns, undefined);
});

test('nearby sites merge onto one rounded cell and keep no name', () => {
    const { sites } = previewOf(result());
    assert.strictEqual(sites.length, 2);
    const creek = sites.find((site) => site.summary.observations === 2);
    assert.strictEqual(creek.latitude, 41.7);
    assert.strictEqual(creek.longitude, -86.24);
    assert.strictEqual(creek.name, null);
});

test('nothing finer than a year, and no measured value, survives', () => {
    const text = JSON.stringify(previewOf(result()));
    for (const leaked of ['2019-06-14', '41.70312', '-86.23891', 'Secret Creek', '12.5', 'n/m2']) {
        assert.ok(!text.includes(leaked), `preview contains ${leaked}`);
    }
    const creek = previewOf(result()).sites.find((site) => site.summary.observations === 2);
    assert.strictEqual(creek.summary.earliest, '2019');
    assert.strictEqual(creek.summary.latest, '2021');
    assert.deepStrictEqual(creek.summary.topTaxa,
        [{ name: 'Tanytarsus', records: 2, earliest: '2019', latest: '2021', measured: false }]);
});

test('taxa are counted per lineage per dataset', () => {
    const { taxa } = previewOf(result());
    assert.strictEqual(taxa.length, 2);
    const midge = taxa.find((entry) => entry.genus === 'Tanytarsus');
    assert.deepStrictEqual(midge, { dataset: 'A', class: 'Insecta', order: 'Diptera',
        family: 'Chironomidae', genus: 'Tanytarsus', species: null, count: 2 });
});

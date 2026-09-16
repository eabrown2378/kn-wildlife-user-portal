const test = require('node:test');
const assert = require('node:assert');

const { normaliseFilters, FilterError, MAX_LIST_LENGTH, MAX_VALUE_LENGTH }
    = require('../neo4j_calls/query_filters');

const COVARIATES = new Set(['tmean_annual', 'ppt_annual', 'elevation_m']);

/** The shape the search panel sends when nothing has been chosen. */
function emptySearch(overrides = {}) {
    return {
        species: [], genus: [], family: [], order: [], tax_class: [],
        states: [], counties: [], datasets: [], dataTypes: [], covars: [],
        fromYear: '', toYear: '', fromMonth: '', toMonth: '', fromDay: '', toDay: '',
        minLat: '', maxLat: '', minLon: '', maxLon: '',
        ...overrides,
    };
}

test('an empty search is recognised as naming no filter', () => {
    const filters = normaliseFilters(emptySearch(), COVARIATES);
    assert.equal(filters.hasAnyFilter, false);
    assert.equal(filters.hasTaxonFilter, false);
    assert.equal(filters.hasLocationFilter, false);
});

test('blank and duplicate values are dropped, order preserved', () => {
    const filters = normaliseFilters(
        emptySearch({ genus: ['Micropterus', '', 'Lepomis', 'Micropterus', '  '] }),
        COVARIATES);
    assert.deepEqual(filters.genus, ['Micropterus', 'Lepomis']);
});

test('values are trimmed', () => {
    const filters = normaliseFilters(emptySearch({ states: ['  Iowa  '] }), COVARIATES);
    assert.deepEqual(filters.states, ['Iowa']);
});

test('a single value may arrive without being wrapped in a list', () => {
    const filters = normaliseFilters(emptySearch({ states: 'Iowa' }), COVARIATES);
    assert.deepEqual(filters.states, ['Iowa']);
});

test('a list longer than the cap is refused', () => {
    const tooMany = Array.from({ length: MAX_LIST_LENGTH + 1 }, (_, i) => `taxon ${i}`);
    assert.throws(
        () => normaliseFilters(emptySearch({ species: tooMany }), COVARIATES),
        FilterError);
});

test('a value longer than the cap is refused', () => {
    const tooLong = 'x'.repeat(MAX_VALUE_LENGTH + 1);
    assert.throws(
        () => normaliseFilters(emptySearch({ species: [tooLong] }), COVARIATES),
        FilterError);
});

test('a non-string entry is refused', () => {
    assert.throws(
        () => normaliseFilters(emptySearch({ species: [{ name: 'Aves' }] }), COVARIATES),
        FilterError);
});

test('a year alone covers the whole year at both ends', () => {
    const filters = normaliseFilters(
        emptySearch({ fromYear: '2000', toYear: '2010' }), COVARIATES);
    assert.equal(filters.fromDate, '2000-01-01');
    assert.equal(filters.toDate, '2010-12-31');
});

test('an open-ended month runs to its last day, leap years included', () => {
    const leap = normaliseFilters(
        emptySearch({ toYear: '2000', toMonth: '2' }), COVARIATES);
    assert.equal(leap.toDate, '2000-02-29');

    const common = normaliseFilters(
        emptySearch({ toYear: '1900', toMonth: '2' }), COVARIATES);
    assert.equal(common.toDate, '1900-02-28');
});

test('a date range running backwards is refused', () => {
    assert.throws(
        () => normaliseFilters(emptySearch({ fromYear: '2010', toYear: '2000' }), COVARIATES),
        FilterError);
});

test('coordinates outside their range are refused', () => {
    assert.throws(
        () => normaliseFilters(emptySearch({ minLat: '-200' }), COVARIATES), FilterError);
    assert.throws(
        () => normaliseFilters(emptySearch({ maxLon: '999' }), COVARIATES), FilterError);
});

test('a coordinate box running backwards is refused', () => {
    assert.throws(
        () => normaliseFilters(emptySearch({ minLat: '50', maxLat: '10' }), COVARIATES),
        FilterError);
});

test('a covariate the graph does not declare is dropped', () => {
    const filters = normaliseFilters(
        emptySearch({ covars: ['tmean_annual', 'p.password', 'made_up'] }), COVARIATES);
    assert.deepEqual(filters.covars, ['tmean_annual']);
});

test('no covariate is accepted when the graph declares none', () => {
    const filters = normaliseFilters(
        emptySearch({ covars: ['tmean_annual'] }), new Set());
    assert.deepEqual(filters.covars, []);
});

test('a body that is not an object is refused', () => {
    assert.throws(() => normaliseFilters(null, COVARIATES), FilterError);
    assert.throws(() => normaliseFilters([], COVARIATES), FilterError);
    assert.throws(() => normaliseFilters('Aves', COVARIATES), FilterError);
});

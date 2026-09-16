const test = require('node:test');
const assert = require('node:assert');

const { normaliseFilters } = require('../neo4j_calls/query_filters');
const { planQuery, LARGE_SEARCH_OBSERVATIONS } = require('../neo4j_calls/query_planner');
const { unavailable } = require('../neo4j_calls/graph_stats');

function emptySearch(overrides = {}) {
    return {
        species: [], genus: [], family: [], order: [], tax_class: [],
        states: [], counties: [], datasets: [], dataTypes: [], covars: [],
        fromYear: '', toYear: '', fromMonth: '', toMonth: '', fromDay: '', toDay: '',
        minLat: '', maxLat: '', minLon: '', maxLon: '',
        ...overrides,
    };
}

function filtersFor(overrides) {
    return normaliseFilters(emptySearch(overrides), new Set());
}

/**
 * Counts standing in for what the pipeline writes. The two classes are the real contrast the
 * planner exists for: comparable numbers of taxa, four orders of magnitude apart in records.
 */
function statsFixture(overrides = {}) {
    return {
        available: true,
        reason: null,
        totalObservations: 19758450,
        generatedAt: '2026-09-01T00:00:00Z',
        taxon: {
            Species: new Map([['Micropterus salmoides', 4210], ['Extinct one', 0]]),
            Genus: new Map([['Micropterus', 15300]]),
            Family: new Map([['Centrarchidae', 42000]]),
            Order: new Map([['Perciformes', 180000]]),
            TaxClass: new Map([['Aves', 13000000], ['Bivalvia', 8400]]),
        },
        county: new Map([['King (Washington)', 91000], ['Adair (Iowa)', 1200]]),
        state: new Map([['Washington', 412000], ['Iowa', 260000]]),
        dataset: new Map([['iNaturalist US Birds', 13000000], ['finsyncR Fish', 120000]]),
        ...overrides,
    };
}

test('a common class with a state anchors on the state', () => {
    // Aves reaches 13,000,000 observations nationwide; Washington holds 412,000.
    const plan = planQuery(
        filtersFor({ tax_class: ['Aves'], states: ['Washington'] }), statsFixture());

    assert.equal(plan.anchor, 'location');
    assert.equal(plan.estimates.taxon, 13000000);
    assert.equal(plan.estimates.location, 412000);
    assert.equal(plan.usedStatistics, true);
});

test('a rare class with a state anchors on the class', () => {
    // The structural rule the planner replaces would have chosen the state here, because a
    // place was named, and walked 412,000 observations to find 8,400.
    const plan = planQuery(
        filtersFor({ tax_class: ['Bivalvia'], states: ['Washington'] }), statsFixture());

    assert.equal(plan.anchor, 'taxon');
    assert.equal(plan.estimatedObservations, 8400);
});

test('a taxon with no place anchors on the taxon', () => {
    const plan = planQuery(filtersFor({ genus: ['Micropterus'] }), statsFixture());
    assert.equal(plan.anchor, 'taxon');
});

test('a place with no taxon anchors on the place', () => {
    const plan = planQuery(filtersFor({ counties: ['Adair (Iowa)'] }), statsFixture());
    assert.equal(plan.anchor, 'location');
});

test('ranks are summed, because they are OR-ed in the query', () => {
    const plan = planQuery(
        filtersFor({ genus: ['Micropterus'], family: ['Centrarchidae'] }), statsFixture());
    assert.equal(plan.estimates.taxon, 15300 + 42000);
});

test('the dataset filter narrows the row estimate without becoming the anchor', () => {
    const plan = planQuery(
        filtersFor({ tax_class: ['Aves'], datasets: ['finsyncR Fish'] }), statsFixture());

    assert.equal(plan.anchor, 'taxon');
    // Categories are AND-ed, so the result cannot exceed the narrowest of them.
    assert.equal(plan.estimatedObservations, 120000);
});

test('a taxon recorded at zero makes the whole search empty', () => {
    const plan = planQuery(filtersFor({ species: ['Extinct one'] }), statsFixture());

    assert.equal(plan.definitelyEmpty, true);
    assert.equal(plan.estimatedObservations, 0);
    assert.match(plan.emptyReason, /No observations/);
});

test('one recognised value keeps a search alive even beside a zero', () => {
    const plan = planQuery(
        filtersFor({ species: ['Extinct one', 'Micropterus salmoides'] }), statsFixture());
    assert.equal(plan.definitelyEmpty, false);
});

test('an unrecognised name is not treated as zero', () => {
    // A name with no recorded count says nothing. Reading it as empty would answer a real
    // search with no rows, which is the one failure this planner must never produce.
    const plan = planQuery(filtersFor({ species: ['Never counted'] }), statsFixture());
    assert.equal(plan.definitelyEmpty, false);
    assert.equal(plan.estimates.taxon, null);
});

test('an unrecognised name falls back to the structural anchor', () => {
    const plan = planQuery(
        filtersFor({ species: ['Never counted'], states: ['Washington'] }), statsFixture());

    // The place still carries a count, so it anchors there; nothing guesses at the taxon.
    assert.equal(plan.anchor, 'location');
    assert.equal(plan.estimates.taxon, null);
});

test('with no statistics the anchor comes from the shape of the search', () => {
    const stats = unavailable('the stage has not been run');

    const taxonOnly = planQuery(filtersFor({ tax_class: ['Aves'] }), stats);
    assert.equal(taxonOnly.anchor, 'taxon');
    assert.equal(taxonOnly.usedStatistics, false);

    const withPlace = planQuery(
        filtersFor({ tax_class: ['Aves'], states: ['Washington'] }), stats);
    assert.equal(withPlace.anchor, 'location');

    const placeOnly = planQuery(filtersFor({ states: ['Iowa'] }), stats);
    assert.equal(placeOnly.anchor, 'location');
});

test('missing statistics never make a search look empty', () => {
    const stats = unavailable('the stage has not been run');
    const plan = planQuery(filtersFor({ species: ['Anything'] }), stats);
    assert.equal(plan.definitelyEmpty, false);
});

test('a search over the threshold is reported as large', () => {
    const plan = planQuery(filtersFor({ tax_class: ['Aves'] }), statsFixture());
    assert.equal(plan.large, true);
    assert.ok(plan.estimatedObservations > LARGE_SEARCH_OBSERVATIONS);
});

test('a narrow search is not reported as large', () => {
    const plan = planQuery(filtersFor({ tax_class: ['Bivalvia'] }), statsFixture());
    assert.equal(plan.large, false);
});

test('a search naming nothing anchors on nothing', () => {
    const plan = planQuery(filtersFor({}), statsFixture());
    assert.equal(plan.anchor, 'none');
});

test('the anchor is always one the filters can support', () => {
    // A plan naming an anchor the search did not filter on would build a query that drops a
    // filter, so this holds across every combination the panel can produce.
    const combinations = [
        { tax_class: ['Aves'] },
        { states: ['Iowa'] },
        { tax_class: ['Bivalvia'], states: ['Washington'] },
        { datasets: ['finsyncR Fish'] },
        { dataTypes: ['density'] },
        { fromYear: '2000' },
        { genus: ['Never counted'], counties: ['Never counted either'] },
    ];

    for (const combination of combinations) {
        const filters = filtersFor(combination);
        const plan = planQuery(filters, statsFixture());
        if (plan.anchor === 'taxon') assert.ok(filters.hasTaxonFilter, JSON.stringify(combination));
        if (plan.anchor === 'location') assert.ok(filters.hasLocationFilter, JSON.stringify(combination));
    }
});

test('the large threshold can be lowered without a code change', () => {
    // KN_MAX_SEARCH_OBSERVATIONS feeds this, so the limit is deployable per host.
    const narrow = planQuery(filtersFor({ tax_class: ['Bivalvia'] }), statsFixture(),
        { largeThreshold: 1000 });
    assert.equal(narrow.large, true);

    const wide = planQuery(filtersFor({ tax_class: ['Bivalvia'] }), statsFixture(),
        { largeThreshold: 1000000 });
    assert.equal(wide.large, false);
});

test('a search is only refusable when an estimate backs it', () => {
    // The refusal in run_search is gated on usedStatistics as well as large, because without
    // counts there is no estimate and refusing would turn every search into an error.
    const stats = unavailable('the stage has not been run');
    const plan = planQuery(filtersFor({ tax_class: ['Aves'] }), stats);

    assert.equal(plan.usedStatistics, false);
    assert.equal(plan.large, false);
});

test('an unrecognised name does not make a search refusable', () => {
    // No estimate means no grounds to refuse. A real search must not be blocked because a
    // name is missing from the counts.
    const plan = planQuery(
        filtersFor({ species: ['Never counted'] }), statsFixture());

    assert.equal(plan.usedStatistics, false);
    assert.equal(plan.large, false);
});

test('a search naming nothing is flagged large and carries no statistics', () => {
    // run_search refuses this earlier, on hasAnyFilter, so the flag here must not be the only
    // thing standing between a caller and the whole graph.
    const plan = planQuery(filtersFor({}), statsFixture());
    assert.equal(plan.large, true);
    assert.equal(plan.usedStatistics, false);
});

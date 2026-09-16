const test = require('node:test');
const assert = require('node:assert');

const { normaliseFilters } = require('../neo4j_calls/query_filters');
const { buildCypher } = require('../neo4j_calls/build_cypher');

const COVARIATES = new Set(['tmean_annual', 'ppt_annual']);

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
    return normaliseFilters(emptySearch(overrides), COVARIATES);
}

const ANCHORS = ['taxon', 'location', 'none'];

test('no user-supplied value reaches the query text', () => {
    // The guarantee the parameter boundary rests on. The names here would break a query that
    // pasted them in, and one of them is a Cypher clause.
    const hostile = [
        "O'Brien",
        'Aves" OR 1=1 //',
        "x'] DETACH DELETE (n) //",
        'back\\slash',
    ];

    const filters = filtersFor({
        species: hostile,
        states: hostile,
        counties: hostile,
        datasets: hostile,
        dataTypes: hostile,
    });

    for (const anchor of ANCHORS) {
        const { query, parameters } = buildCypher(filters, anchor);
        for (const value of hostile) {
            assert.ok(!query.includes(value),
                `anchor ${anchor} pasted ${JSON.stringify(value)} into the query`);
        }
        assert.deepEqual(parameters.species, hostile);
    }
});

test('a covariate key reaches the projection, having been checked upstream', () => {
    const filters = filtersFor({ genus: ['Micropterus'], covars: ['tmean_annual'] });
    const { query } = buildCypher(filters, 'taxon');
    assert.match(query, /tmean_annual: p\.tmean_annual/);
});

test('an undeclared covariate never reaches the projection', () => {
    const filters = filtersFor({ genus: ['Micropterus'], covars: ['not_declared'] });
    const { query } = buildCypher(filters, 'taxon');
    assert.ok(!query.includes('not_declared'));
});

test('the taxon anchor starts from the taxa and consumes the taxon filter', () => {
    const filters = filtersFor({ tax_class: ['Bivalvia'] });
    const { query } = buildCypher(filters, 'taxon');

    assert.match(query, /MATCH \(anchorTaxon\)/);
    assert.match(query, /anchorTaxon:TaxClass AND anchorTaxon\.name IN \$taxClass/);
    // Kingdom down to species is six BELONGS_TO hops, so the anchor has to reach that far.
    assert.match(query, /BELONGS_TO\*0\.\.6/);
    // Consumed by the anchor, so it is not re-tested on the rank columns.
    assert.ok(!query.includes('c.name IN $taxClass'));
});

test('the location anchor starts from the places and consumes the place filter', () => {
    const filters = filtersFor({ states: ['Iowa'] });
    const { query } = buildCypher(filters, 'location');

    assert.match(query, /MATCH \(p1:County\)-\[:IN_STATE\]->\(p2:State\)/);
    assert.match(query, /p2\.name IN \$states/);
});

test('a filter the anchor does not consume is still applied', () => {
    // Anchoring on the place must still restrict the taxa, and the other way round. A filter
    // silently dropped here would return rows the user did not ask for.
    const both = filtersFor({ tax_class: ['Aves'], states: ['Washington'] });

    const onPlace = buildCypher(both, 'location').query;
    assert.match(onPlace, /c\.name IN \$taxClass/);

    const onTaxon = buildCypher(both, 'taxon').query;
    assert.match(onTaxon, /p2\.name IN \$states/);
});

test('every anchor applies every filter named', () => {
    const filters = filtersFor({
        tax_class: ['Aves'],
        states: ['Washington'],
        datasets: ['finsyncR Fish'],
        dataTypes: ['density'],
        fromYear: '2000',
        toYear: '2010',
        minLat: '40', maxLat: '50',
    });

    for (const anchor of ANCHORS) {
        const { query } = buildCypher(filters, anchor);
        assert.ok(query.includes('$taxClass'), `${anchor} dropped the taxon filter`);
        assert.ok(query.includes('$states'), `${anchor} dropped the place filter`);
        assert.ok(query.includes('$datasets'), `${anchor} dropped the dataset filter`);
        assert.ok(query.includes('$dataTypes'), `${anchor} dropped the data type filter`);
        assert.ok(query.includes('$fromDate'), `${anchor} dropped the start date`);
        assert.ok(query.includes('$toDate'), `${anchor} dropped the end date`);
        assert.ok(query.includes('$minLat'), `${anchor} dropped the coordinate box`);
    }
});

test('every anchor returns the same three shapes', () => {
    const filters = filtersFor({ tax_class: ['Aves'], states: ['Washington'] });
    for (const anchor of ANCHORS) {
        const { query } = buildCypher(filters, anchor);
        assert.match(query, /RETURN csv, map, meta$/);
    }
});

test('the place hops are optional wherever the search does not filter on them', () => {
    // An observation is a sampling event whose location is attached at whatever resolution the
    // source gives: a point, a county with no site, or a site on open water that sits in no
    // county. Requiring either hop drops those records.
    const filters = filtersFor({ genus: ['Micropterus'] });

    for (const anchor of ['taxon', 'none']) {
        const { query } = buildCypher(filters, anchor);
        assert.match(query, /OPTIONAL MATCH \(p\)-\[:OBSERVED_IN\]->\(s:Site\)/);
        assert.match(query, /OPTIONAL MATCH \(s\)-\[:IN_COUNTY\]->\(p1:County\)/);
    }
});

test('a date filter compares dates, not strings', () => {
    const filters = filtersFor({ fromYear: '2000', toYear: '2010' });
    const { query } = buildCypher(filters, 'none');
    assert.match(query, /observedOn >= date\(\$fromDate\)/);
    assert.match(query, /observedOn <= date\(\$toDate\)/);
});

test('an open-ended date range tests only the bound it was given', () => {
    const fromOnly = buildCypher(filtersFor({ fromYear: '2000' }), 'none').query;
    assert.ok(fromOnly.includes('$fromDate'));
    assert.ok(!fromOnly.includes('$toDate'));

    const toOnly = buildCypher(filtersFor({ toYear: '2010' }), 'none').query;
    assert.ok(toOnly.includes('$toDate'));
    assert.ok(!toOnly.includes('$fromDate'));
});

test('an anchor the filters cannot support falls back to one they can', () => {
    // The planner will not ask for this, but a query missing a filter is the worst outcome
    // available, so the builder refuses to produce one.
    const placeOnly = filtersFor({ states: ['Iowa'] });
    const { query } = buildCypher(placeOnly, 'taxon');

    assert.ok(!query.includes('MATCH (anchorTaxon)'));
    assert.match(query, /p2\.name IN \$states/);
});

test('a search naming nothing is refused', () => {
    assert.throws(() => buildCypher(filtersFor({}), 'none'), /whole graph/);
});

test('the query text is identical for two searches of the same shape', () => {
    // Fixed query text is what lets the database reuse a compiled plan across searches.
    const first = buildCypher(filtersFor({ tax_class: ['Aves'] }), 'taxon').query;
    const second = buildCypher(filtersFor({ tax_class: ['Bivalvia', 'Gastropoda'] }), 'taxon').query;
    assert.equal(first, second);
});

test('a kingdom or phylum filter is applied, at every anchor', () => {
    // Selecting one of these produced a search that ignored the selection entirely, so a
    // kingdom chip on its own returned every record in the graph.
    const filters = filtersFor({ kingdoms: ['Animalia'], phyla: ['Chordata'] });
    assert.equal(filters.hasTaxonFilter, true);

    for (const anchor of ANCHORS) {
        const { query } = buildCypher(filters, anchor);
        assert.ok(query.includes('$kingdoms'), `${anchor} dropped the kingdom filter`);
        assert.ok(query.includes('$phyla'), `${anchor} dropped the phylum filter`);
    }
});

test('the walk resolves every rank a filter can name', () => {
    const filters = filtersFor({ kingdoms: ['Animalia'] });
    const { query } = buildCypher(filters, 'none');

    // Each rank a filter can name needs a column to be tested against.
    for (const column of ['AS n', 'AS g', 'AS f', 'AS o', 'AS c', 'AS ph', 'AS k']) {
        assert.ok(query.includes(column), `the walk does not resolve ${column}`);
    }
});

test('every rank a filter can name has a parameter and a column', () => {
    const { TAXON_FIELDS } = require('../neo4j_calls/query_filters');
    const { RANK_PARAMS, RANK_COLUMNS } = require('../neo4j_calls/build_cypher');

    for (const [field, label] of TAXON_FIELDS) {
        assert.ok(RANK_PARAMS[label], `${field} has no query parameter`);
        assert.ok(RANK_COLUMNS[label], `${field} has no projected column`);
    }
});

test('every parameter the query names is supplied', () => {
    // A query naming $kingdoms with no kingdoms in the parameter map is rejected by the
    // driver at run time, which no amount of reading the query text reveals.
    const filters = filtersFor({
        species: ['Micropterus salmoides'], genus: ['Micropterus'],
        family: ['Centrarchidae'], order: ['Perciformes'], tax_class: ['Actinopterygii'],
        phyla: ['Chordata'], kingdoms: ['Animalia'],
        states: ['Iowa'], counties: ['Adair (Iowa)'],
        datasets: ['finsyncR Fish'], dataTypes: ['density'],
        fromYear: '2000', toYear: '2010',
        minLat: '40', maxLat: '50', minLon: '-100', maxLon: '-90',
    });

    for (const anchor of ANCHORS) {
        const { query, parameters } = buildCypher(filters, anchor);
        const named = new Set([...query.matchAll(/\$([A-Za-z_][A-Za-z0-9_]*)/g)]
            .map((match) => match[1]));

        for (const name of named) {
            assert.ok(Object.prototype.hasOwnProperty.call(parameters, name),
                `anchor ${anchor} names $${name} but does not supply it`);
        }
    }
});

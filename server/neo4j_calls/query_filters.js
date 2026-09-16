/**
 * Validation and normalisation of the search a client asks for.
 *
 * This is the boundary the request crosses. Everything downstream - the planner and the
 * Cypher builder - works on the object this module returns, so every check that decides
 * whether a value is acceptable lives here and runs once.
 *
 * Values reach the database as query parameters, so a name carrying a quote is data and
 * cannot alter the query. Two things still have to be checked here. A list long enough to
 * build an enormous query is refused, because a parameter list is still expanded by the
 * planner. And the covariate keys name properties in the projection, which no parameter can
 * express, so those are matched against the keys the graph declares.
 */

/** Rank filters, mapped from the field the client sends to the label the graph uses. */
const TAXON_FIELDS = [
    ['species', 'Species'],
    ['genus', 'Genus'],
    ['family', 'Family'],
    ['order', 'Order'],
    ['tax_class', 'TaxClass'],
    ['phyla', 'Phylum'],
    ['kingdoms', 'Kingdom'],
];

/** Every list-valued filter the search panel can fill. */
const LIST_FIELDS = [
    'species', 'genus', 'family', 'order', 'tax_class', 'phyla', 'kingdoms',
    'states', 'counties', 'datasets', 'dataTypes', 'covars',
];

/**
 * The longest selection accepted in any one dropdown.
 *
 * The search panel cannot produce a list this long by hand, and a parameter list is still
 * expanded when the query is planned, so an unbounded one is a way to make the database do
 * arbitrary work. Well above any real search and far below anything expensive.
 */
const MAX_LIST_LENGTH = 5000;

/** The longest single value accepted. Taxon and county names are far shorter. */
const MAX_VALUE_LENGTH = 200;

class FilterError extends Error {
    constructor(message) {
        super(message);
        this.name = 'FilterError';
        this.userFacing = true;
    }
}

/** A list of non-empty strings, deduplicated, order preserved. */
function stringList(value, field) {
    if (value === undefined || value === null || value === '') return [];

    const raw = Array.isArray(value) ? value : [value];

    if (raw.length > MAX_LIST_LENGTH) {
        throw new FilterError(`Too many values selected for ${field}.`);
    }

    const cleaned = [];
    const seen = new Set();

    for (const entry of raw) {
        if (entry === null || entry === undefined) continue;
        if (typeof entry !== 'string' && typeof entry !== 'number') {
            throw new FilterError(`${field} must be a list of names.`);
        }
        const text = String(entry).trim();
        if (text === '') continue;
        if (text.length > MAX_VALUE_LENGTH) {
            throw new FilterError(`A value selected for ${field} is too long.`);
        }
        if (seen.has(text)) continue;
        seen.add(text);
        cleaned.push(text);
    }

    return cleaned;
}

/** A finite number within bounds, or null when the field was left blank. */
function optionalNumber(value, field, low, high) {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        throw new FilterError(`${field} must be a number.`);
    }
    if (parsed < low || parsed > high) {
        throw new FilterError(`${field} must be between ${low} and ${high}.`);
    }
    return parsed;
}

/** An integer part of a date, or null when blank. */
function optionalInt(value, field, low, high) {
    const parsed = optionalNumber(value, field, low, high);
    if (parsed === null) return null;
    if (!Number.isInteger(parsed)) {
        throw new FilterError(`${field} must be a whole number.`);
    }
    return parsed;
}

/** The last day of a month, so an open-ended "to" bound covers the whole month. */
function lastDayOfMonth(year, month) {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * The date bounds a search asks for, as ISO strings the driver sends as date parameters.
 *
 * A year on its own is a complete request: "from 2000 to 2010" means the whole of both years.
 * The open end of each bound is filled in, the start of the period for "from" and the end of
 * it for "to". Day 0 of the following month gives the last day of this one and is
 * leap-year correct for century years, where a `year % 4` test is not.
 */
function dateBounds(raw) {
    const fromYear = optionalInt(raw.fromYear, 'From year', 1000, 9999);
    const toYear = optionalInt(raw.toYear, 'To year', 1000, 9999);
    const fromMonth = optionalInt(raw.fromMonth, 'From month', 1, 12);
    const toMonth = optionalInt(raw.toMonth, 'To month', 1, 12);
    const fromDay = optionalInt(raw.fromDay, 'From day', 1, 31);
    const toDay = optionalInt(raw.toDay, 'To day', 1, 31);

    let from = null;
    let to = null;

    if (fromYear !== null) {
        const month = fromMonth === null ? 1 : fromMonth;
        const day = fromDay === null ? 1 : fromDay;
        from = iso(fromYear, month, day);
    }

    if (toYear !== null) {
        const month = toMonth === null ? 12 : toMonth;
        const day = toDay === null ? lastDayOfMonth(toYear, month) : toDay;
        to = iso(toYear, month, day);
    }

    if (from !== null && to !== null && from > to) {
        throw new FilterError('The end of the date range falls before its start.');
    }

    return { from, to, fromYear, toYear };
}

function iso(year, month, day) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}`;
}

/**
 * The covariate keys a search asks to include as columns.
 *
 * A covariate key names a property in the projection, which cannot be a query parameter, so
 * each one is matched against the keys the graph declares on its Covariate nodes. A key that
 * is not declared is refused. `allowedCovariates` comes from the same search options the
 * panel was built from, so a key the panel could offer is always accepted.
 */
function covariateKeys(value, allowedCovariates) {
    const requested = stringList(value, 'covariates');
    if (requested.length === 0) return [];

    const allowed = allowedCovariates instanceof Set
        ? allowedCovariates
        : new Set(Array.isArray(allowedCovariates) ? allowedCovariates : []);

    // With no declared list to check against, no covariate column is added. Naming a property
    // that was never declared would put an unchecked identifier into the query text.
    if (allowed.size === 0) return [];

    const accepted = [];
    for (const key of requested) {
        if (allowed.has(key)) accepted.push(key);
    }
    return accepted;
}

/**
 * Turn the body of a search request into the object the planner and builder work on.
 *
 * Throws FilterError with a message meant for the user when the request cannot be honoured.
 */
function normaliseFilters(body, allowedCovariates) {
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
        throw new FilterError('The search was not understood.');
    }

    const lists = {};
    for (const field of LIST_FIELDS) {
        lists[field] = stringList(body[field], field);
    }

    const dates = dateBounds(body);

    const minLat = optionalNumber(body.minLat, 'Minimum latitude', -90, 90);
    const maxLat = optionalNumber(body.maxLat, 'Maximum latitude', -90, 90);
    const minLon = optionalNumber(body.minLon, 'Minimum longitude', -180, 180);
    const maxLon = optionalNumber(body.maxLon, 'Maximum longitude', -180, 180);

    if (minLat !== null && maxLat !== null && minLat > maxLat) {
        throw new FilterError('The minimum latitude is above the maximum.');
    }
    if (minLon !== null && maxLon !== null && minLon > maxLon) {
        throw new FilterError('The minimum longitude is above the maximum.');
    }

    const filters = {
        species: lists.species,
        genus: lists.genus,
        family: lists.family,
        order: lists.order,
        tax_class: lists.tax_class,
        phyla: lists.phyla,
        kingdoms: lists.kingdoms,
        states: lists.states,
        counties: lists.counties,
        datasets: lists.datasets,
        dataTypes: lists.dataTypes,
        covars: covariateKeys(body.covars, allowedCovariates),
        fromDate: dates.from,
        toDate: dates.to,
        minLat,
        maxLat,
        minLon,
        maxLon,
    };

    filters.hasTaxonFilter = TAXON_FIELDS.some(([field]) => filters[field].length !== 0);
    filters.hasLocationFilter = filters.states.length !== 0 || filters.counties.length !== 0;
    filters.hasCoordinateFilter = minLat !== null || maxLat !== null
        || minLon !== null || maxLon !== null;
    filters.hasDateFilter = dates.from !== null || dates.to !== null;

    filters.hasAnyFilter = filters.hasTaxonFilter || filters.hasLocationFilter
        || filters.hasCoordinateFilter || filters.hasDateFilter
        || filters.datasets.length !== 0 || filters.dataTypes.length !== 0;

    return filters;
}

module.exports = {
    normaliseFilters,
    FilterError,
    TAXON_FIELDS,
    LIST_FIELDS,
    MAX_LIST_LENGTH,
    MAX_VALUE_LENGTH,
    lastDayOfMonth,
};

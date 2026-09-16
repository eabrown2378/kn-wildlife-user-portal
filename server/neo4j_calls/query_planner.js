/**
 * Choosing which filter a search should start from.
 *
 * A search naming both a taxon and a place can be run two ways. Starting from the taxa finds
 * the chosen nodes, walks down to every taxon under them, and follows OBSERVED_ORGANISM out to
 * the observations. Starting from the places finds the counties, walks in through their sites,
 * and tests the rank columns afterwards. Both return the same rows. Which one is fast depends
 * entirely on how much data sits behind each side, and the names alone do not say: class Aves
 * is 13 million observations and class Bivalvia is a few thousand.
 *
 * So the planner estimates how many observations each filter admits and starts from the
 * narrowest. The estimates come from counts the pipeline writes onto the nodes.
 *
 * Every estimate here only ever decides which of several correct queries to run. A missing,
 * stale or wrong count changes how long a search takes and never changes which rows come back.
 * That is what makes it safe to fall back to a structural guess whenever the numbers are
 * absent, and it is the property the tests hold onto.
 */

const { TAXON_FIELDS } = require('./query_filters');

/**
 * Above this many estimated observations a search is refused.
 *
 * The whole result is held in the server's heap as an array of row objects and then serialised
 * to JSON, which coexists with those objects while it is built. Measured on a 68,002-row
 * result: 1,009 bytes per row of JSON, 3,417 bytes per row as objects, and a peak of 5,461
 * bytes per row across the two together.
 *
 * At that rate a 3 GB heap holds roughly 550,000 rows with nothing else running. This limit
 * sits well below that so a handful of searches can be in flight at once, and because a
 * refused search costs a user one message while an exhausted heap costs everyone their
 * request.
 *
 * The estimate counts observations and the result is counted in rows, which across this graph
 * differ by 1.6 percent - 20,078,572 OBSERVED_ORGANISM records over 19,758,393 observations -
 * so the two are interchangeable at this precision.
 *
 * KN_MAX_SEARCH_OBSERVATIONS overrides it, and it wants raising or lowering with the heap cap
 * in deploy/knw-api.service.
 */
const LARGE_SEARCH_OBSERVATIONS = 250000;

/** Thrown when a search is estimated to be too large to assemble. */
class SearchTooLargeError extends Error {
    constructor(message, estimate) {
        super(message);
        this.name = 'SearchTooLargeError';
        this.tooLarge = true;
        this.estimatedObservations = estimate;
    }
}

/** Sum a filter's chosen values, or null when any of them has no recorded count. */
function sumKnown(names, counts) {
    if (names.length === 0) return null;

    let total = 0;
    for (const name of names) {
        const count = counts.get(name);
        if (count === undefined) return null;
        total += count;
    }
    return total;
}

/**
 * How many observations the taxonomic filter admits.
 *
 * Ranks are OR'd, so the estimate is their sum. Naming a class and a genus inside it
 * double-counts that genus, which makes the taxon side look more expensive than it is. An
 * over-estimate can only lose a little speed by starting from the place instead, and both
 * queries return the same rows.
 */
function estimateTaxon(filters, stats) {
    if (!filters.hasTaxonFilter) return null;

    let total = 0;
    for (const [field, label] of TAXON_FIELDS) {
        const names = filters[field];
        if (names.length === 0) continue;
        const counts = stats.taxon[label];
        if (!counts) return null;
        const part = sumKnown(names, counts);
        if (part === null) return null;
        total += part;
    }
    return total;
}

/**
 * How many observations the place filter admits.
 *
 * States and counties are OR'd, and a state's count already covers its counties, so naming
 * both over-estimates in the same harmless direction as the taxon side.
 */
function estimateLocation(filters, stats) {
    if (!filters.hasLocationFilter) return null;

    const parts = [
        sumKnown(filters.states, stats.state),
        sumKnown(filters.counties, stats.county),
    ].filter((part) => part !== null);

    if (parts.length === 0) return null;

    // A list whose names are all unrecognised gives no estimate at all, and one where only
    // some are recognised gives a floor. Both are handled by sumKnown returning null.
    if (filters.states.length !== 0 && filters.counties.length !== 0 && parts.length !== 2) {
        return null;
    }

    return parts.reduce((a, b) => a + b, 0);
}

/** How many observations the dataset filter admits. */
function estimateDataset(filters, stats) {
    if (filters.datasets.length === 0) return null;
    return sumKnown(filters.datasets, stats.dataset);
}

/**
 * Whether a filter is known to admit nothing.
 *
 * A category is empty only when every value named in it is recorded at zero. A name with no
 * recorded count says nothing, so it never contributes to this. Categories are AND'd, so one
 * empty category makes the whole search empty and the database need not be asked at all.
 */
function knownEmpty(names, counts) {
    if (names.length === 0) return false;
    for (const name of names) {
        const count = counts.get(name);
        if (count === undefined || count > 0) return false;
    }
    return true;
}

function findEmptyCategory(filters, stats) {
    for (const [field, label] of TAXON_FIELDS) {
        const counts = stats.taxon[label];
        if (counts && knownEmpty(filters[field], counts)) {
            return `No observations are recorded for the ${label.toLowerCase()} selected.`;
        }
    }
    if (knownEmpty(filters.datasets, stats.dataset)) {
        return 'No observations are recorded for the dataset selected.';
    }
    // States and counties are OR'd with each other, so the place filter is empty only when
    // both lists are, and a list left blank does not count as empty.
    const statesEmpty = filters.states.length === 0 || knownEmpty(filters.states, stats.state);
    const countiesEmpty = filters.counties.length === 0
        || knownEmpty(filters.counties, stats.county);
    if (filters.hasLocationFilter && statesEmpty && countiesEmpty) {
        return 'No observations are recorded for the location selected.';
    }
    return null;
}

/**
 * Decide how to run a search.
 *
 * Returns the anchor to build the query around, the estimates behind that choice, and whether
 * the search is known to be empty or expected to be large.
 */
function planQuery(filters, stats, options = {}) {
    const largeThreshold = Number.isFinite(options.largeThreshold)
        ? options.largeThreshold : LARGE_SEARCH_OBSERVATIONS;
    const structural = {
        taxon: null,
        location: null,
        dataset: null,
    };

    if (!filters.hasAnyFilter) {
        return {
            anchor: 'none',
            reason: 'The search names no filter, so there is nothing to anchor on.',
            estimates: structural,
            estimatedObservations: stats.available ? stats.totalObservations : null,
            definitelyEmpty: false,
            emptyReason: null,
            large: true,
            usedStatistics: false,
        };
    }

    // Without counts, fall back to the structural rule: a taxonomic search with no place
    // named starts from the taxa, because the taxa under any rank are few. A search naming a
    // place starts from the place, which is bounded at 3,142 counties and 51 states however
    // common the taxon is.
    if (!stats.available) {
        const anchor = filters.hasTaxonFilter && !filters.hasLocationFilter ? 'taxon'
            : filters.hasLocationFilter ? 'location'
            : 'none';
        return {
            anchor,
            reason: `No observation counts are available (${stats.reason}), so the anchor was `
                + 'chosen from the shape of the search.',
            estimates: structural,
            estimatedObservations: null,
            definitelyEmpty: false,
            emptyReason: null,
            large: false,
            usedStatistics: false,
        };
    }

    const emptyReason = findEmptyCategory(filters, stats);
    if (emptyReason !== null) {
        return {
            anchor: 'none',
            reason: 'The search is known to match nothing, so the database is not queried.',
            estimates: structural,
            estimatedObservations: 0,
            definitelyEmpty: true,
            emptyReason,
            large: false,
            usedStatistics: true,
        };
    }

    const estimates = {
        taxon: estimateTaxon(filters, stats),
        location: estimateLocation(filters, stats),
        dataset: estimateDataset(filters, stats),
    };

    // The anchor is whichever named filter admits fewest observations. Only the taxon and the
    // place can anchor a query; the dataset estimate narrows the row estimate but there is no
    // dataset-anchored form of the match.
    const candidates = [
        { anchor: 'taxon', rows: estimates.taxon },
        { anchor: 'location', rows: estimates.location },
    ].filter((candidate) => candidate.rows !== null);

    if (candidates.length === 0) {
        const anchor = filters.hasTaxonFilter && !filters.hasLocationFilter ? 'taxon'
            : filters.hasLocationFilter ? 'location'
            : 'none';
        return {
            anchor,
            reason: 'None of the values named carry a recorded count, so the anchor was chosen '
                + 'from the shape of the search.',
            estimates,
            estimatedObservations: null,
            definitelyEmpty: false,
            emptyReason: null,
            large: false,
            usedStatistics: false,
        };
    }

    candidates.sort((a, b) => a.rows - b.rows);
    const chosen = candidates[0];

    // Categories are AND'd, so the result cannot exceed the narrowest of them.
    const bounds = [chosen.rows, estimates.dataset].filter((value) => value !== null);
    const estimatedObservations = Math.min(...bounds);

    const alternative = candidates[1];
    const reason = alternative
        ? `Anchored on the ${chosen.anchor} at about ${chosen.rows.toLocaleString()} `
            + `observations, against about ${alternative.rows.toLocaleString()} for the `
            + `${alternative.anchor}.`
        : `Anchored on the ${chosen.anchor}, the only filter with a recorded count, at about `
            + `${chosen.rows.toLocaleString()} observations.`;

    return {
        anchor: chosen.anchor,
        reason,
        estimates,
        estimatedObservations,
        definitelyEmpty: false,
        emptyReason: null,
        large: estimatedObservations > largeThreshold,
        usedStatistics: true,
    };
}

module.exports = {
    planQuery,
    SearchTooLargeError,
    LARGE_SEARCH_OBSERVATIONS,
};

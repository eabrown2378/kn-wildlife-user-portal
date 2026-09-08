import ReactGA from "react-ga4";

/**
 * Usage analytics, and the description of a search that both analytics and the audit log use.
 *
 * Two systems answer two different questions, and it matters which is asked what.
 *
 * Google Analytics answers "how is the portal used": which views people open, how often a
 * search is refined, where they stop. It is aggregate and anonymous. Google's terms forbid
 * sending personal information, so nothing here ever carries an email or a name; the account
 * is identified by its opaque session token only, which stitches a person's visits together
 * without saying who they are. A share of visitors block analytics entirely, so these counts
 * are a sample.
 *
 * The server's audit log answers "who retrieved what". It is written on the server, cannot be
 * blocked, and stays on the machine. `describeSearch` builds the description both use, so the
 * two never disagree about what a search contained.
 */

/** The GA4 property this portal reports to. */
const MEASUREMENT_ID = "G-RJKTMZ8CGB";

/**
 * Whether analytics is running.
 *
 * Every function below returns immediately while this is false, so the rest of the app can
 * call them wherever it makes sense without asking whether the visitor agreed. Nothing
 * reaches Google until `start` has been called, and `start` is only called on consent.
 */
let enabled = false;


/** How many entries a value holds, whatever shape it arrived in. */
function count(value) {
    if (Array.isArray(value)) return value.length;
    return value === "" || value === null || value === undefined ? 0 : 1;
}

/**
 * What a search asked for, without the values it asked for.
 *
 * Counts and flags rather than the taxa and places themselves. That is enough to see which
 * parts of the search interface earn their place, and it keeps a user's research interest out
 * of a third party's records. The audit log stores the same shape, so a question answered
 * from analytics can be checked against the server's own record.
 */
function describeSearch(query, taxonChips = [], placeChips = []) {
    return {
        taxa: taxonChips.length,
        ranks: [...new Set(taxonChips.map((chip) => chip.rank).filter(Boolean))].sort().join(","),
        places: placeChips.length,
        has_coordinate_box: Boolean(query.minLat || query.maxLat || query.minLon || query.maxLon),
        has_date_range: Boolean(query.fromYear || query.toYear),
        datasets: count(query.datasets),
        data_types: count(query.dataTypes),
        covariates: count(query.covars),
    };
}

/**
 * Result sizes as bands.
 *
 * A raw count is a high-cardinality parameter that analytics cannot group usefully, and the
 * question being asked is "was that a small search or a huge one", which a band answers.
 */
function sizeBand(rows) {
    if (!rows) return "0";
    if (rows < 100) return "1-99";
    if (rows < 1000) return "100-999";
    if (rows < 10000) return "1k-10k";
    if (rows < 100000) return "10k-100k";
    return "100k+";
}

/** Begin reporting. Called only once the visitor has agreed. */
function start() {
    if (enabled) return;
    // Google's own opt-out switch, cleared here and set by `stop`. It is read by the script
    // itself, so it holds even for anything that reports outside these functions.
    window[`ga-disable-${MEASUREMENT_ID}`] = false;
    ReactGA.initialize(MEASUREMENT_ID);
    enabled = true;
    ReactGA.send({ hitType: "pageview", page: window.location.pathname, title: "portal" });
}

/**
 * Stop reporting, for a visitor who declines or withdraws.
 *
 * A script already loaded cannot be unloaded, so refusal after the fact sets Google's opt-out
 * switch and closes this module's own gate. Nothing further is sent.
 */
function stop() {
    window[`ga-disable-${MEASUREMENT_ID}`] = true;
    enabled = false;
}

/**
 * Tie a visit to an account without naming it.
 *
 * GA4 accepts a user_id for stitching sessions across devices, and it must not be personal
 * information. The session token is opaque and already rotates on sign-out, so it identifies
 * the visit without identifying the person.
 */
function identify(pseudonymousId) {
    if (!enabled) return;
    ReactGA.set({ user_id: pseudonymousId || undefined });
}

/** A search that reached the database, or was answered from the client's own cache. */
function searchRun({ description, rows, cached }) {
    if (!enabled) return;
    ReactGA.event("search", {
        ...description,
        result_size: sizeBand(rows),
        cached: Boolean(cached),
    });
}

/** A search the database refused, most often for returning too much. */
function searchFailed({ description, reason }) {
    if (!enabled) return;
    ReactGA.event("search_failed", { ...description, reason });
}

/** A result taken away as a zip. */
function downloadTaken({ description, rows, datasets }) {
    if (!enabled) return;
    ReactGA.event("download", {
        ...description,
        result_size: sizeBand(rows),
        datasets_included: Array.isArray(datasets) ? datasets.length : 0,
    });
}

/** Which of the three result views someone opened. */
function viewOpened(view) {
    if (!enabled) return;
    ReactGA.event("view_change", { view });
}

/** Registration and sign-in, counted without any detail about the person. */
function accountEvent(name) {
    if (!enabled) return;
    ReactGA.event(name);
}

export {
    MEASUREMENT_ID, start, stop, identify, describeSearch, sizeBand,
    searchRun, searchFailed, downloadTaken, viewOpened, accountEvent,
};

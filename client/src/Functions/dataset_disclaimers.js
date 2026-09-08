import disclaimers from '../data/disclaimers.json';

/**
 * The provider disclaimers that apply to a set of datasets.
 *
 * `disclaimers.json` names the datasets each entry covers. Matching those names exactly does
 * not work, because a dataset's name carries the date its data was downloaded and the
 * importer rewrites it on every refresh: the entry naming
 * "iNaturalist: Vertebrates (2025-07-01)" stopped matching the moment the vertebrates were
 * re-downloaded, and iNaturalist's terms of use quietly dropped out of every download that
 * contained them.
 *
 * So the trailing date is removed from both sides before comparing. Everything before it is
 * the dataset's identity; the date is which snapshot of it is loaded.
 */

const TRAILING_DATE = /\s*\(\d{4}-\d{2}-\d{2}\)\s*$/;

/** A dataset name without the snapshot date, which is the part that identifies it. */
function withoutDate(name) {
    return String(name || '').replace(TRAILING_DATE, '').trim();
}

/**
 * Disclaimer entries covering any of the given dataset names.
 *
 * @param {string[]} datasetNames names as they appear in the graph
 * @returns {Array} the matching entries from disclaimers.json, in file order
 */
function disclaimersFor(datasetNames) {
    const wanted = new Set((datasetNames || []).map(withoutDate));
    return disclaimers.filter((entry) =>
        (entry.dataset || []).some((name) => wanted.has(withoutDate(name))));
}

/** Whether a single dataset is covered by an entry. */
function entryCovers(entry, datasetName) {
    const target = withoutDate(datasetName);
    return (entry.dataset || []).some((name) => withoutDate(name) === target);
}

export { disclaimersFor, entryCovers, withoutDate };

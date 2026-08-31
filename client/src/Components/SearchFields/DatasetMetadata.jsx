import { useEffect } from "react";
import { disclaimersFor, entryCovers } from "../../Functions/dataset_disclaimers";

/**
 * A window describing every dataset the portal offers: who produced it, what kind of
 * measurement it holds, when it was retrieved, how to cite it, and what its provider asks of
 * anyone using it.
 *
 * The counterpart of the covariate window, and built the same way: everything except the
 * provider disclaimers is read from the graph, so a dataset added to the pipeline appears here
 * with its own credit without this file changing. Citations in particular are composed from
 * the download manifest at build time, so they describe the files actually loaded.
 */
function DatasetMetadata({ datasets, onClose }) {

    // Escape closes the window, which is what a keyboard user will try first
    useEffect(() => {
        const onKey = (event) => { if (event.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    const entries = disclaimersFor(datasets.map((dataset) => dataset.label));

    return (
        <div className="covariateMetadataBackdrop" onClick={onClose}>
            <div className="covariateMetadataWindow" onClick={(e) => e.stopPropagation()}
                 role="dialog" aria-label="About the datasets">

                <div className="covariateMetadataHeader">
                    <h3>About the datasets</h3>
                    <button type="button" className="covariateMetadataClose"
                            onClick={onClose} aria-label="Close">×</button>
                </div>

                <div className="covariateMetadataBody">

                    <section>
                        <h4>Datasets</h4>
                        {datasets.map((dataset) => (
                            <div key={dataset.value} className="covariateMetadataItem">
                                <div className="covariateMetadataName">{dataset.label}</div>
                                {(dataset.program || dataset.agency) && (
                                    <div className="covariateMetadataKey">
                                        {[dataset.program, dataset.agency]
                                            .filter(Boolean).join(" · ")}
                                    </div>
                                )}
                                {Array.isArray(dataset.dataTypes) && dataset.dataTypes.length > 0 && (
                                    <p className="covariateMetadataScope">
                                        Holds {dataset.dataTypes.join(", ")} measurements.
                                    </p>
                                )}
                                {dataset.downloadDate && (
                                    <p className="covariateMetadataScope">
                                        Retrieved {dataset.downloadDate}
                                        {dataset.retrievedVia ? ` via ${dataset.retrievedVia}` : ""}.
                                    </p>
                                )}
                                {dataset.notes && <p>{dataset.notes}</p>}
                                {Array.isArray(dataset.citations) && dataset.citations.map((citation) => (
                                    <p key={citation} className="covariateMetadataCitation">{citation}</p>
                                ))}
                                {Array.isArray(dataset.urls) && dataset.urls.map((url) => (
                                    <p key={url}>
                                        <a href={url} target="_blank" rel="noreferrer">{url}</a>
                                    </p>
                                ))}
                            </div>
                        ))}
                    </section>

                    {entries.length > 0 && (
                        <section>
                            <h4>Provider disclaimers</h4>
                            {entries.map((entry) => (
                                <div key={entry.dataset.join("|")} className="covariateMetadataItem">
                                    <div className="covariateMetadataName">
                                        {datasets
                                            .filter((dataset) => entryCovers(entry, dataset.label))
                                            .map((dataset) => dataset.label)
                                            .join(", ") || entry.dataset.join(", ")}
                                    </div>
                                    <p className="covariateMetadataCaution">{entry.disclaimer}</p>
                                    {entry.notes && <p>{entry.notes}</p>}
                                </div>
                            ))}
                        </section>
                    )}

                    <p className="covariateMetadataFootnote">
                        Every download carries these disclaimers and the citation for each
                        dataset it contains, in DISCLAIMERS.txt and CITATIONS.txt. iNaturalist
                        records also carry a per-record licence and rights holder, because one
                        download mixes CC0, CC-BY and CC-BY-NC and the licence governs what may
                        be done with that one record, not with the dataset as a whole.
                    </p>

                </div>
            </div>
        </div>
    );
}

export default DatasetMetadata;

import { useEffect } from "react";

/**
 * A window describing every covariate the portal offers: what it measures, where it comes
 * from, how to cite it, and any usage note the provider attaches to it.
 *
 * Everything shown here is read from the graph, so a covariate added to the registry appears
 * with its own description and credit without this file changing. The provider's usage note is
 * shown where it can affect the choice being made: PRISM asks that its data not be used to
 * calculate very long-term trends.
 */
function CovariateMetadata({ covariates, onClose }) {

    // Escape closes the window, which is what a keyboard user will try first
    useEffect(() => {
        const onKey = (event) => { if (event.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    // one entry per source, so a citation shared by eight covariates is shown once
    const sources = [];
    for (const covariate of covariates) {
        if (!covariate.source) continue;
        if (!sources.some((s) => s.source === covariate.source)) {
            sources.push({
                source: covariate.source,
                citation: covariate.citation,
                licence: covariate.licence,
                usageCaution: covariate.usageCaution,
                sourceUrls: covariate.sourceUrls,
            });
        }
    }

    const groups = [];
    for (const covariate of covariates) {
        const name = covariate.group || "Covariates";
        let group = groups.find((g) => g.name === name);
        if (!group) { group = { name, items: [] }; groups.push(group); }
        group.items.push(covariate);
    }

    return (
        <div className="covariateMetadataBackdrop" onClick={onClose}>
            <div className="covariateMetadataWindow" onClick={(e) => e.stopPropagation()}
                 role="dialog" aria-label="About the covariates">

                <div className="covariateMetadataHeader">
                    <h3>About the covariates</h3>
                    <button type="button" className="covariateMetadataClose"
                            onClick={onClose} aria-label="Close">×</button>
                </div>

                <div className="covariateMetadataBody">

                    {groups.map((group) => (
                        <section key={group.name}>
                            <h4>{group.name}</h4>
                            {group.items.map((c) => (
                                <div key={c.value} className="covariateMetadataItem">
                                    <div className="covariateMetadataName">
                                        {c.label}
                                        {c.units && <span className="covariateMetadataUnits"> — {c.units}</span>}
                                        {c.bioclimEquivalent && (
                                            <span className="covariateMetadataBadge">{c.bioclimEquivalent}</span>
                                        )}
                                    </div>
                                    <div className="covariateMetadataKey">{c.value}</div>
                                    {c.description && <p>{c.description}</p>}
                                    {c.temporalScope && (
                                        <p className="covariateMetadataScope">
                                            Computed for {c.temporalScope}.
                                        </p>
                                    )}
                                </div>
                            ))}
                        </section>
                    ))}

                    {sources.length > 0 && (
                        <section>
                            <h4>Sources and citation</h4>
                            {sources.map((s) => (
                                <div key={s.source} className="covariateMetadataItem">
                                    <div className="covariateMetadataName">{s.source}</div>
                                    {s.citation && (
                                        <p className="covariateMetadataCitation">{s.citation}</p>
                                    )}
                                    {s.usageCaution && (
                                        <p className="covariateMetadataCaution">
                                            <strong>Provider usage note:</strong> {s.usageCaution}
                                        </p>
                                    )}
                                    {s.licence && <p className="covariateMetadataLicence">{s.licence}</p>}
                                    {Array.isArray(s.sourceUrls) && s.sourceUrls.map((url) => (
                                        <p key={url}>
                                            <a href={url} target="_blank" rel="noreferrer">{url}</a>
                                        </p>
                                    ))}
                                </div>
                            ))}
                        </section>
                    )}

                    <p className="covariateMetadataFootnote">
                        A covariate is left off an observation when no value exists for it, which
                        the table shows as NA. PRISM covers the conterminous United States, so
                        observations in Alaska, Hawaii and the territories have no climate values.
                    </p>

                </div>
            </div>
        </div>
    );
}

export default CovariateMetadata;

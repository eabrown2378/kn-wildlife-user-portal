import { useId, useState } from "react";

// A collapsible group of search fields.
//
// The search panel holds five unrelated groups of controls at once, and a user setting up a
// taxonomic query has to scroll past spatial, temporal, dataset and covariate fields to
// reach the button. Collapsing each group into its own disclosure keeps the whole panel
// legible and lets someone open only the part they are working in.
//
// The risk in hiding controls is that a filter left set in a closed group silently shapes
// the results, and the user cannot see why. So a closed section still reports how many
// selections it holds: a section with active criteria announces itself, and an empty one
// stays quiet. That badge is what makes hiding the fields safe rather than merely tidy.
//
// Built on <details>/<summary> so that keyboard access, screen-reader semantics and
// find-in-page all work without being reimplemented.
function SearchSection({title, activeCount = 0, defaultOpen = false, children}) {
    const headingId = useId();
    const active = activeCount > 0;

    // Whether the section is open is the user's business once they have touched it. Driving
    // `open` straight from a prop would look right on first render and then fight them: the
    // panel re-renders whenever the query changes, and a section they had deliberately
    // closed would spring open again because it still holds criteria.
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <details
            className="searchSection"
            open={isOpen}
            onToggle={(event) => setIsOpen(event.currentTarget.open)}
        >
            <summary className="searchSection--summary" id={headingId}>
                <span className="searchSection--title">{title}</span>
                {active && (
                    <span
                        className="searchSection--badge"
                        aria-label={`${activeCount} active ${activeCount === 1 ? "criterion" : "criteria"}`}
                    >
                        {activeCount}
                    </span>
                )}
            </summary>
            <div className="searchSection--body">{children}</div>
        </details>
    );
}

export default SearchSection;

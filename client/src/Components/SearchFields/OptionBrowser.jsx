import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

// Browse and pick taxa (or places) at whatever level you want, without having to type.
//
// The first version of this was a type-ahead alone. It solved the real problem - a search
// could finally hold a class, a genus and a species at once - but it took two things away.
// You could not see what was available without guessing at a name, and you had no direct
// say in which level you were choosing at; the rank was whatever the thing you happened to
// type turned out to be.
//
// So the rank is a control of its own now, and the list is always there to scroll. Picking a
// rank answers "at what resolution", the list answers "which one", and the search box only
// narrows what is already visible, and is one way in among several. Drilling into a group
// restricts the list to what sits inside it, which is how you get from Aves to a particular
// heron without knowing its family in advance.
//
// The list is virtualised because the taxon index runs to tens of thousands of entries and
// the whole point is that it can be scrolled through without filtering it down first.

// A starting estimate only. Real heights are measured from the DOM, because a row is two
// lines of text plus padding and a border, and pinning it to a fixed number made every row
// one pixel taller than the slot it was placed in - so each sat on top of the one before it
// and the whole list read as squashed together.
const ESTIMATED_ROW_HEIGHT = 54;
const VISIBLE_HEIGHT = 280;

function OptionBrowser({options, ranks, selected, onToggle, onClear, isLoading, emptyMessage}) {
    const [rank, setRank] = useState("all");
    const [within, setWithin] = useState(null);

    // Stepping inside a group makes a rank at or above that group unanswerable: nothing
    // inside a class is a class. The level control goes back to all levels in that case,
    // so the list holds what is actually in there.
    const stepInto = (option) => {
        if (!option) return;
        const depthOf = (key) => ranks.findIndex((entry) => entry.key === key);
        if (rank !== "all" && depthOf(rank) <= depthOf(option.rank)) setRank("all");
        setWithin(option);
        setText("");
    };
    const [text, setText] = useState("");
    const scrollRef = useRef(null);

    const chosen = useMemo(
        () => new Set((selected || []).map((item) => item.value)),
        [selected]
    );

    // Only offer ranks the data actually contains, so an empty tab can never be selected.
    const availableRanks = useMemo(() => {
        const present = new Set(options.map((option) => option.rank));
        return ranks.filter((entry) => present.has(entry.key));
    }, [options, ranks]);

    // Which names have anything inside them. A species contains nothing, so putting a
    // "step inside" control on every row invited a click that could only ever lead to an
    // empty list, and tripled the number of things competing for attention in a panel that
    // is already narrow.
    const hasChildren = useMemo(() => {
        const parents = new Set();
        for (const option of options) {
            for (const ancestor of option.ancestors || []) parents.add(ancestor);
        }
        return parents;
    }, [options]);

    const shown = useMemo(() => {
        const terms = text.trim().toLowerCase().split(/\s+/).filter(Boolean);
        return options.filter((option) => {
            if (rank !== "all" && option.rank !== rank) return false;
            // "inside this group" is an ancestor test, not a text match, so drilling into
            // Ardea cannot accidentally sweep in an unrelated taxon whose name contains it
            if (within && !(option.ancestors || []).includes(within.name)) return false;
            if (within && option.value === within.value) return false;
            if (!terms.length) return true;
            const haystack = `${option.name} ${option.rankLabel} ${option.lineage}`.toLowerCase();
            return terms.every((term) => haystack.includes(term));
        });
    }, [options, rank, within, text]);

    // The trail back up from wherever you have drilled to. Each ancestor is matched by name
    // *and* by the ancestors above it, not by name alone: Arenaria names both a sandpiper
    // and a sandwort, so a name-only lookup could send you back up into the wrong kingdom.
    const crumbs = useMemo(() => {
        if (!within) return [];
        return (within.ancestors || []).map((name, index) => {
            const prefix = (within.ancestors || []).slice(0, index);
            const option = options.find((candidate) =>
                candidate.name === name
                && (candidate.ancestors || []).length === prefix.length
                && (candidate.ancestors || []).every((value, position) => value === prefix[position]));
            return {key: `${index}:${name}`, name, option};
        });
    }, [within, options]);

    // Choosing a dataset rebuilds the index, and the group being browsed may not survive it.
    // Holding a scope that no longer exists shows an empty list and no reason for it.
    useEffect(() => {
        if (within && !options.some((option) => option.value === within.value)) {
            setWithin(null);
            setText("");
        }
    }, [options, within]);

    const virtualizer = useVirtualizer({
        count: shown.length,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => ESTIMATED_ROW_HEIGHT,
        // Measure each row as it renders. Lineages differ
        // in length and the browser's own font metrics vary, so the true height is only
        // knowable from the DOM.
        measureElement: (element) => element?.getBoundingClientRect().height ?? ESTIMATED_ROW_HEIGHT,
        overscan: 8,
    });

    return (
        <div className="browser">
            {/* What you have chosen comes first. It was underneath the list, which meant the
                answer to "what am I actually searching for" sat below several hundred rows
                you were still scrolling. */}
            {selected && selected.length > 0 && (
                <div className="browser--selection">
                    <div className="browser--selectionHead">
                        <span>Selected ({selected.length})</span>
                        <button type="button" onClick={() => onClear && onClear()}
                                disabled={isLoading}>
                            clear all
                        </button>
                    </div>
                    <ul className="browser--chosen">
                        {selected.map((item) => (
                            <li key={item.value}>
                                <span className="browser--name">{item.name}</span>
                                <span className="browser--rankLabel">{item.rankLabel}</span>
                                <button
                                    type="button"
                                    onClick={() => onToggle(item)}
                                    aria-label={`Remove ${item.name}`}
                                    disabled={isLoading}
                                >
                                    ×
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="browser--ranks" role="group" aria-label="Level to browse">
                <button
                    type="button"
                    className={`browser--rank ${rank === "all" ? "is-active" : ""}`}
                    onClick={() => setRank("all")}
                    disabled={isLoading}
                >
                    All levels
                </button>
                {availableRanks.map((entry) => (
                    <button
                        key={entry.key}
                        type="button"
                        className={`browser--rank ${rank === entry.key ? "is-active" : ""}`}
                        onClick={() => setRank(entry.key)}
                        disabled={isLoading}
                    >
                        {entry.label}
                    </button>
                ))}
            </div>

            {within && (
                <nav className="browser--crumbs" aria-label="Where you are">
                    <button type="button" className="browser--crumbExit"
                            onClick={() => { setWithin(null); setText(""); }}
                            disabled={isLoading}>
                        &times; Show all
                    </button>
                    {crumbs.map((crumb) => (
                        <span key={crumb.key} className="browser--crumbPart">
                            <span className="browser--crumbSep" aria-hidden="true">›</span>
                            {crumb.option ? (
                                <button type="button" className="browser--crumb"
                                        onClick={() => stepInto(crumb.option)}
                                        disabled={isLoading}>
                                    {crumb.name}
                                </button>
                            ) : (
                                // an ancestor the index holds no entry for, so there is
                                // nothing to step back to; shown for context, not clickable
                                <span className="browser--crumb is-plain">{crumb.name}</span>
                            )}
                        </span>
                    ))}
                    <span className="browser--crumbPart">
                        <span className="browser--crumbSep" aria-hidden="true">›</span>
                        <span className="browser--crumb is-current" aria-current="true">
                            {within.name}
                        </span>
                    </span>
                </nav>
            )}

            <input
                type="text"
                className="browser--search"
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Narrow the list (optional)"
                disabled={isLoading}
            />

            <div className="browser--count">
                {shown.length.toLocaleString()} shown
                {chosen.size > 0 && ` · ${chosen.size} selected`}
            </div>

            <div className="browser--list" ref={scrollRef} style={{height: VISIBLE_HEIGHT}}>
                {shown.length === 0 ? (
                    <p className="browser--empty">{emptyMessage || "Nothing matches"}</p>
                ) : (
                    <div style={{height: virtualizer.getTotalSize(), position: "relative"}}>
                        {virtualizer.getVirtualItems().map((virtualRow) => {
                            const option = shown[virtualRow.index];
                            const isChosen = chosen.has(option.value);
                            return (
                                <div
                                    key={option.value}
                                    // the virtualizer measures the element behind these two
                                    ref={virtualizer.measureElement}
                                    data-index={virtualRow.index}
                                    className={`browser--row ${isChosen ? "is-chosen" : ""}`}
                                    style={{
                                        position: "absolute",
                                        top: 0,
                                        left: 0,
                                        width: "100%",
                                        transform: `translateY(${virtualRow.start}px)`,
                                    }}
                                >
                                    <button
                                        type="button"
                                        className="browser--pick"
                                        onClick={() => onToggle(option)}
                                        disabled={isLoading}
                                        aria-pressed={isChosen}
                                    >
                                        <span className="browser--tick">{isChosen ? "✓" : "+"}</span>
                                        <span className="browser--name">{option.name}</span>
                                        <span className="browser--rankLabel">{option.rankLabel}</span>
                                        {option.lineage && (
                                            <span className="browser--lineage">{option.lineage}</span>
                                        )}
                                    </button>
                                    {hasChildren.has(option.name) && (
                                        <button
                                            type="button"
                                            className="browser--drill"
                                            title={`Show what is inside ${option.name}`}
                                            onClick={() => stepInto(option)}
                                            disabled={isLoading}
                                        >
                                            ›
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

        </div>
    );
}

export default OptionBrowser;

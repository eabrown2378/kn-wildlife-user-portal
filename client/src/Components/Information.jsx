import { useCallback, useLayoutEffect, useRef, useState } from "react";
import blurbs from "../data/blurbs.json";

// How far the blurb sits from the icon and from the window edge.
const GAP = 8;

// The question mark beside a field label, and the blurb it opens.
//
// The blurb is placed from the icon's rectangle read at the moment it opens. The search panel
// scrolls and its sections collapse, so a rectangle measured earlier puts the blurb where the
// icon used to be. Fixed positioning is what makes that rectangle usable, since the panel is a
// scrolling ancestor and an absolutely positioned blurb would be offset by however far it had
// been scrolled.
function Information(props) {

    const iconRef = useRef(null);
    const blurbRef = useRef(null);

    const [open, setOpen] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0 });

    const show = useCallback(() => setOpen(true), []);
    const hide = useCallback(() => setOpen(false), []);

    // Runs after the blurb is in the DOM so its real height is known, and before paint so the
    // blurb is never seen at the previous position. It opens to the right of the icon, flips
    // to the left when there is no room, and stays inside the window on all four sides.
    useLayoutEffect(() => {
        if (!open || !iconRef.current || !blurbRef.current) return;

        const icon = iconRef.current.getBoundingClientRect();
        const blurb = blurbRef.current.getBoundingClientRect();

        let left = icon.right + GAP;
        if (left + blurb.width > window.innerWidth - GAP) {
            left = icon.left - blurb.width - GAP;
        }

        let top = icon.top - 4;
        if (top + blurb.height > window.innerHeight - GAP) {
            top = window.innerHeight - blurb.height - GAP;
        }

        setCoords({ top: Math.max(GAP, top), left: Math.max(GAP, left) });
    }, [open]);

    return (
        <div className="information">
            <button
                type="button"
                ref={iconRef}
                className="iContainer"
                aria-label="What this field does"
                aria-expanded={open}
                onMouseEnter={show}
                onMouseLeave={hide}
                onFocus={show}
                onBlur={hide}
            >
                ?
            </button>
            {open && (
                <p ref={blurbRef} role="tooltip" className="blurbContainer" style={coords}>
                    {blurbs[0][props.blurb]}
                </p>
            )}
        </div>
    );
}

export default Information;

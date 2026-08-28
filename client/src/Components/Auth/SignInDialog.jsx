import { useEffect } from "react";
import SignInPanel from "./SignInPanel";

/**
 * The sign-in panel over the portal, shown when data is requested.
 *
 * It can be dismissed, because the search itself is still usable without an account and the
 * user may have opened it by accident. What they cannot do without signing in is retrieve
 * records, and the panel says so.
 */
function SignInDialog({ onClose }) {

    useEffect(() => {
        const onKey = (event) => { if (event.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    return (
        <div className="authDialogBackdrop" onClick={onClose}>
            <div className="authDialogWindow" onClick={(event) => event.stopPropagation()}
                 role="dialog" aria-label="Sign in to retrieve data">
                <button type="button" className="authDialogClose"
                        onClick={onClose} aria-label="Close">×</button>
                <SignInPanel
                    heading="Sign in to retrieve data"
                    intro={"Browsing what the portal holds is open to everyone. Retrieving records "
                         + "needs a confirmed email address, so we know who the data reaches."}
                />
            </div>
        </div>
    );
}

export default SignInDialog;

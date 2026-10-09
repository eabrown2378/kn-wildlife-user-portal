import { useEffect } from "react";
import SignInPanel from "./SignInPanel";

/**
 * The sign-in panel over the portal, shown when a download is requested.
 *
 * It can be dismissed, because searching and viewing results are usable without an account
 * and the user may have opened it by accident. What they cannot do without signing in is
 * download records, and the panel says so.
 */
function SignInDialog({ initialMode = "signin", onClose }) {

    useEffect(() => {
        const onKey = (event) => { if (event.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    return (
        <div className="authDialogBackdrop" onClick={onClose}>
            <div className="authDialogWindow" onClick={(event) => event.stopPropagation()}
                 role="dialog"
                 aria-label={initialMode === "register" ? "Register to download data"
                                                        : "Sign in to download data"}>
                <button type="button" className="authDialogClose"
                        onClick={onClose} aria-label="Close">×</button>
                <SignInPanel
                    initialMode={initialMode}
                    heading="Sign in to download data"
                    intro={"Searching and viewing what the portal holds is open to everyone. Downloading "
                         + "records needs a confirmed email address, so we know who the data reaches."}
                />
            </div>
        </div>
    );
}

export default SignInDialog;

import { useState } from "react";
import VerifyEmail from "./VerifyEmail";

/**
 * Shows the portal, or the verification landing page when a confirmation link is followed.
 *
 * The portal itself is open: browsing the taxonomy, places, datasets and covariates needs no
 * account, so somebody can establish whether the data suits them before being asked for
 * anything. Sign-in is requested at the point records are retrieved.
 *
 * A verification link arrives at /verify?token=..., handled here rather than through a router,
 * since the portal is otherwise a single page.
 */
function AuthGate({ children }) {

    const [verifying, setVerifying] = useState(() => {
        const path = window.location.pathname.replace(/\/$/, "");
        if (path !== "/verify") return null;
        return new URLSearchParams(window.location.search).get("token") || "";
    });

    if (verifying !== null) {
        return (
            <div className="authScreen">
                <VerifyEmail token={verifying} onDone={() => {
                    setVerifying(null);
                    window.history.replaceState({}, "", "/");
                }} />
            </div>
        );
    }

    return children;
}

export default AuthGate;

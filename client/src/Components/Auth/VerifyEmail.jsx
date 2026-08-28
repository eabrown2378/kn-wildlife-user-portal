import { useContext, useEffect, useRef, useState } from "react";
import { AuthContext } from "../../Context/AuthContext";

/**
 * The page a verification link lands on.
 *
 * The token is single-use, so this must submit it exactly once. React runs effects twice in
 * StrictMode during development, which would spend the token on the first call and report the
 * second as invalid, so the attempt is guarded by a ref.
 */
function VerifyEmail({ token, onDone }) {

    const { verify } = useContext(AuthContext);
    const [state, setState] = useState("working");
    const [error, setError] = useState("");
    const attempted = useRef(false);

    useEffect(() => {
        if (attempted.current) return;
        attempted.current = true;

        (async () => {
            if (!token) {
                setError("That link is missing its verification token.");
                setState("failed");
                return;
            }
            const result = await verify(token);
            if (result.ok) {
                setState("done");
                // drop the token from the address bar so it is not kept in history
                window.history.replaceState({}, "", "/");
            } else {
                setError(result.error);
                setState("failed");
            }
        })();
    }, [token, verify]);

    return (
        <div className="authPanel">
            {state === "working" && <h2>Confirming your address...</h2>}

            {state === "done" && (
                <>
                    <h2>Address confirmed</h2>
                    <p>Your account is active and you are signed in.</p>
                    <button type="button" className="authSubmit" onClick={onDone}>
                        Continue to the portal
                    </button>
                </>
            )}

            {state === "failed" && (
                <>
                    <h2>Could not confirm the address</h2>
                    <p className="authError">{error}</p>
                    <p className="authNote">
                        A verification link can only be used once and expires after 24 hours.
                        Registering again with the same address sends a new one.
                    </p>
                    <button type="button" className="authSubmit" onClick={onDone}>
                        Back to sign in
                    </button>
                </>
            )}
        </div>
    );
}

export default VerifyEmail;

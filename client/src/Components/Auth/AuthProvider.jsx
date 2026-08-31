import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthContext } from "../../Context/AuthContext";
import { apiCall, setToken, getToken, setSessionLostHandler } from "../../Functions/api";
import SignInDialog from "./SignInDialog";
import * as analytics from "../../Functions/analytics";

/**
 * Holds the signed-in account and the actions that change it.
 *
 * On load it asks the server who the stored token belongs to, rather than trusting anything
 * kept in the browser. A token that has expired or been signed out elsewhere is discarded.
 */
function AuthProvider({ children }) {

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    // null when the panel is closed, otherwise the form to open it on. Registering and signing
    // in are the same panel, so which one a button means has to travel with the request.
    const [prompting, setPrompting] = useState(null);

    const promptSignIn = useCallback((mode = "signin") => setPrompting(mode), []);

    // A 401 means the session has gone. Clear it and ask for sign-in, since the only reason
    // a data request was made is that the user wanted the data.
    useEffect(() => {
        setSessionLostHandler(() => { setUser(null); setPrompting("signin"); });
    }, []);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            if (!getToken()) {
                if (!cancelled) setLoading(false);
                return;
            }
            const { body } = await apiCall("/auth/me");
            if (cancelled) return;
            if (body?.user) setUser(body.user);
            else setToken(null);
            setLoading(false);
        })();

        return () => { cancelled = true; };
    }, []);

    const register = useCallback(async ({ email, password, firstName, lastName, sector,
                                         intendedUse }) => {
        const { ok, body } = await apiCall("/auth/register", {
            method: "POST", auth: false,
            body: { email, password, firstName, lastName, sector, intendedUse },
        });
        if (ok) analytics.accountEvent("register");
        return ok ? { ok: true } : { ok: false, error: body?.error || "Could not register." };
    }, []);

    const signIn = useCallback(async ({ email, password }) => {
        const { ok, body } = await apiCall("/auth/login", {
            method: "POST", auth: false, body: { email, password },
        });
        if (!ok) {
            return { ok: false, error: body?.error || "Could not sign in.", reason: body?.reason };
        }
        setToken(body.token);
        setUser(body.user);
        setPrompting(null);
        analytics.identify(body.token);
        analytics.accountEvent("sign_in");
        return { ok: true };
    }, []);

    const verify = useCallback(async (token) => {
        const { ok, body } = await apiCall("/auth/verify", {
            method: "POST", auth: false, body: { token },
        });
        if (!ok) {
            return { ok: false, error: body?.error || "Could not verify the address." };
        }
        setToken(body.token);
        setUser(body.user);
        return { ok: true };
    }, []);

    const signOut = useCallback(async () => {
        await apiCall("/auth/logout", { method: "POST" });
        setToken(null);
        setUser(null);
        analytics.identify(null);
    }, []);

    const value = useMemo(
        () => ({ user, loading, promptSignIn, register, signIn, verify, signOut }),
        [user, loading, promptSignIn, register, signIn, verify, signOut]);

    return (
        <AuthContext.Provider value={value}>
            {children}
            {prompting && !user && (
                <SignInDialog initialMode={prompting} onClose={() => setPrompting(null)} />
            )}
        </AuthContext.Provider>
    );
}

export default AuthProvider;

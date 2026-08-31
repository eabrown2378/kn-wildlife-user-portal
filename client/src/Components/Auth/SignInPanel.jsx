import { useContext, useEffect, useState } from "react";
import { AuthContext } from "../../Context/AuthContext";
import { apiCall } from "../../Functions/api";

const FALLBACK_SECTORS = ["Academia", "Industry", "Government", "Student"];

/**
 * Sign in, or register for access.
 *
 * Registration asks for the account holder's name and the sector they work in, both
 * required, and an optional description of how they intend to use the data. All of it is
 * recorded with the account so the project can report on who its data reaches, and the name
 * is what the portal shows once they are signed in.
 */
function SignInPanel({ heading, intro, initialMode = "signin" }) {

    const { signIn, register } = useContext(AuthContext);

    const [mode, setMode] = useState(initialMode);
    const [sectors, setSectors] = useState(FALLBACK_SECTORS);

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [sector, setSector] = useState("");
    const [intendedUse, setIntendedUse] = useState("");

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [sent, setSent] = useState(false);

    // The sector list comes from the server so the form cannot drift from what it accepts.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const { body } = await apiCall("/auth/sectors", { auth: false });
            if (!cancelled && Array.isArray(body?.sectors) && body.sectors.length) {
                setSectors(body.sectors);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const switchTo = (next) => {
        setMode(next);
        setError("");
        setSent(false);
    };

    const submit = async (event) => {
        event.preventDefault();
        setError("");
        setBusy(true);

        const result = mode === "signin"
            ? await signIn({ email, password })
            : await register({ email, password, firstName, lastName, sector, intendedUse });

        setBusy(false);
        if (!result.ok) {
            setError(result.error);
            return;
        }
        if (mode === "register") setSent(true);
    };

    if (sent) {
        return (
            <div className="authPanel">
                <h2>Check your email</h2>
                <p>
                    If <strong>{email}</strong> can receive mail, a message is on its way with a
                    link to confirm the address. The link is valid for 24 hours.
                </p>
                <p className="authNote">
                    Your account is not active until the address is confirmed.
                </p>
                <button type="button" className="authLink" onClick={() => switchTo("signin")}>
                    Back to sign in
                </button>
            </div>
        );
    }

    return (
        <div className="authPanel">
            <h2>{mode === "signin" ? (heading || "Sign in") : "Register for access"}</h2>
            <p className="authIntro">
                {intro || "The KN-Wildlife portal serves cleaned and harmonised occurrence, "
                        + "abundance and density data. Retrieving data requires a confirmed "
                        + "email address."}
            </p>

            <form onSubmit={submit}>
                <label className="authLabel" htmlFor="authEmail">Email address</label>
                <input
                    id="authEmail" type="email" autoComplete="username" required
                    value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy}
                />

                <label className="authLabel" htmlFor="authPassword">Password</label>
                <input
                    id="authPassword" type="password" required
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy}
                />
                {mode === "register" && (
                    <p className="authHint">At least 12 characters.</p>
                )}

                {mode === "register" && (
                    <>
                        <div className="authNameRow">
                            <div>
                                <label className="authLabel" htmlFor="authFirstName">
                                    First name
                                </label>
                                <input
                                    id="authFirstName" type="text" required maxLength={100}
                                    autoComplete="given-name" disabled={busy}
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="authLabel" htmlFor="authLastName">
                                    Last name
                                </label>
                                <input
                                    id="authLastName" type="text" required maxLength={100}
                                    autoComplete="family-name" disabled={busy}
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                />
                            </div>
                        </div>

                        <label className="authLabel" htmlFor="authSector">
                            Which sector do you work in?
                        </label>
                        <select
                            id="authSector" required value={sector} disabled={busy}
                            onChange={(e) => setSector(e.target.value)}
                        >
                            <option value="">Choose one</option>
                            {sectors.map((name) => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </select>

                        <label className="authLabel" htmlFor="authUse">
                            How do you intend to use the data? <span className="authOptional">optional</span>
                        </label>
                        <textarea
                            id="authUse" rows={3} maxLength={2000} disabled={busy}
                            value={intendedUse} onChange={(e) => setIntendedUse(e.target.value)}
                            placeholder="For example: modelling range shifts in freshwater fish."
                        />
                    </>
                )}

                {error && <p className="authError">{error}</p>}

                <button type="submit" className="authSubmit" disabled={busy}>
                    {busy ? "Working..." : mode === "signin" ? "Sign in" : "Register"}
                </button>
            </form>

            <p className="authSwitch">
                {mode === "signin" ? (
                    <>
                        No account?{" "}
                        <button type="button" className="authLink"
                                onClick={() => switchTo("register")}>Register for access</button>
                    </>
                ) : (
                    <>
                        Already registered?{" "}
                        <button type="button" className="authLink"
                                onClick={() => switchTo("signin")}>Sign in</button>
                    </>
                )}
            </p>
        </div>
    );
}

export default SignInPanel;

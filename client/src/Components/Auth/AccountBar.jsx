import { useContext, useState } from "react";
import { AuthContext } from "../../Context/AuthContext";

/**
 * The account controls, in the top right of every page.
 *
 * Signed out, it offers sign in and register. Signed in, it names the person so it is obvious
 * which account a download will be attributed to. The bar is always present, because the
 * portal is usable without an account and somebody browsing it still needs a way in.
 */
function AccountBar() {

    const { user, loading, promptSignIn, signOut } = useContext(AuthContext);
    const [busy, setBusy] = useState(false);

    // Nothing is offered until the stored session has been checked, so the bar does not show
    // "Sign in" for a moment to somebody who is already signed in.
    const controls = loading ? null : user ? (
        <>
            <span className="accountName">{displayName(user)}</span>
            <button
                type="button" className="accountSignOut" disabled={busy}
                onClick={async () => { setBusy(true); await signOut(); setBusy(false); }}
            >
                {busy ? "Signing out..." : "Sign out"}
            </button>
        </>
    ) : (
        <>
            <button type="button" className="accountSignIn"
                    onClick={() => promptSignIn("signin")}>Sign in</button>
            <button type="button" className="accountRegister"
                    onClick={() => promptSignIn("register")}>Register</button>
        </>
    );

    return (
        <header className="accountBar">
            <span className="accountBrand">KN-Wildlife</span>
            <div className="accountBarControls">{controls}</div>
        </header>
    );
}

/**
 * What to call the signed-in person.
 *
 * Accounts created before names were asked for have none, so the address stands in. A blank
 * space there would read as a fault.
 */
function displayName(user) {
    const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
    return name || user.email;
}

export default AccountBar;

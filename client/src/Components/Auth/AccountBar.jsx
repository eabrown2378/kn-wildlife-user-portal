import { useContext, useState } from "react";
import { AuthContext } from "../../Context/AuthContext";

/** Who is signed in, and the way out. */
function AccountBar() {

    const { user, signOut } = useContext(AuthContext);
    const [busy, setBusy] = useState(false);

    if (!user) return null;

    return (
        <div className="accountBar">
            <span className="accountEmail">{user.email}</span>
            <span className="accountSector">{user.sector}</span>
            <button
                type="button" className="accountSignOut" disabled={busy}
                onClick={async () => { setBusy(true); await signOut(); setBusy(false); }}
            >
                {busy ? "Signing out..." : "Sign out"}
            </button>
        </div>
    );
}

export default AccountBar;

/**
 * Whether the visitor has agreed to usage analytics, and when they decided.
 *
 * The decision is stored with a timestamp, because "did this person agree, and when" is the
 * question a privacy request asks and a bare flag cannot answer it.
 *
 * An earlier version of the banner stored `gaConsentConfirmed` and offered only an
 * acknowledgement, with no way to refuse. That is not a decision, so it is not read here: a
 * visitor who only ever saw the acknowledgement is asked again and can now say no.
 *
 * This governs Google Analytics alone. The server's own record of which account retrieved
 * which data is not affected: it is the operational log of a service the user signed in to,
 * kept on the machine that serves them, and the portal cannot honour its own data-sharing
 * obligations without it.
 */

const KEY = "knw.analyticsConsent";

/** "granted", "declined", or null when nobody has been asked yet. */
function readConsent() {
    try {
        const stored = window.localStorage.getItem(KEY);
        if (!stored) return null;
        const decision = JSON.parse(stored);
        return decision.choice === "granted" || decision.choice === "declined"
            ? decision.choice : null;
    } catch {
        // Private windows and blocked storage both land here. Treated as undecided, which
        // means analytics stays off until somebody says otherwise.
        return null;
    }
}

/** The whole decision, including when it was made. */
function consentRecord() {
    try {
        return JSON.parse(window.localStorage.getItem(KEY)) || null;
    } catch {
        return null;
    }
}

function recordConsent(choice) {
    try {
        window.localStorage.setItem(KEY, JSON.stringify({
            choice,
            at: new Date().toISOString(),
        }));
    } catch {
        // Nothing can be stored, so the banner returns on the next visit. Asking twice is
        // better than assuming an answer.
    }
}

/** Forget the decision, so the banner asks again. */
function clearConsent() {
    try {
        window.localStorage.removeItem(KEY);
    } catch {
        // nothing to remove
    }
}

export { readConsent, consentRecord, recordConsent, clearConsent };

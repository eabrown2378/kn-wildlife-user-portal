import { createContext } from "react";

/**
 * The visitor's analytics decision, and the way to change it.
 *
 * `consent` is "granted", "declined", or null while the banner is showing. `reconsider` puts
 * it back to null so the banner returns, which is how the footer offers a change of mind
 * without anyone having to clear their browser storage.
 */
export const AnalyticsConsentContext = createContext({
    consent: null,
    decide: () => {},
    reconsider: () => {},
});

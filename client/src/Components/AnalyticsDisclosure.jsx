/**
 * Asks whether the visitor agrees to usage analytics, and takes no for an answer.
 *
 * Shown only while nobody has decided. Both buttons are given equal weight, because a banner
 * where refusing is harder than agreeing is not really asking. Nothing is sent to Google
 * before a choice is made: `App` starts analytics on consent and not on load.
 *
 * The decision can be changed later from the footer, which is why the banner does not need to
 * stay on screen once it has an answer.
 */
function AnalyticsDisclosure({ onDecide }) {

    return (
        <div className="consentBanner" role="dialog" aria-label="Usage analytics">
            <p className="consentBanner--text">
                We use Google Analytics to see how the portal is used, which helps us decide
                what to improve. It records how searches are shaped and which views are opened,
                never the taxa or places you search for. You can change this later from the
                footer.
            </p>
            <div className="consentBanner--actions">
                <button type="button" className="consentBanner--accept"
                        onClick={() => onDecide("granted")}>
                    Allow analytics
                </button>
                <button type="button" className="consentBanner--decline"
                        onClick={() => onDecide("declined")}>
                    No thanks
                </button>
            </div>
            <p className="consentBanner--note">
                Retrieving data needs an account, and what each account downloads is recorded on
                our own server so the project can report on who its data reaches. That record is
                part of the service and is kept whichever button you choose.
            </p>
        </div>
    );
}

export default AnalyticsDisclosure;

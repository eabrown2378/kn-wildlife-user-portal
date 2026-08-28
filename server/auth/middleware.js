const store = require('./store');

/**
 * Reads the session token a request carries, from the Authorization header.
 *
 * The token is a bearer credential rather than a cookie because the portal is served from a
 * different origin to the API, where a cookie would need SameSite=None and credentialed CORS.
 */
function tokenFrom(request) {
    const header = request.get('authorization') || '';
    const match = /^Bearer\s+(.+)$/i.exec(header.trim());
    return match ? match[1].trim() : null;
}

/** The signed-in user, or null. Never throws; used where sign-in is optional. */
function currentUser(request) {
    try {
        return store.userForSession(tokenFrom(request));
    } catch (error) {
        console.error('[auth] could not read session:', error.message);
        return null;
    }
}

/**
 * Refuse a request that is not from a verified, signed-in account.
 *
 * An unverified account is rejected separately from an absent one, because the two need
 * different actions from the caller and a single "unauthorized" tells them neither.
 */
function requireVerifiedUser(request, response, next) {
    const user = currentUser(request);
    if (!user) {
        return response.status(401).send({
            error: 'Sign in to access this data.',
            reason: 'not_signed_in',
        });
    }
    if (!user.verified_at) {
        return response.status(403).send({
            error: 'Confirm your email address before accessing the data. '
                 + 'Check your inbox for the verification link.',
            reason: 'email_not_verified',
        });
    }
    request.user = user;
    next();
}

/** What the client is told about the signed-in account. Never includes the password hash. */
function publicUser(user) {
    if (!user) return null;
    return {
        email: user.email,
        sector: user.sector,
        intendedUse: user.intended_use || null,
        verified: Boolean(user.verified_at),
        createdAt: user.created_at,
    };
}

module.exports = { tokenFrom, currentUser, requireVerifiedUser, publicUser };

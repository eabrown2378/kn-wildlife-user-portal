/**
 * Calls to the portal API, with the session attached.
 *
 * The session token is a bearer credential in the Authorization header rather than a cookie,
 * because the portal and the API are served from different origins. It is held in
 * localStorage so a reload does not sign the user out.
 *
 * A 401 means the session is gone - expired, or ended elsewhere. The token is cleared and
 * `onSessionLost` is called so the interface can return to the sign-in screen rather than
 * showing an error for something the user cannot act on.
 */

export const API_BASE = 'http://localhost:8080';
const TOKEN_KEY = 'kn-wildlife-session';

let onSessionLost = () => {};

export function setSessionLostHandler(handler) {
    onSessionLost = typeof handler === 'function' ? handler : () => {};
}

export function getToken() {
    try {
        return window.localStorage.getItem(TOKEN_KEY);
    } catch {
        // storage is unavailable in a private window; the session lasts the page's lifetime
        return memoryToken;
    }
}

let memoryToken = null;

export function setToken(token) {
    memoryToken = token;
    try {
        if (token) window.localStorage.setItem(TOKEN_KEY, token);
        else window.localStorage.removeItem(TOKEN_KEY);
    } catch {
        // nothing to do; memoryToken carries the session for this page
    }
}

/**
 * Make a request against the API.
 *
 * Returns { ok, status, body }. It does not throw on an error status, because every caller
 * needs to show the server's message rather than a generic failure.
 */
export async function apiCall(path, { method = 'GET', body, auth = true } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    const token = auth ? getToken() : null;
    if (token) headers.Authorization = `Bearer ${token}`;

    let response;
    try {
        response = await fetch(API_BASE + path, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
        });
    } catch {
        return { ok: false, status: 0, body: { error: 'Could not reach the server.' } };
    }

    let payload = null;
    try {
        payload = await response.json();
    } catch {
        payload = null;
    }

    if (response.status === 401 && auth && token) {
        setToken(null);
        onSessionLost();
    }

    return { ok: response.ok, status: response.status, body: payload };
}

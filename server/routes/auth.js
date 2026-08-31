const express = require('express');
const router = express.Router();

const store = require('../auth/store');
const passwords = require('../auth/passwords');
const mailer = require('../auth/mailer');
const { tokenFrom, currentUser, publicUser } = require('../auth/middleware');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_INTENDED_USE = 2000;

/**
 * Attempts are limited per address and per client, in memory.
 *
 * This slows credential guessing without a dependency. It is per-process, so it resets on a
 * restart and does not hold across several servers; a deployment behind a load balancer wants
 * rate limiting at the proxy as well.
 */
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function tooManyAttempts(key) {
    const now = Date.now();
    const seen = (attempts.get(key) || []).filter((at) => now - at < WINDOW_MS);
    seen.push(now);
    attempts.set(key, seen);
    if (attempts.size > 5000) attempts.clear();   // bound the map
    return seen.length > MAX_ATTEMPTS;
}

router.post('/register', async function (request, response) {
    try {
        const email = store.normaliseEmail(request.body?.email);
        const password = request.body?.password;
        const firstName = String(request.body?.firstName || '').trim();
        const lastName = String(request.body?.lastName || '').trim();
        const sector = String(request.body?.sector || '').trim();
        const intendedUse = String(request.body?.intendedUse || '').trim();

        if (!EMAIL.test(email)) {
            return response.status(400).send({ error: 'Enter a valid email address.' });
        }
        // Checked on the server as well as in the form, because a request can be made without
        // one. Only presence and length are checked: names vary too widely across scripts and
        // cultures for a pattern to reject anything without also rejecting real people.
        if (!firstName || !lastName) {
            return response.status(400).send({ error: 'Enter your first and last name.' });
        }
        if (firstName.length > store.MAX_NAME || lastName.length > store.MAX_NAME) {
            return response.status(400).send({
                error: `Keep each name under ${store.MAX_NAME} characters.`,
            });
        }
        if (!store.SECTORS.includes(sector)) {
            return response.status(400).send({
                error: `Choose a sector: ${store.SECTORS.join(', ')}.`,
            });
        }
        if (intendedUse.length > MAX_INTENDED_USE) {
            return response.status(400).send({
                error: `Describe your intended use in under ${MAX_INTENDED_USE} characters.`,
            });
        }
        const passwordProblem = passwords.problemWith(password, email);
        if (passwordProblem) {
            return response.status(400).send({ error: passwordProblem });
        }

        // An existing address is answered the same way as a new one. Saying "that address is
        // already registered" tells anyone who asks which addresses hold accounts.
        const existing = store.findByEmail(email);
        if (existing) {
            if (!existing.verified_at) {
                const token = store.resetVerification(existing.id);
                await mailer.sendVerification(email, token);
            }
            return response.status(202).send({ status: 'verification_sent', email });
        }

        const hash = await passwords.hash(password);
        const id = store.createUser({
            email, passwordHash: hash, firstName, lastName, sector, intendedUse,
        });
        const token = store.createVerification(id);
        await mailer.sendVerification(email, token);

        return response.status(201).send({ status: 'verification_sent', email });
    } catch (error) {
        console.error('[auth] register failed:', error);
        return response.status(500).send({ error: 'Could not create the account.' });
    }
});

router.post('/verify', function (request, response) {
    try {
        const user = store.consumeVerification(request.body?.token);
        if (!user) {
            return response.status(400).send({
                error: 'That verification link is invalid or has expired. '
                     + 'Register again to receive a new one.',
            });
        }
        const session = store.createSession(user.id);
        return response.status(200).send({ token: session, user: publicUser(user) });
    } catch (error) {
        console.error('[auth] verify failed:', error);
        return response.status(500).send({ error: 'Could not verify the address.' });
    }
});

router.post('/login', async function (request, response) {
    try {
        const email = store.normaliseEmail(request.body?.email);
        const password = request.body?.password;

        if (tooManyAttempts(`${email}|${request.ip}`)) {
            return response.status(429).send({
                error: 'Too many sign-in attempts. Wait fifteen minutes and try again.',
            });
        }

        const user = store.findByEmail(email);

        // The password is checked even when no account exists, so a reply for an unknown
        // address takes as long as one for a known address. Returning early would let someone
        // discover which addresses are registered by timing the response.
        const stored = user ? user.password_hash
                            : '$scrypt$32768$8$1$00$00';
        const correct = await passwords.verify(password || '', stored);

        if (!user || !correct) {
            return response.status(401).send({ error: 'Email or password is incorrect.' });
        }
        if (!user.verified_at) {
            return response.status(403).send({
                error: 'Confirm your email address before signing in.',
                reason: 'email_not_verified',
            });
        }

        const session = store.createSession(user.id);
        return response.status(200).send({ token: session, user: publicUser(user) });
    } catch (error) {
        console.error('[auth] login failed:', error);
        return response.status(500).send({ error: 'Could not sign in.' });
    }
});

router.post('/logout', function (request, response) {
    try {
        store.endSession(tokenFrom(request));
    } catch (error) {
        console.error('[auth] logout failed:', error);
    }
    return response.status(200).send({ status: 'signed_out' });
});

/** Who the caller is, for the client to restore a session on load. */
router.get('/me', function (request, response) {
    const user = currentUser(request);
    if (!user) return response.status(200).send({ user: null });
    return response.status(200).send({ user: publicUser(user) });
});

/** The sectors the registration form offers, so the client does not hold its own copy. */
router.get('/sectors', function (request, response) {
    response.status(200).send({ sectors: store.SECTORS });
});

module.exports = router;

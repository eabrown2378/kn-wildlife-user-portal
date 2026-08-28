const crypto = require('crypto');

// scrypt parameters. N is the work factor and dominates the cost; 2^15 takes roughly 100ms
// on current hardware, which is slow enough to make guessing expensive and fast enough that a
// login does not feel delayed. They are stored with each hash so a future increase does not
// invalidate existing passwords.
const SCRYPT = { N: 32768, r: 8, p: 1, keylen: 64 };
const SALT_BYTES = 16;

// scrypt needs memory proportional to N*r*128 bytes, which exceeds node's default limit at
// this work factor.
const MAX_MEMORY = 128 * SCRYPT.N * SCRYPT.r * 2;

const MIN_LENGTH = 12;

/** Hash a password for storage. The salt and parameters travel with the hash. */
function hash(password) {
    return new Promise((resolve, reject) => {
        const salt = crypto.randomBytes(SALT_BYTES);
        crypto.scrypt(password, salt, SCRYPT.keylen,
            { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: MAX_MEMORY },
            (error, derived) => {
                if (error) return reject(error);
                resolve(`scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$` +
                        `${salt.toString('hex')}$${derived.toString('hex')}`);
            });
    });
}

/**
 * Check a password against a stored hash.
 *
 * The comparison is timing-safe: comparing with === leaks how many leading bytes matched,
 * which is enough to recover a hash byte by byte.
 */
function verify(password, stored) {
    return new Promise((resolve) => {
        if (typeof stored !== 'string') return resolve(false);
        const parts = stored.split('$');
        if (parts.length !== 6 || parts[0] !== 'scrypt') return resolve(false);

        const [, N, r, p, saltHex, hashHex] = parts;
        let salt, expected;
        try {
            salt = Buffer.from(saltHex, 'hex');
            expected = Buffer.from(hashHex, 'hex');
        } catch {
            return resolve(false);
        }

        const params = { N: Number(N), r: Number(r), p: Number(p) };
        crypto.scrypt(password, salt, expected.length,
            { ...params, maxmem: 128 * params.N * params.r * 2 },
            (error, derived) => {
                if (error) return resolve(false);
                resolve(derived.length === expected.length &&
                        crypto.timingSafeEqual(derived, expected));
            });
    });
}

/**
 * Why a password is unacceptable, or null if it is fine.
 *
 * Length is the requirement that matters; composition rules push people towards predictable
 * substitutions without adding much. The check against the email address catches the one
 * case a length rule misses.
 */
function problemWith(password, email) {
    if (typeof password !== 'string' || password.length < MIN_LENGTH) {
        return `Password must be at least ${MIN_LENGTH} characters.`;
    }
    if (password.length > 200) {
        return 'Password must be shorter than 200 characters.';
    }
    const local = String(email || '').split('@')[0].toLowerCase();
    if (local.length > 2 && password.toLowerCase().includes(local)) {
        return 'Password must not contain your email address.';
    }
    return null;
}

module.exports = { hash, verify, problemWith, MIN_LENGTH };

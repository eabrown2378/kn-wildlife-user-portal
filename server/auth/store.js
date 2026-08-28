const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

/**
 * Accounts, sessions and verification tokens, in a SQLite file beside the server.
 *
 * They are deliberately not in Neo4j. The query endpoint runs Cypher supplied by the client,
 * so anything in the graph is readable by any caller who can reach that endpoint; password
 * hashes and session tokens must not be. The graph is also emptied and rebuilt by
 * `import_graph.py reset-database`, which would take every account with it.
 *
 * Tokens are stored as SHA-256 digests rather than in the clear, so a copy of this file does
 * not let someone resume a session or claim a pending verification. The digest is enough to
 * check a token presented by a caller, which is all this needs to do.
 */

const SECTORS = ['Academia', 'Industry', 'Government', 'Student'];

const SESSION_DAYS = 30;
const VERIFICATION_HOURS = 24;

const DB_PATH = process.env.KN_AUTH_DB
    || path.join(__dirname, '..', 'data', 'accounts.sqlite');

let db = null;

function connect() {
    if (db) return db;
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new DatabaseSync(DB_PATH);
    db.exec(`
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            email         TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            sector        TEXT NOT NULL,
            intended_use  TEXT,
            verified_at   TEXT,
            created_at    TEXT NOT NULL,
            last_login_at TEXT
        );

        CREATE TABLE IF NOT EXISTS sessions (
            token_hash TEXT PRIMARY KEY,
            user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TEXT NOT NULL,
            expires_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS verifications (
            token_hash TEXT PRIMARY KEY,
            user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            expires_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
        CREATE INDEX IF NOT EXISTS verifications_user ON verifications(user_id);
    `);
    return db;
}

const now = () => new Date().toISOString();
const digest = (token) => crypto.createHash('sha256').update(token).digest('hex');
const newToken = () => crypto.randomBytes(32).toString('hex');

function plusDays(days) {
    return new Date(Date.now() + days * 86400000).toISOString();
}

function plusHours(hours) {
    return new Date(Date.now() + hours * 3600000).toISOString();
}

/** Email addresses are matched case-insensitively, so they are stored folded. */
function normaliseEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function createUser({ email, passwordHash, sector, intendedUse }) {
    const database = connect();
    const statement = database.prepare(`
        INSERT INTO users (email, password_hash, sector, intended_use, created_at)
        VALUES (?, ?, ?, ?, ?)
    `);
    const result = statement.run(normaliseEmail(email), passwordHash, sector,
                                 intendedUse || null, now());
    return Number(result.lastInsertRowid);
}

function findByEmail(email) {
    return connect().prepare('SELECT * FROM users WHERE email = ?').get(normaliseEmail(email));
}

function findById(id) {
    return connect().prepare('SELECT * FROM users WHERE id = ?').get(id);
}

/** Issue a verification token. Returns the clear token; only its digest is stored. */
function createVerification(userId) {
    const token = newToken();
    connect().prepare(`
        INSERT INTO verifications (token_hash, user_id, expires_at) VALUES (?, ?, ?)
    `).run(digest(token), userId, plusHours(VERIFICATION_HOURS));
    return token;
}

/**
 * Mark an account verified from a token. Returns the user, or null when the token is unknown
 * or expired. The token is single-use.
 */
function consumeVerification(token) {
    const database = connect();
    const row = database.prepare('SELECT * FROM verifications WHERE token_hash = ?')
                        .get(digest(token || ''));
    if (!row) return null;
    database.prepare('DELETE FROM verifications WHERE token_hash = ?').run(row.token_hash);
    if (row.expires_at < now()) return null;

    database.prepare('UPDATE users SET verified_at = ? WHERE id = ?').run(now(), row.user_id);
    return findById(row.user_id);
}

/** Replace any outstanding verification for a user, so a resend invalidates the old link. */
function resetVerification(userId) {
    connect().prepare('DELETE FROM verifications WHERE user_id = ?').run(userId);
    return createVerification(userId);
}

function createSession(userId) {
    const token = newToken();
    connect().prepare(`
        INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)
    `).run(digest(token), userId, now(), plusDays(SESSION_DAYS));
    connect().prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(now(), userId);
    return token;
}

/** The user a session token belongs to, or null when it is unknown or expired. */
function userForSession(token) {
    if (!token) return null;
    const database = connect();
    const row = database.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(digest(token));
    if (!row) return null;
    if (row.expires_at < now()) {
        database.prepare('DELETE FROM sessions WHERE token_hash = ?').run(row.token_hash);
        return null;
    }
    return findById(row.user_id);
}

function endSession(token) {
    if (!token) return;
    connect().prepare('DELETE FROM sessions WHERE token_hash = ?').run(digest(token));
}

/** Remove expired sessions and verifications. Safe to call at any time. */
function purgeExpired() {
    const database = connect();
    const stamp = now();
    const sessions = database.prepare('DELETE FROM sessions WHERE expires_at < ?').run(stamp);
    const pending = database.prepare('DELETE FROM verifications WHERE expires_at < ?').run(stamp);
    return { sessions: Number(sessions.changes), verifications: Number(pending.changes) };
}

/** Release the database file. Needed by anything that wants to remove or replace it. */
function close() {
    if (db) { db.close(); db = null; }
}

/** Registrations by sector, for reporting on who is using the data. */
function sectorCounts() {
    return connect().prepare(`
        SELECT sector, COUNT(*) AS accounts,
               SUM(CASE WHEN verified_at IS NOT NULL THEN 1 ELSE 0 END) AS verified
        FROM users GROUP BY sector ORDER BY accounts DESC
    `).all();
}

module.exports = {
    SECTORS, SESSION_DAYS, VERIFICATION_HOURS, DB_PATH,
    connect, normaliseEmail,
    createUser, findByEmail, findById,
    createVerification, consumeVerification, resetVerification,
    createSession, userForSession, endSession,
    purgeExpired, sectorCounts, close,
};

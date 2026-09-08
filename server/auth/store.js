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
 * Tokens are stored as SHA-256 digests, so a copy of this file does
 * not let someone resume a session or claim a pending verification. The digest is enough to
 * check a token presented by a caller, which is all this needs to do.
 */

const SECTORS = ['Academia', 'Industry', 'Government', 'Student'];

/** Longest name accepted, which is well past any real one and short enough to store. */
const MAX_NAME = 100;

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
            first_name    TEXT,
            last_name     TEXT,
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

        -- What each account retrieved, and when.
        --
        -- The registration gate exists to know who the data reaches, and that question is
        -- only answerable if the retrievals are recorded next to the accounts. Google
        -- Analytics cannot answer it: its terms forbid sending personal information, a
        -- meaningful share of visitors block it, and the download is assembled in the
        -- browser where it cannot see it. This is a first-party operational record of a
        -- first-party service, written on the server, complete by construction.
        CREATE TABLE IF NOT EXISTS data_requests (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            at       TEXT    NOT NULL,
            kind     TEXT    NOT NULL,
            filters  TEXT,
            rows     INTEGER,
            datasets TEXT
        );

        CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
        CREATE INDEX IF NOT EXISTS verifications_user ON verifications(user_id);
        CREATE INDEX IF NOT EXISTS data_requests_user ON data_requests(user_id);
        CREATE INDEX IF NOT EXISTS data_requests_at ON data_requests(at);
    `);
    addColumn(db, 'users', 'first_name', 'TEXT');
    addColumn(db, 'users', 'last_name', 'TEXT');
    return db;
}

/**
 * Add a column to an existing table, if it is not there already.
 *
 * `CREATE TABLE IF NOT EXISTS` leaves a table that already exists untouched, so a column
 * added to the definition above never reaches a database created before it. The accounts here
 * are real, so the file is migrated in place. The columns are nullable
 * because accounts registered before names were asked for do not have them, and there is no
 * value that could honestly be filled in.
 */
function addColumn(database, table, column, definition) {
    const existing = database.prepare(`PRAGMA table_info(${table})`).all();
    if (existing.some((row) => row.name === column)) return;
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
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

function createUser({ email, passwordHash, firstName, lastName, sector, intendedUse }) {
    const database = connect();
    const statement = database.prepare(`
        INSERT INTO users (email, password_hash, first_name, last_name, sector, intended_use,
                           created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = statement.run(normaliseEmail(email), passwordHash,
                                 firstName || null, lastName || null, sector,
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

/** Longest filter description stored, so one enormous search cannot bloat the file. */
const MAX_FILTERS = 4000;


/**
 * Record that an account retrieved data.
 *
 * `kind` is 'query' when the graph was searched and 'download' when the result was taken
 * away; the two are counted separately because a search that is refined five times before a
 * download is one download and five queries.
 *
 * Never throws. A failure to write the log must not fail the request that produced it: the
 * user asked for data, not for bookkeeping, and losing a row here is a smaller harm than
 * losing their result.
 */
function recordDataRequest({ userId, kind, filters, rows, datasets }) {
    try {
        const described = filters == null ? null
            : JSON.stringify(filters).slice(0, MAX_FILTERS);
        connect().prepare(`
            INSERT INTO data_requests (user_id, at, kind, filters, rows, datasets)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(userId, now(), kind, described,
               Number.isFinite(rows) ? Math.trunc(rows) : null,
               Array.isArray(datasets) ? datasets.join(' | ') : (datasets || null));
    } catch (error) {
        console.error('[audit] could not record a data request:', error.message);
    }
}


/** What each account has retrieved, newest first. */
function dataRequestsFor(userId, limit = 100) {
    return connect().prepare(`
        SELECT at, kind, filters, rows, datasets FROM data_requests
        WHERE user_id = ? ORDER BY at DESC LIMIT ?
    `).all(userId, limit);
}


/** Retrieval totals per account, for reporting on who the data reaches. */
function retrievalSummary() {
    return connect().prepare(`
        SELECT u.email, u.first_name, u.last_name, u.sector,
               SUM(CASE WHEN r.kind = 'query' THEN 1 ELSE 0 END)    AS queries,
               SUM(CASE WHEN r.kind = 'download' THEN 1 ELSE 0 END) AS downloads,
               SUM(CASE WHEN r.kind = 'download' THEN r.rows ELSE 0 END) AS rows_taken,
               MAX(r.at) AS last_seen
        FROM users u JOIN data_requests r ON r.user_id = u.id
        GROUP BY u.id ORDER BY downloads DESC, queries DESC
    `).all();
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
    SECTORS, MAX_NAME, SESSION_DAYS, VERIFICATION_HOURS, DB_PATH,
    connect, normaliseEmail,
    createUser, findByEmail, findById,
    createVerification, consumeVerification, resetVerification,
    createSession, userForSession, endSession,
    purgeExpired, sectorCounts, close,
    recordDataRequest, dataRequestsFor, retrievalSummary,
};

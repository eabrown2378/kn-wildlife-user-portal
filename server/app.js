const express = require('express');
const app = express();
const cors = require('cors');
const compression = require('compression');
let bodyParser = require('body-parser');

require('dotenv').config();

/**
 * The page origins allowed to call this API.
 *
 * CORS names the origin a *page* is served from, not the address of the API, so this is the
 * list of places the portal is loaded from. In production the portal and the API are both at
 * https://kn-wildlife.crc.nd.edu, which makes those calls same-origin and exempt from CORS
 * entirely; the entry is kept so the API still answers if the two are ever split, and so a
 * preview build served from somewhere else fails loudly.
 *
 * Set KN_ALLOWED_ORIGINS to a comma-separated list to override, which is how a staging host
 * is added without a code change.
 */
const DEFAULT_ORIGINS = [
    'https://kn-wildlife.crc.nd.edu',
    'http://localhost:5173',
    'http://localhost:4173',
];

const ALLOWED_ORIGINS = (process.env.KN_ALLOWED_ORIGINS
    ? process.env.KN_ALLOWED_ORIGINS.split(',')
    : DEFAULT_ORIGINS).map((origin) => origin.trim().replace(/\/$/, '')).filter(Boolean);

app.use(cors({
    // A request with no Origin header is not a browser page - curl, a server-side caller, a
    // health check - and CORS has nothing to say about it, so it is allowed through. What
    // CORS protects against is another site's page using someone's browser.
    origin(origin, done) {
        if (!origin || ALLOWED_ORIGINS.includes(origin.replace(/\/$/, ''))) {
            return done(null, true);
        }
        return done(new Error(`Origin ${origin} is not allowed to call this API.`));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
}));

// query results and search options are large, highly repetitive JSON; gzipping them
// shrinks the response by roughly 17x over the wire
app.use(compression());

/**
 * Behind Apache every request arrives from 127.0.0.1, so without this the sign-in rate limiter
 * counts the proxy, and one person's failed attempts lock out everybody.
 * With it, req.ip reads the address Apache puts in X-Forwarded-For.
 *
 * The number is how many proxies sit in front. Only set it when there really is one: trusting
 * a header nobody is overwriting lets a caller claim any address it likes.
 */
if (process.env.KN_TRUST_PROXY) {
    app.set('trust proxy', Number(process.env.KN_TRUST_PROXY) || 1);
}

const test_api = require('./routes/test_api');
const chatbotRoute = require('./routes/chatbot');
const authRoute = require('./routes/auth');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/auth', authRoute);
app.use('/test_api', test_api);
app.use('/chatbot', chatbotRoute);

app.use(express.static('./public/index.html'));


const PORT = Number(process.env.PORT) || 8080;

app.listen(PORT);

console.log(`Server listening on port ${PORT}.`);
console.log(`Allowing browser origins: ${ALLOWED_ORIGINS.join(', ')}`);

module.exports = app;
const express = require('express');
const app = express();
const cors = require('cors');
const compression = require('compression');
let bodyParser = require('body-parser');


app.use(cors());

// query results and search options are large, highly repetitive JSON; gzipping them
// shrinks the response by roughly 17x over the wire
app.use(compression());

app.use(function (req, res, next) {  
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    next();
});

require('dotenv').config();

const test_api = require('./routes/test_api');
const chatbotRoute = require('./routes/chatbot');
const authRoute = require('./routes/auth');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/auth', authRoute);
app.use('/test_api', test_api);
app.use('/chatbot', chatbotRoute);

app.use(express.static('./public/index.html'));


app.listen(8080);

console.log("Server listening on port 8080.");

module.exports = app;
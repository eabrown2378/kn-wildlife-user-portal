const express = require('express');
const app = express();
const cors = require('cors');
let bodyParser = require('body-parser'); 
const https = require('https');
const fs = require('fs');

/* const options = {
  key: fs.readFileSync('./kn-wildlife.crc.nd.edu.key'),
  cert: fs.readFileSync('./kn-wildlife.crc.nd.edu.cer'),
}; */


// only need CORS in local development, in prod handle with Apache
app.use(cors());

app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept'
  );
  next();
});

require('dotenv').config();

const test_api = require('./routes/test_api');
const chatbotRoute = require('./routes/chatbot');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
// 
app.use('/test_api', test_api);
app.use('/chatbot', chatbotRoute);

app.use(express.static('./public/index.html'));

/* // Create HTTPS server
https.createServer(options, app).listen(8080, () => {
  console.log('HTTPS Server running on port 8080');
}); */

app.listen(8080);

console.log("Server listening on port 8080.");

module.exports = app;
var ti = require("./lib/timeout.js");

module.exports = {
  createServer : require('./lib/server.js'),
  connect      : require('./lib/client.js'),
  retrydelay   : ti.retrydelay,
  timeout      : ti.timeout,
};

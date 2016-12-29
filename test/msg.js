var rpc = require('../');
var fs = require("fs");

rpc.retrydelay(5);
rpc.timeout(30);

var jpserver = JSON.parse(fs.readFileSync(__dirname + '/server.jpfx', 'utf8'));
var jpclient = JSON.parse(fs.readFileSync(__dirname + '/client.jpfx', 'utf8'));

var cluster = require('cluster');

if (cluster.isMaster) {
  var server = rpc.createServer(jpserver, 1000, 'test', 'test');

  server.on('error', function(e) {
    throw e;
  });

  cluster.on('exit', function (worker, code, signal) {
    console.log('exit', code, signal);
    process.exit(code);
  });

  cluster.fork();
} else {
  var client = rpc.connect(jpclient, 1000, 'test', 'test');

  client.on('error', function(e) {
    throw e;
  });
}

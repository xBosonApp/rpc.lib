var rpc = require('../');
var fs = require("fs");
var cluster = require('cluster');

rpc.retrydelay(5);
rpc.timeout(3);

var jpserver = JSON.parse(fs.readFileSync(__dirname + '/server.jpfx', 'utf8'));
var jpclient = JSON.parse(fs.readFileSync(__dirname + '/client.jpfx', 'utf8'));

var count = 0;
var start = Date.now();


if (cluster.isMaster) {
  var server = rpc.createServer(jpserver, 1000, 'test', 'test');

  server.on('error', function(e) {
    console.log('server fail1', e.message);
    process.exit(1);
  });

  var __mod1 = {
    attr1: 100,
    fn1 : function(a, cb) {
      ++count;
      cb(null, count);
    },
    fn2 : function(a, cb) {
      throw new Error('throw error');
    },
  };

  server.exports('mod1', __mod1);
  cluster.fork();
  
} else {

  var client = rpc.connect(jpclient, 1000, 'test', 'test');

  client.on('error', function(e) {
    console.log('! fail, client fail', e.message);
    process.exit(1);
  });

  client.require('mod1', function(err, mod1, mod2) {
    if (err) return console.error('! fail, require module mod1', err.message);

    for (var i=0; i<1000; ++i) {
      mod1.fn1(count, function(err, data) {
        if (err) {
          console.log('fail', err.message);
          process.exit(2);
        }
        ++count;
        console.log('call', count, (Date.now() - start)/count, 'ms/call');
        if (count >= i) process.exit(0);
      });
    }
  });
}

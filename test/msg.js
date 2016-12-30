var rpc = require('../');
var fs = require("fs");

rpc.retrydelay(5);
rpc.timeout(3);

var jpserver = JSON.parse(fs.readFileSync(__dirname + '/server.jpfx', 'utf8'));
var jpclient = JSON.parse(fs.readFileSync(__dirname + '/client.jpfx', 'utf8'));

// var cluster = require('cluster');

var server = rpc.createServer(jpserver, 1000, 'test', 'test');

server.on('error', function(e) {
  console.log('server fail1', e.message);
  process.exit(1);
});

var __mod1 = {
  attr1: 100,
  fn1 : function(a, cb) {
    cb(null, 890+a);
  },
  fn2 : function(a, cb) {
    throw new Error('throw error');
  },
};

var __mod2 = {
  test : function(id, cb) {
    cb(null, id+1000);
  },
}

server.exports('mod1', __mod1);
server.exports('mod2', __mod2);

// server.on('connection', function() {
  server.require('cmod', function(err, mod) {
    if (err) return console.error('! fail, require module cmod', err.message);
    mod.a(function(e, d) {
      console.log('ok a fn return', e, d)
    });
  });
// });

server.on('message', function(name, data) {
  console.log('ok s <', name, data);
});


var client = rpc.connect(jpclient, 1000, 'test', 'test');

client.on('error', function(e) {
  console.log('! fail, client fail', e.message);
  process.exit(1);
});

// client.on('connection', function() {
  client.require(['mod1', 'mod2'], function(err, mod1, mod2) {
    if (err) return console.error('! fail, require module mod1, mod2', err.message);

    mod1.fn1(10, function(err, data) {
      console.log('ok fn1 return', err && err.message, data);
    });

    mod1.fn2('hi', function(err, data) {
      console.log('ok fn2 return', err && err.message, data);
    })

    mod2.test(90, function(err, data) {
      console.log('ok test return', err || data);
    })

    console.log('ok Module:', mod1, mod2)
  });

  client.require('mod3', function(err, mod3) {
    if (err) return console.error('ok require module mod3:', err.message);
  });

  client.send('hi', [1,2,3]);
// });

var __cmod = {
  a : function(cb) {
    cb(null, 100);
  },
}

client.exports('cmod', __cmod);

setTimeout(function() {
  // process.exit(0);
  server.close();
  client.close();
}, 1000);

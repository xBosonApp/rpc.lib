try {
  !describe;
} catch(e) {
  throw 'cannot find `mocha`, please npm install mocha -g';
}

var rpc = require('../');
var fs = require("fs");
var assert = require('assert');
var crypto = require('crypto');

var timeout0 = 5;
rpc.retrydelay(0.1);
rpc.timeout(timeout0);
var errstr = crypto.randomBytes(10).toString('base64');

function rand() {
  return parseInt(Math.random() * 10000);
}

var __mod1 = {
  attr1: rand(),
  fn1 : function(a, cb) {
    cb(null, __mod1.attr1 + a);
  },
  fn2 : function(a, cb) {
    throw new Error(errstr);
  },
};

var __mod2 = {
  test : function(id, cb) {
    cb(null, id+1000);
  },
};

var __cmod = {
  a : function(a1, a2, cb) {
    cb(null, 100);
  },
}

var jpserver = JSON.parse(fs.readFileSync(__dirname + '/server.jpfx', 'utf8'));
var jpclient = JSON.parse(fs.readFileSync(__dirname + '/client.jpfx', 'utf8'));

// var cluster = require('cluster');
var server, client;

describe('create server', function() {
  server = rpc.createServer(jpserver, 1000, 'test', 'test');

  server.on('error', function(e) {
    console.log('server fail 1:', e.message);
    // process.exit(1);
  });

  it('server connect', function(done) {
    server.on('connection', function() {
      done();
    });
  });
});


describe('create client', function() {
  client = rpc.connect(jpclient, 1000, 'test', 'test');

  client.on('error', function(e) {
    console.log('! fail, client fail', e.message);
    // process.exit(1);
  });

  var _conn = false;
  client.on('connection', function() {
    _conn = true;
  });

  it('client connect', function(done) {
    if (_conn) {
      done();
    } else {
      client.on('connection', function() {
        done();
      });
    }
  });
});


describe('exports server/client lib', function() {
  server.exports('mod1', __mod1);
  server.exports('mod2', __mod2);
  client.exports('cmod', __cmod);
});


describe('test message', function() {
  var sdata = [];
  for (var i=0; i<100; ++i) {
    sdata[i] == parseInt( Math.random()*1000 );
  }

  it('client send server recv', function(done) {
    client.send('hi', sdata);
    server.on('msg-hi', function(name, data) {
      assert(name === 'hi');
      assert(data.length == sdata.length);
      for (var i=0; i<sdata.length; ++i) {
        assert(data[i] === sdata[i]);
      }
      done();
    });
  });

  it('server send client recv', function(done) {
    server.send('ui', sdata);
    client.on('msg-ui', function(name, data) {
      assert(name === 'ui');
      assert(data.length == sdata.length);
      for (var i=0; i<sdata.length; ++i) {
        assert(data[i] === sdata[i]);
      }
      done();
    });
  });
});


describe('server require', function() {
  var cmod;

  it('cmod', function(done) {
    server.require('cmod', function(err, mod) {
      assert.ifError(err);
      cmod = mod;
      assert(typeof cmod.a === 'function');
      done();
    });
  });

  it('call cmod.a wrong arguments', function(done) {
    try {
      cmod.a(function(e, d) {
      });
    } catch(e) {
      done();
    }
  });
});


describe('client require', function() {
  var mod1, mod2;
  it('requires mod1 mod2', function(done) {
    client.require(['mod1', 'mod2'], function(err, _mod1, _mod2) {
      assert.ifError(err);
      assert(_mod1);
      assert(_mod2)
      assert(typeof _mod1.fn1 === 'function');
      assert(typeof _mod1.fn2 === 'function');
      assert(typeof _mod2.test === 'function');
      assert(_mod1.attr1 == __mod1.attr1);
      mod1 = _mod1;
      mod2 = _mod2;
      done();
    });
  });

  it("mod1.fn1()", function(done) {
    var a = rand();
    mod1.fn1(a, function(err, data) {
      assert.ifError(err);
      assert(data == a + __mod1.attr1);
      done();
    });
  });

  it('mod1.fn2() throw error', function(done) {
    mod1.fn2('hi', function(err, data) {
      assert(err);
      assert(err.message == errstr);
      done();
    });
  });

  it('mod2.test()', function(done) {
    var a = 90;
    mod2.test(a, function(err, data) {
      assert.ifError(err);
      assert(data == a+1000, 'data != 1000+a');
      done();
    })
  });

  it('require mod3 throw error', function(done) {
    client.require('mod3', function(err) {
      assert(err);
      assert(err.message.indexOf('not found') >= 0, 'not a not found error');
      done();
    });
  });
});


describe('call queue', function() {
  it('bind send', function(done) {
    var send = require('../lib/call-queue.js')();
    var c = 0;
    function a(n) {
      assert(++c === n);
      if (n == 9) {
        done();
      }
    }
    function b(n) {
      assert(++c === n);
    }

    send.bind(a);
    send(1);send(2);send(3);
    send.unbind();
    send(4);send(5);send(6);
    send.bind(b);
    send.bind(a);
    send(7);send(8);send(9);
  });
});


describe('stream', function() {
  var sdata = ['hi', ' im', ' client !'];
  var wclosed;

  it('server open reader', function(done) {
    var r = server.openReadableStream('a');
    var rd = [];
    var c = 0;
    r.on('data', function(d) {
      rd.push(d.toString());
    });
    r.on("error", function(e) {
      assert.ifError(e);
    });
    r.on('end', function() {
      for (var i=0; i<sdata.length; ++i) {
        assert(sdata[i] === rd[i]);
      }
      if (++c == 2) done();
    });

    client.on('write-stream', function(name, w) {
      sdata.forEach(function(d) {
        w.write(d);
      });
      w.on('finish', function() {
        if (++c == 2) done();
      });
      w.end();
    });
  });


  it('server open writer', function(done) {
    var w = server.openWritableStream('big-data');
    var c = 0;
    w.on('error', function(e) {
      assert.ifError(e);
    });
    w.on('finish', function() {
      if (++c==2) done();
    });
    sdata.forEach(function (d) {
      w.write(d);
    });
    w.end();

    client.on('read-stream', function(name, r) {
      var rd = [];
      r.on('data', function(d) {
        rd.push(d.toString());
      });
      r.on('close', function() {
        for (var i=0; i<sdata.length; ++i) {
          assert(sdata[i] === rd[i]);
        }
        if (++c==2) done();
      });
    });
  });
});


describe('over', function() {
  it('close all', function(done) {
    server.close();
    client.close();
    done();
  });
});

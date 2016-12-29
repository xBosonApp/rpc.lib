module.exports = function createServer(jpfx, port, name, pass) {

  if (!jpfx) throw new Error('jpfx must set');
  if (!port) throw new Error('port must set');
  if (!name) throw new Error('name must set');

  var logger = require('logger-lib')('rpc-server');
  var jargon = require('jargon.lib');
  var bc     = require('broadcast-lib');
  var Event  = require('events');
  var checkp = require('./check-package.js');
  var Queue  = require('./call-queue.js');
  var FProxy = require('./function-proxy.js');

  var sender = Queue();
  var proxy  = FProxy(sender, logger);
  var ret    = new Event();
  var tlsport, tlsaddr;

  var server = jargon.createServer(jpfx);
  server.on('objectConnection', recvObject);
  server.on('error', function(err) { ret.emit('error', err) });
  server.listen(tlsready);

  ret.class = 'RPCServer';
  ret.close = close;
  proxy.bind(ret);

  return ret;


  function close() {
    server.close();
    logger.info('RPC server listener closed');
    ret.emit('close');
  }


  function tlsready() {
    tlsport = server.address().port;
    tlsaddr = server.address().address;
    logger.info('RPC server listener TCP port', tlsport);
    bc.createBroadcast({port: port}, broadListener);
  }


  function broadListener(err, brd) {
    if (err) {
      ret.emit("error", err);
      return;
    }
    logger.info('RPC broadcast server port', port);
    brd.onMessage(recvCenterReq);

    brd.onError(function(err) {
      ret.emit("error", err);
    });

    ret.once('close', function() {
      logger.info('RPC broadcast server close');
      brd.close();
    })
  }


  // 接受广播数据包
  function recvCenterReq(str, rinf, socket) {
    try {
      var msg = JSON.parse(str);
      if (msg.where != name) {
        logger.debug('skip udp data from', rinf, 'MSG:', msg);
        return;
      }
      var ret = {
        ip   : tlsaddr,
        port : tlsport,
        name : name,
        use  : 'TLS',
      }
      if (pass) {
        checkp.verify(pass, msg.encrypted, msg.hash);
        checkp.generate(pass, ret);
      }
      send(ret);
    } catch(e) {
      logger.debug(e.message);
    }

    function send(obj) {
      var ret = JSON.stringify(obj);
      socket.send(ret, 0, ret.length, rinf.port, rinf.address);
    }
  }


  function recvObject(socket) {
    ret.emit('connection', socket);
    socket.on('error', function(err) {
      ret.emit('error', err);
    });
    sender.bind(socket.send, socket);
    socket.on('object', function(obj) {
      proxy.recv(obj);
    });
  }

}

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
  var ret    = FProxy(sender, logger);
  var tlsport, tlsaddr;

  var server = jargon.createServer(jpfx);
  server.on('objectConnection', recvObject);
  server.on('error', function(err) { ret.emit('error', err) });
  server.listen(tlsready);

  ret.class = 'RPCServer';
  ret.close = close;

  return ret;


  function close() {
    server.close();
    logger.info('RPC listener closed');
    ret.emit('close');
  }


  function tlsready() {
    tlsport = server.address().port;
    tlsaddr = server.address().address;
    logger.info('RPC listener TCP port', tlsport);
    bc.createBroadcast({port: port}, broadListener);
  }


  function broadListener(err, brd) {
    if (err) {
      ret.emit("error", err);
      return;
    }
    logger.info('RPC broadcast recv port', port);
    brd.onMessage(recvCenterReq);

    brd.onError(function(err) {
      ret.emit("error", err);
    });

    ret.once('close', function() {
      logger.info('RPC broadcast close');
      brd.close();
    })
  }


  // 接受广播数据包
  function recvCenterReq(buf, rinf, socket) {
    try {
      var msg = JSON.parse(buf);
      if (msg.where != name) {
        logger.debug('skip search from',
            rinf.address, rinf.port, 'MSG:', msg);
        return;
      }
      var retmsg = {
        ip   : tlsaddr,
        port : tlsport,
        name : name,
        use  : 'TLS',
      }
      if (pass) {
        checkp.verify(pass, msg.encrypted, msg.hash);
        checkp.generate(pass, retmsg);
      }
      send(retmsg);
    } catch(e) {
      logger.debug(e.message);
    }

    function send(obj) {
      var retmsg = JSON.stringify(obj);
      socket.send(retmsg, 0, retmsg.length, rinf.port, rinf.address);
    }
  }

  //
  // 当服务端连接后, 会发送一个 connectSuccess 消息(利用 socket 模拟)
  // 并等待对端应答一个 message=connectSuccess 的消息
  //
  function recvObject(socket) {
    var connected = false;
    var context = {};
    socket.send({ name : 'connectSuccess' });

    ret.once('msg-connectSuccess', _connectSuccess);

    socket.on('error', function(err) {
      ret.emit('error', err, context);
    });

    socket.on('object', function(obj) {
      ret._recv(obj, context);
    });

    socket.on('close', function() {
      ret.removeListener('msg-connectSuccess', _connectSuccess);
      if (connected) {
        ret.emit('closed', context, socket);
      }
    });

    function _connectSuccess(name) {
      sender.bind(socket.send, socket);
      connected = true;
      ret.emit('connection', context, socket);
    }
  }

}

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

  var cl_id  = 0;
  var ret    = new Event();
  var allcli = {};
  var tlsport, tlsaddr;

  var server = jargon.createServer(jpfx);
  server.on('objectConnection', recvObject);
  server.on('error', function(err) { ret.emit('error', err) });
  server.listen(tlsready);

  ret.class   = 'RPCServer';
  ret.close   = close;
  ret.sendAll = sendAll;

  return ret;


  function close(cb) {
    ret.emit('close');
    server.close(function() {
      ret.emit('closed', server);
      if (cb) cb();
    });
    logger.info('RPC listener closed');
  }


  function sendAll(name, data) {
    for (var i in allcli) {
      allcli[i].send(name, data);
    }
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
    var _id = ++cl_id;
    var sender = Queue();
    var peer = FProxy(sender, logger, _id == 1);
    var connected = false;
    var context = {};

    peer.class = 'RpcClient';
    peer.close = _close;
    context.address = socket.address();
    context.remote = {
      address : socket.remoteAddress,
      family  : socket.remoteFamily,
      port    : socket.remotePort,
    };

    ret.once('close', _close);
    peer.once('msg-connectSuccess', _connectSuccess);
    socket.send({ name : 'connectSuccess' });

    ret.emit('beforeConnect', context, peer);

    socket.on('error', function(err) {
      if (peer.listenerCount('error') > 0) {
        peer.emit('error', err, context);
      } else {
        ret.emit('error', err, context, socket);
      }
    });

    socket.on('object', function(obj) {
      peer._recv(obj, context);
    });

    socket.on('close', function() {
      peer.removeListener('msg-connectSuccess', _connectSuccess);
      ret.removeListener('close', _close);
      sender.unbind();
      delete allcli[_id];
      if (connected) {
        peer.emit('closed', context, socket);
      }
    });

    function _close() {
      socket.end();
    }

    function _connectSuccess(name) {
      allcli[_id] = peer;
      connected = true;
      ret.emit('connection', context, peer);
      sender.bind(socket.send, socket);
    }
  }

}

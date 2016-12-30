module.exports = function connect(jpfx, port, name, pass) {

  if (!jpfx) throw new Error('jpfx must set');
  if (!port) throw new Error('port must set');
  if (!name) throw new Error('name must set');

  var logger = require('logger-lib')('rpc-client');
  var jargon = require('jargon.lib');
  var bc     = require('broadcast-lib');
  var Event  = require('events');
  var checkp = require('./check-package.js');
  var timer  = require('./timeout.js');
  var Queue  = require('./call-queue.js');
  var FProxy = require('./function-proxy.js');

  var INIT      = 1,
      CONNECTED = 2,
      RETRY     = 3
      CLOSED    = 4;

  var sender = Queue();
  var ret    = FProxy(sender, logger);
  var state  = INIT;
  var servermap = {};
  var backserver = [];

  ret.class = 'RPCClient';
  ret.close = close;
  bc.createBroadcast({
      exclusive : true, }, broadListener);

  return ret;


  function close() {
    state = CLOSED;
    ret.emit('close');
  }


  function broadListener(err, brd) {
    if (err) {
      ret.emit("error", err);
      return;
    }
    logger.info('RPC broadcast send port', port);

    ret.once('close', function() {
      logger.info('RPC broadcast close');
      brd.close();
    });

    brd.onError(function(err) {
      ret.emit("error", err);
    });

    sendBcReqServer();

    function sendBcReqServer() {
      if (state == RETRY || state == CLOSED) return;
      state = RETRY;

      var bak_remote = backserver.pop();
      if (bak_remote) {
        connecServer(bak_remote, sendBcReqServer);
        return;
      } else {
        requestServer();
      }

      // 收不到回复则不停的重试
      var tid = setInterval(function() {
        requestServer();
      }, timer.retrydelay());

      brd.onMessage(function(str, rinf, socket) {
        try {
          var msg = JSON.parse(str);
          if (msg.name != name) {
            logger.debug('skip resp from',
                rinf.address, rinf.port, 'MSG:', str);
            return;
          }

          if (pass) checkp.verify(pass, msg.encrypted, msg.hash);
          clearInterval(tid);

          var key = rinf.address +'^'+ msg.port;
          var remote = { ip: rinf.address, port: msg.port };
          // 接受到重复的包
          if (servermap[key]) {
            return;
          }
          servermap[key] = 1;

          // 正在连接时收到一个包
          if (state == CONNECTED) {
            logger.debug('Backup server connect', remote);
            backserver.push(remote);
            return;
          }
          state = CONNECTED;
          connecServer(remote, sendBcReqServer, key);
        } catch(e) {
          logger.debug(e.message);
        }
      });
    }

    function requestServer() {
      logger.debug('Search server `' + name + '`, port', port);
      var obj = { where : name };
      if (pass) {
        checkp.generate(pass, obj);
      }
      var str = JSON.stringify(obj);
      brd.send(Buffer.from(str), port);
    }
  }


  function connecServer(remote, retry, key) {
    var client = jargon.connect(remote.ip, remote.port, jpfx);

    client.on('error', function(err) {
      ret.emit('error', err);
    });

    client.on('close', function() {
      logger.debug('RPC connect close', remote);
      delete servermap[key];
      sender.unbind();
      retry();
    });

    client.on('connect', function() {
      logger.debug('RPC connect to (TCP) server', remote);
      ret.emit('connection', client);
    });

    sender.bind(client.send, client);
    client.on('object', function(obj) {
      ret._recv(obj);
    });

    ret.once('close', function() {
      client.end();
    });
  }

};

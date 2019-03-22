var uuid   = require('uuid');
var Event  = require('events');
var util   = require('util');
var tout   = require('./timeout.js');
var stream = require('stream');

var SP    = '  ';
var YELLO = '\u001B[92m';
var RED   = '\u001B[91m';
var CR_ED = '\u001B[39m';


module.exports = create_function_proxy;


//
// 创建函数代理, 用于对端调用 (网络/本机集群/不同的接口)
//
// 实现者需要实现 sender, 当需要时被代理调用, 当接收到消息则需要调用代理的 _recv
// 方法来把消息告知代理, 消息最后会被解析成函数调用.
// exports_log : true 打印到处模块日志
//
// Function sender(obj)
//
function create_function_proxy(sender, logger, exports_log) {
  if (!sender)
    throw new Error('sender function not allow null');

  if (!logger)
    logger = console;

  // 消息总线, 所有网络消息都要转发到这里
  var callevent = new Event();
  // key uuid : val module
  var modules = {};
  // key name : val uuid,
  var namemap = {};
  var msg_warn = {};

  callevent._recv   = recv;
  callevent.exports = exports;
  callevent.require = require;
  callevent.send    = send;
  callevent.openWritableStream = openWritableStream;
  callevent.openReadableStream = openReadableStream;

  return callevent;

  //
  // 导出 obj 中所有函数到 name 包, 不支持深层递归
  //
  function exports(name, obj) {
    var replace = !exports_log;
    var id = namemap[name];
    if (id) {
      var _mod = modules[id];
      if (_mod.warp === obj) return;
      logger.debug('Replace exists module', name);
      delete modules[id];
      delete namemap[name];
      replace = true;
    }

    id = uuid.v1();
    namemap[name] = id;
    var mod = modules[id] = {
      modid   : id,
      modname : name,
      fn      : {},
      attr    : {},
      warp    : obj,
    };

    replace || logger.debug(YELLO,'Exports module', name, RED);

    for (var n in obj) {
      var fn = obj[n];
      if (!fn) continue;

      if (fn.constructor === Function) {
        if (fn.length < 1) {
          throw new Error('Function `' + fn.name +
            '` must has callback function at last arg, when exports moddule');
        }
        mod.fn[n] = {
          name   : n,
          fnname : fn.name,
          arglen : fn.length,
          fn     : fn,
        };
        replace ||
          logger.debug(SP, RED, name + '.' + n + '(...)', CR_ED);
      } else {
        mod.attr[n] = {
          name  : n,
          value : fn,
        };
        replace ||
          logger.debug(SP, RED, name + '.' + n, '[', typeof fn, ']', CR_ED);
      }
    }
  }

  //
  // 导出的方法, 引入 name 包
  //
  function require(name, cb) {
    var names;
    if (util.isArray(name)) {
      names = name;
    } else {
      names = [name];
    }

    wait_reply({ type: 'require', names: names }, function(err, datas) {
      if (err) return cb(err);
      var arg = [null]; // arg0 err

      names.forEach(function(name, i) {
        var data = datas[i];
        // 这里试图模拟 nodejs 的 Module 数据结构, 当有必要的时候会扩展
        var exmod = {
          Module : {
            id   : data.modid,
            name : data.modname,
          }
        };
        for (var n in data.attr) {
          var a = data.attr[n];
          exmod[a.name] = a.value;
        }
        for (var n in data.fn) {
          var f = data.fn[n];
          exmod[f.name] = create_remote_function_proxy(f, data);
        }
        arg.push(exmod);
      });

      cb.apply(null, arg);
    });
  }

  //
  // 导出的方法, 向对端发送消息
  //
  function send(name, data) {
    sender({
      'type' : 'message',
      'name' : name,
      'data' : data,
    });
  }


  function openWritableStream(name) {
    var bid = uuid.v1();
    var writer = __createWritableStream(bid);
    wait_reply({
      type : 'read-stream',
      name : name,
      bid  : bid,
    }, function(err) {
      if (err) {
        writer.emit('error', err);
        writer._close();
      }
    });
    return writer;
  }


  function openReadableStream(name) {
    var bid = uuid.v1();
    var reader = __createReadableStream(bid);
    wait_reply({
      type : 'write-stream',
      name : name,
      bid  : bid,
    }, function(err) {
      if (err) {
        reader.emit('error', err);
        reader._close();
      }
    });
    return reader;
  }


  function __createReadableStream(bid) {
    var reader = new stream.Readable();

    reader._read = function(size) {};

    callevent.on(bid, function(obj) {
      switch (obj.event) {
        case 'error':
          reader.emit('error', err);
          break;
        case 'end':
          reader.push(null);
          reader.emit("close");
          break;
        case 'block':
          reader.push(obj.chunk, 'base64');
          break;
      }
    });

    reader.on('close', function() {
      callevent.removeAllListeners(bid);
    });

    reader._close = function() {
      reader.push(null);
      reader.emit("close");
    };

    return reader;
  }


  function __createWritableStream(bid) {
    var writer = new stream.Writable();

    writer._write = function(chunk, encoding, callback) {
      sender({
        type  : 'stream-block',
        bid   : bid,
        event : 'block',
        chunk : chunk.toString('base64'),
      });
      callback();
    };

    writer.on('finish', function() {
      sender({
        type  : 'stream-block',
        bid   : bid,
        event : 'end',
      });
    });

    writer._close = function() {
      writer.end();
      writer.emit('close');
    };

    return writer;
  }


  function create_remote_function_proxy(f, data) {
    return function() {
      if (arguments.length != f.arglen) {
        throw new Error('Function ' + f.name + '(...)'
          + ' must ' + f.arglen + ' parameters, got ' + arguments.length);
      }

      var callback = arguments[f.arglen-1];

      if (typeof callback != 'function') {
        throw new Error('Function ' + f.name + '(...) arg '
          + (f.arglen-1) + ' must a function.');
      }

      for (var i=0; i<f.arglen-1; ++i) {
        if (typeof arguments[i] == 'function') {
          throw new Error('Function ' + f.name + '(...) arg '
            + i + ' cannot allow a function.');
        }
      }

      var arg = [];
      for (var i=0; i<arguments.length-1; ++i) {
        arg[i] = arguments[i];
      }

      wait_reply({
        type   : 'call',
        fname  : f.name,
        modname: data.modname,
        modid  : data.modid,
        arg    : arg,
      }, callback);
    }
  }


  function send_module_to_peer(obj) {
    var names = obj.names;
    var mods  = [];
    for (var i=0; i<names.length; ++i) {
      var id  = namemap[names[i]];
      var mod = modules[id];
      if (!mod) {
        send_reply(obj.id, new Error('module ' + names[i] + ' not found'));
        return;
      }
      mods[i] = mod;
    }
    send_reply(obj.id, null, mods);
  }


  function peer_call_function(obj, context) {
    var mod = modules[obj.modid];
    if (!mod) {
      if (namemap[obj.modname]) {
        send_reply(obj.id, 'module ' + obj.modname
          + ' is upgrade, must require it again');
      } else {
        send_reply(obj.id, 'module ' + obj.modname + ' not exists');
      }
      return;
    }

    var fn = mod.fn[ obj.fname ];
    if (!fn) {
      send_reply(obj.id, 'module ' + obj.modname
          + ' not found function ' + obj.fname);
      return;
    }

    obj.arg.push(_callback);
    if (obj.arg.length != fn.arglen) {
      send_reply(obj.id, 'module ' + obj.modname + ' function ' + obj.fname
        + ' must ' + fn.arglen + ' parameters, got ' + obj.arg.length);
    }

    var returned = false;

    try {
      fn.fn.apply(context, obj.arg);
    } catch(e) {
      _callback(e);
    }

    function _callback(err, data) {
      if (returned) {
        if (!err) {
          err = new Error('module ' + obj.modname
            + ' function ' + obj.fname + ' is returned don`t do it again');
        }
        callevent.emit('error', err);
      } else {
        send_reply(obj.id, err, data);
        returned = true;
      }
    }
  }

  //
  // 这将生成一个请求并等待对端应答, 一旦有应答, cb 会被调用
  // cb : Function(Error, ...), data 作为扩展数据将被发送
  // 使用该函数而不是 callevent.once,
  // data 里应该有 'type' 属性.
  //
  function wait_reply(data, cb) {
    var id = data.id = uuid.v1();
    var tid = 0;

    if (tout.timeout() > 0) {
      tid = setTimeout(function() {
        callevent.removeAllListeners(id);

        var msg = [ 'Tiemout', data.type ];
        switch (data.type) {
          case 'call':
            msg.push('Module', data.modname, 'Function', data.fname);
            msg.push('( Argv_len', data.arg.length, ')');
            break;
          case 'require':
            msg.push('ID', data.id, 'names', data.names);
            break;
          case 'reply':
            msg.push('ID', data.id);
            break;
          default:
            msg.push(data.name);
        }

        cb(new Error(msg.join(' ')));
      }, tout.timeout());
    }

    callevent.once(id, function() {
      clearTimeout(tid);
      cb.apply(null, arguments);
    });

    sender(data);
  }

  //
  // 当一端使用 wait_reply 发出请求, 另一端使用该方法应答
  //
  function send_reply(id, err, data) {
    var sendmsg = {
      'type' : 'reply',
      'id'   : id,
      'err'  : errorObj(err),
      'data' : data,
    };
    sender(sendmsg);
  }

  //
  // 接受到消息则通过该方法传入
  //
  function recv(obj, context) {
    switch(obj.type) {

      // 接收到包请求
      case 'require':
        send_module_to_peer(obj);
        break;

      // 接收到应答, 应答参数: {(id), [err], [data]}
      case 'reply':
        callevent.emit(obj.id, obj.err, obj.data);
        break;

      // 接收到对函数的调用
      case 'call':
        peer_call_function(obj, context);
        break;

      // 接收到单条数据
      case 'message':
        var lc = callevent.emit('msg-' + obj.name, obj.name, obj.data, context);
        if (!(lc || msg_warn[obj.name])) {
          logger.warn('no listener at `msg-' + obj.name + '`');
          msg_warn[obj.name] = 1;
        }
        break;

      case 'stream-block':
        callevent.emit(obj.bid, obj);
        break;

      case 'write-stream':
        var writer = __createWritableStream(obj.bid);
        if (!callevent.emit('write-stream', obj.name, writer)) {
          var err = new Error('peer has not "write-stream" listener');
          send_reply(obj.id, err);
          writer._close();
        } else {
          send_reply(obj.id);
        }
        break;

      case 'read-stream':
        var reader = __createReadableStream(obj.bid);
        if (!callevent.emit('read-stream', obj.name, reader)) {
          var err = new Error('peer has not "read-stream" listener');
          send_reply(obj.id, err);
          reader._close();
        } else {
          send_reply(obj.id);
        }
        break;

      default:
        callevent.emit('error', new Error("unknow message: " + obj.type));
        break;
    }
  }


  function errorObj(err) {
    if (!err) return;
    if (err instanceof Error) {
      err = {
        message : err.message,
        stack   : err.stack && err.stack.split('\n'),
        code    : err.code,
      };
    } else if (typeof err == 'string') {
      err = {
        message : err,
      };
    }
    return err;
  }
}

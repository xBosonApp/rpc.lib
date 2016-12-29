var uuid  = require('uuid');
var Event = require('events');


module.exports = create_function_proxy;


//
// 创建函数代理需要设置发送函数,
// 原理:
//    将对函数的调用变成消息用 sender() 发送出去,
//    当通过 recv() 收到消息, 则变成相应的返回.
//
// Function sender(obj)
//
function create_function_proxy(sender, logger) {
  if (!sender)
    throw new Error('sender function not allow null');

  if (!logger)
    logger = console;

  var callevent = new Event();
  var modules = {};

  callevent.bind = bind;
  callevent.recv = recv;

  return callevent;

  //
  // 绑定公共方法到 obj
  //
  function bind(obj) {
    obj.exports = exports;
    obj.require = require;
  }

  //
  // 导出 obj 中所有函数到 name 包, 不支持深层递归
  //
  function exports(name, obj) {
    var mod = modules[name];
    if (mod) {
      logger.info('exports exists', name);
    } else {
      mod = modules[name] = {};
      logger.info('exports module', name);
    }

    for (var n in obj) {
      var fn = obj[n];
      if (fn && fn.constructor === Function) {
        if (fn.length < 1) {
          throw new Error('must has callback function arg');
        }
        if (mod[n]) {
          logger.info('replease', module + '/' + n);
        } else {
          logger.info('function', module + '/' + n);
        }
        mod[n] = {
          arglen : fn.length,
          name   : fn.name,
        };
      }
    }
  }

  function require(name, cb) {
    var id = uuid.v1();
    sender({
      'type' : 'require',
      'name' : name,
      'id'   : id,
    });
    callevent.on(id, function(err, data) {
      if (err) cb(err);
    });
  }

  function reply_require(obj) {
    var mod = modules[obj.name];
    var ret = {
      'type'  : 'callevent',
      'id'    : obj.id,
      'modid' : uuid.v1(),
    };

    if (!mod) {
      ret.err = 'module ' + obj.name + ' not found';
    } else {
      ret.data = mod;
    }
    sender(ret);
  }

  //
  // 接受到消息则通过该方法传入
  //
  function recv(obj) {
    switch(obj.type) {

      case 'require':
        reply_require(obj);
        break;

      case 'callevent':
        callevent.emit(obj.id, obj.err, obj.data);
        break;

      default:
        callevent.emit('error', new Error("unknow message " + obj.type));
        break;
    }
  }
}

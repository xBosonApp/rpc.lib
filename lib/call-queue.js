module.exports = createCallQueue;

//
// 创建一个动态绑定函数, 当函数被调用但没有实际绑定, 这些调用被记录
// 直到绑定了一个真实函数, 则重放所有的调用.
//
function createCallQueue() {
  var fn;
  var queue = [];
  var obj;

  proxy.bind   = bind;
  proxy.unbind = unbind;

  return proxy;


  function proxy() {
    if (fn) {
      fn.apply(obj, arguments);
    } else {
      queue.push(arguments);
    }
  }

  //
  // 绑定函数, 并重放调用
  //
  function bind(_fn, _object) {
    for (var i=0; i<queue.length; ++i) {
      _fn.apply(_object, queue[i]);
    }
    queue = [];
    fn    = _fn;
    obj   = _object;
  }

  //
  // 解除绑定, 调用会被记录
  //
  function unbind() {
    fn  = null;
    obj = null;
  }
};

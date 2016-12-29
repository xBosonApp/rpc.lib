# 远程过程调用

通讯双方无需配置 ip 即可在局域网中进行远程过程调用

# API

# var rpc = require('rpc.lib');

## rpc.retrydelay(int)

  设置连接不到服务器(没有节点应答时)的重试延迟, 默认 5 秒, 参数单位为 `秒`.
  当尝试连接服务器失败, 则会进行重试, 如果已经连接到服务器时连接丢失, 且没有备用连接,
  也会进行重试, 如果有备用连接则立即切换.

## rpc.timeout(int)

  设置或返回超时, 当一个函数调用超过时间没有返回则会使回调函数超时. 单位 `秒`.
  默认 30 秒.

## rpc.createServer(jpfx, port, name, pass);

  方法返回 Class RpcServer 对象, jpfx 通过 auth.prj 生成的证书数据集;
  name 表示服务节点的名称, 允许一个集群有同名节点.
  pass 如果被设置会使用密钥对对端进行验证. UDP 服务将在 port 上等待广播消息.

## rpc.connect(jpfx, port, name, pass);

  方法返回 Class RpcClient 对象, 尝试连接到 name 节点, 如果有多个同名节点,
  它们都会被连接, 其中一个设置为活动连接, 其他设置为备用连接.
  启动后将会往 UDP port 上发送请求广播.


# Class RpcServer

  服务用于等待客户端连接, 客户端连接后, 即可彼此进行方法调用

## RpcServer Events

### connection : Function(TLSSocket client)

  服务器收到一个客户端连接, 服务端导出的包将被 client 继承.

### error : Function(error)

  服务器发生错误.

## API

  关于导出的方法, 最后一个参数必须是一个回调函数, 回调函数: Function(err, data)
  err 可以是对端发送, 也可以是因为网络出错/超时/参数错误.

### RpcServer.exports(String name, Object obj);

  到出一个包为 name, 导出给对端; obj 中所有方法会被导出, 注意不支持多层级.
  当一段时间后第二次导出相同的包单对象不同, 对端在重新 require 之前仍然使用
  第一次导出的对象, 这会引起对端异常.
  如果导出的函数参数有误, 这个方法将直接抛出异常.

### RpcServer.require(String name, Function ret(Object obj));

  引入对端包, 之后可以通过 obj 直接调用导出方法;

### RpcServer.close()

  关闭所有链接


# Class RpcClient

  客户端一旦与服务器连接, 即可彼此进行方法调用

## RpcClient Events

### connection : Function()

  连接成功则发出这条消息

### error : Function(err)

  客户端发生错误

## API

  这些定义与 RpcServer 中的相同

### RpcClient.exports
### RpcClient.require
### RpcClient.close

# 远程过程调用

通讯双方无需配置 ip 即可在局域网中进行远程过程调用

`npm install rpc.lib --save`


# API

# var rpc = require('rpc.lib')

## rpc.retrydelay(int)

  设置连接不到服务器(没有节点应答时)的重试延迟, 默认 5 秒, 参数单位为 `秒`.
  当尝试连接服务器失败, 则会进行重试, 如果已经连接到服务器时连接丢失, 且没有备用连接,
  也会进行重试, 如果有备用连接则立即切换.

## rpc.timeout(int)

  设置或返回超时, 当一个函数调用超过时间没有返回则会使回调函数超时. 单位 `秒`.
  默认 30 秒.

## rpc.createServer(jpfx, port, name, pass)

  方法返回 Class RpcServer 对象, jpfx 通过 auth.prj 生成的证书数据集;
  name 表示服务节点的名称, 允许一个集群有同名节点.
  pass 如果被设置会使用密钥对对端进行验证. UDP 服务将在 port 上等待广播消息.
  服务端与客户端必须使用相同的 port/name/pass, jpfx 必须是有效的证书.

## rpc.connect(jpfx, port, name, pass)

  方法返回 Class RpcClient 对象, 尝试连接到 name 节点, 如果有多个同名节点,
  它们都会被连接, 其中一个设置为活动连接, 其他设置为备用连接.
  启动后将会往 UDP port 上发送请求广播.


# Class RpcServer

  服务用于等待客户端连接, 客户端连接后, 即可彼此进行方法调用

## Events

### connection : Function(TLSSocket client)

  服务器收到一个客户端连接, 服务端导出的包将被 client 继承.

### error : Function(error)

  服务器发生错误.

### message : Function(name, data)

  由对端发送来的消息, 使用 send 函数

### write-stream : Function(name, stream.Writable writer)

  对端需要读取一些数据发出这个消息, 通过 writer 写入的数据, 将传入对端

### read-stream : Function(name, stream.Readable reader)

  对端需要写入一些数据发出这个消息, 通过 reader 读取对端发送的数据

## API

  关于导出的方法, 回调函数: Function(err, data)
  err 可以是对端发送, 也可以是因为网络出错/超时/参数错误.

导出函数要求:
1. 必须至少有一个参数, 该参数用于返回给调用端数据.
2. 导出函数必须调用回调函数.
3. 引用端调用时参数数量必须匹配.
4. 引用端调用时除了最后一个参数, 其他参数不允许有函数引用.
5. 参数必须是可以 JSON.stringify 的类型, 复杂的类型会丢失数据.
6. 导出端不可以使用 arguments 进行动态参数传递.
7. 导出端使用 return 返回的数据会被忽略.

### RpcServer.exports(String name, Object obj)

  到出一个包为 name, 导出给对端; obj 中所有方法会被导出, 注意不支持多层级.
  当一段时间后第二次导出相同的包但对象不同, 对端在重新 require 之前继续使用
  第一次导出的对象, 这会引起对端异常.
  如果导出的函数参数有误, 这个方法将直接抛出异常.

### RpcServer.require(String name, Function ret(Error err, Object module1))

  引入对端包, 之后可以通过 obj 直接调用导出方法; 出错设置 err, 正确则返回包对象

### RpcServer.require(Array names, Function ret(Error err, Object mod1, Object mod2, ...))

  引入一系列包, 一个包出错, 则会设置 err, 成功则按照 names 的顺序输出包.

### RpcServer.send(String name, Object data)

  向对端发送消息

### RpcServer.close()

  关闭所有链接

### RpcServer.openWritableStream(String name)

  尝试打开一个写入流, name 是流的名字, 当对端收到打开流消息时附带这个名词.
  这会向对端发起 read-stream 消息, 此端写入的数据由对端读取.

### RpcServer.openReadableStream(String name)

  尝试打开一个读取流, 对端会收到一个 write-stream 消息, 对端发送的数据由本端读取.


# Class RpcClient

  客户端一旦与服务器连接, 即可彼此进行方法调用

## Events

  定义与 RpcServer 相同

### connection : Function()
### error : Function(err)
### message : Function(name, msg)
### write-stream : Function(name, stream.Writable writer)
### read-stream : Function(name, stream.Readable reader)

## API

  这些定义与 RpcServer 中的相同

### RpcClient.exports
### RpcClient.require
### RpcClient.send
### RpcClient.close
### RpcClient.openWritableStream(String name)
### RpcClient.openReadableStream(String name)

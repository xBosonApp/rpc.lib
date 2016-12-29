
var send = require('../lib/call-queue.js')();
var c = 0;

function a(n) {
  console.log('a', ++c, n);
}

function b(n) {
  console.log('b', ++c, n);
}

send.bind(a);

send(1);send(2);send(3);

send.unbind();

send(4);send(5);send(6);

send.bind(b);

send.bind(a);
send(7);send(8);send(9);

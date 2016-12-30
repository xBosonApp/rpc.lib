var rpc = require('../');
var fs = require("fs");

rpc.retrydelay(5);
rpc.timeout(3);

var jpserver = JSON.parse(fs.readFileSync(__dirname + '/server.jpfx', 'utf8'));
var jpclient = JSON.parse(fs.readFileSync(__dirname + '/client.jpfx', 'utf8'));
var log = console.log;

var server = rpc.createServer(jpserver, 1000, 'test', 'test');

server.on('error', function(e) {
  console.log('server fail1', e.message);
  process.exit(1);
});

var client = rpc.connect(jpclient, 1000, 'test', 'test');

client.on('error', function(e) {
  console.log('! fail, client fail', e.message);
  process.exit(1);
});


var r = server.openReadableStream('a');
r.on('data', function(d) {
  log('read data', d.toString());
});
r.on("error", function(e) {
  log('read error', e.message);
});
r.on('close', function() {
  log('read close');
});
r.on('end', function() {
  log('read end');
});

var w = server.openWritableStream('big-data');
w.on('error', function(e) {
  log('write big error', e.message);
});
w.on('close', function() {
  log('write big close');
});

var start = Date.now();
var f1 = 'd:/ImageDB.ddf';
var f2 = 'd:/down1/Wireshark-win64-2.2.3.exe';
fs.createReadStream(f2).pipe(w);


client.on('write-stream', function(name, w) {
  log('get write-stream req', name);
  w.write('hi');
  w.write(' im');
  w.write(' client!');
  w.end();
  w.on('close', function() {
    log('peer write close');
  });
});

client.on('read-stream', function(name, r) {
  log('get read-stream req', name);
  r.pipe(fs.createWriteStream(__dirname + '/out'));
  r.on('end', function() {
    log('peer read end', name);
    log(name, 'finish use', Date.now()-start, 'ms');
  });
  r.on('close', function() {
    log('peer read close', name);
  });
});

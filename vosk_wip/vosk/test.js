const websocket = require('ws');
const fs = require('fs');
const ws = new websocket('ws://localhost:2700');

ws.on('open', function open() {
  var readStream = fs.createReadStream('test_16000.wav');
  readStream.on('data', function (chunk) {
      ws.send(chunk);
  });
  readStream.on('end', function () {
      ws.send('{"eof" : 1}');
  });
});

ws.on('message', function incoming(data) {
  console.log(data);
});

ws.on('close', function close() {
  process.exit()
});
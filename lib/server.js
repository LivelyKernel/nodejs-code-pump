var lang = require("lively.lang");
var WebSocketServer = require('websocket').server;
var http = require('http');
var evaluator = require("./evaluator");
var path = require("path");
var scratchModule = path.join(__dirname, "..", "scratch.js")

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// eval websocket interface:

var defaultPort = 9002;
var defaultHost = "0.0.0.0";

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function processMessage(msg, con, server) {
  if (msg.action === "eval") {
    var mod = msg.data.module || scratchModule;
    var code = msg.data.code || "'no code'";
    var result = evaluator.evalIn(mod, code);
    if (result instanceof Error) result = result.stack;
    var printDepth = msg.data.printDepth || 2;
    var answer = {action: "eval-result", id: msg.id, data: {value: result}};
    var answerString;
    try {
      answerString = JSON.stringify(answer);
    } catch (e) {
      answer.data.value = lang.obj.inspect(result, {maxDepth: printDepth})
      answerString = JSON.stringify(answer);
    }
    con.sendUTF(answerString);
    return;
  }

  console.log("message not understood:", msg);
  var answer = JSON.stringify({error: "not understood: " + JSON.stringify(msg)});
  con.sendUTF(JSON.stringify(answer));
}

function makeEvalConnection(server, con) {
  con.on('message', function(message) {
    if (message.type === 'utf8') {
      try {
        var jso = JSON.parse(message.utf8Data);
      } catch (e) {
        var msg = message.utf8Data;
        if (msg.length > 300) msg = msg.slice(0, 300) + "..."
        console.error("Could not read ws message: %s", msg);
        return;
      }
      processMessage(jso, con, server);
    } else if (message.type === 'binary') {
        console.log('Received Binary Message of ' + message.binaryData.length + ' bytes');
    }
  });
  con.on('close', function(reasonCode, description) {
    console.log((new Date()) + ' Peer ' + con.remoteAddress + ' disconnected.');
  });
}

function startServer(options, thenDo) {
  lang.obj.merge({port: defaultPort, host: defaultHost}, options);

  var server = http.createServer(function(request, response) {
    response.writeHead(404);
    response.end();
  });

  server.listen(options.port, function() { thenDo && thenDo(null, serverState); });

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  var wsServer = new WebSocketServer({httpServer: server, autoAcceptConnections: false});
  wsServer.on('request', function(request) {
    var c = request.accept(null, request.origin);
    makeEvalConnection(wsServer, c);
  });

  var serverState = {httpServer: server, wsServer: wsServer};
  return serverState;
}

function closeServer(serverState, thenDo) {
  if (serverState.wsServer) {
    serverState.wsServer.closeAllConnections();
    serverState.wsServer.shutDown();
  }
  if (serverState.httpServer) {
    serverState.httpServer.close(thenDo);
  } else { thenDo && thenDo(); }
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

module.exports = {
  startServer: startServer,
  closeServer: closeServer
}

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

function makeEvalConnection(msger, con) {
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
      if (jso.sender) con.id = jso.sender;
      msger.onMessage(jso);
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

  var msger = lang.messenger.create({

    send: function(msg, onSendDone) {
      var target = lang.arr.detect(this.serverState.wsServer.connections, function(c) {
        return c.id === msg.target;
      });
      if (!target) return onSendDone(new Error("Cannot find target"));
      if (typeof msg !== "string") msg = JSON.stringify(msg);
      target.sendUTF(msg);
      onSendDone();
    },

    listen: function(thenDo) {
      if (this.isOnline() || !this.autoRestart) return thenDo();

      if (!this.serverState) {

        var httpServer = http.createServer(function(request, response) {
          response.writeHead(404);
          response.end();
        });

        httpServer.once("close", function() { msger.autoRestart && msger.reconnect(); });

        var wsServer = new WebSocketServer({httpServer: httpServer, autoAcceptConnections: false});
        wsServer.on('request', function(request) {
          var c = request.accept(null, request.origin);
          makeEvalConnection(msger, c);
        });
        this.serverState = {httpServer: httpServer, wsServer: wsServer};
      }

      this.serverState.httpServer.listen(options.port, thenDo);
    },

    close: function(thenDo) {
      if (this.serverState) closeServer(this.serverState, thenDo);
      else thenDo();
    },

    isOnline: function() { return this.serverState && this.serverState.httpServer; }
  });

  msger.addServices({

    "eval": function(msg, msger) {
      var mod = msg.data.module || scratchModule,
          code = msg.data.code || "'no code'",
          result = evaluator.evalIn(mod, code);
      if (result instanceof Error) result = result.stack;
      try {
        JSON.stringify(result);
      } catch (e) {
        var printDepth = msg.data.printDepth || 2;
        result = lang.obj.inspect(result, {maxDepth: printDepth})
      }
      msger.answer(msg, {value: result});
    },

    "statusFor": function(msg, msger) {
      evaluator.statusForPrinted(msg.data.module, msg.data.options,
        (err, result) => msger.answer(msg, result));
    },

    "status": function(msg, msger) {
      evaluator.status((err, envs) => msger.answer(msg, envs));
    }

  });

  msger.autoRestart = true;
  msger.listen(err => thenDo(err, msger));

  return msger;
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

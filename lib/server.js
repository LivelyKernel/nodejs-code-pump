/*global require, __dirname*/

var lang = require("lively.lang");
var WebSocketServer = require('websocket').server;
var http = require('http');
var evaluator = require("./evaluator");
var path = require("path");
var fsService = require("./fs-services");
var internal = require("./nodejs/internal");
var completions = require("./completions");

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

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // vm-like services

    "eval": function(msg, msger) {
      evaluator.evalInAndPrint(
        msg.data.code, msg.data.module,
        options = msg.data.options || {},
        (err, result) => msger.answer(msg, {value: result}));
    },

    "completions": function(msg, msger) {
        try {
          completions.getCompletions(
            code => evaluator.evalIn(msg.data.module, code, {}),
            msg.data.prefix,
            (err, completions, startLetters) =>
              msger.answer(msg, err ?
                {error: err.stack || String(err)} :
                {completions: completions, prefix: startLetters}));
        } catch (err) {
          msger.answer(msg, {error: err.stack || String(err)});
        }
    },

    "statusFor": function(msg, msger) {
      evaluator.statusForPrinted(msg.data.module, msg.data.options,
        (err, result) => msger.answer(msg, result));
    },

    "status": function(msg, msger) {
      evaluator.status((err, envs) => msger.answer(msg, envs));
    },

    "reload": function(msg, msger) {
      require("module").Module._cache
      var paths = msg.data.modules, err;
      try {
        paths.forEach(p => delete require.cache[p]);
        paths.forEach(p => require(p));
        // var Module = require("module").Module;
        // paths.forEach(p => { var m = new Module(p, module); m.load(p); });
      } catch (e) { err = e; }
      msger.answer(msg, err ? {error: String(err.stack)} : {status: "OK"});
    },

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // file system stuff

    "findJSFiles": function(msg, msger) {
      fsService.findJSFiles(msg.data.dir || process.cwd(), (err, files) => {
        msger.answer(msg, err ? {error: String(err.stack)} : {files: files});
      });
    },

    "findModulesAndFiles": function(msg, msger) {
      var dir = msg.data.dir || process.cwd();
      lang.fun.waitForAll([
        n => evaluator.status(n),
        n => fsService.findJSFiles(dir, n),
        n => internal.findLoadedModules({dir: dir}, n)
      ], (err, result) => {
        result = lang.arr.flatten(result, 1);
        var evaluatorStatus = result[0],
            files = result[1] || [],
            filePaths = lang.arr.pluck(files, "path"),
            modules = result[2].filter(m => filePaths.indexOf(m.id) === -1),
            result = [];
        files.forEach(f => result.push(lang.obj.merge(f, {local: true, instrumented: evaluatorStatus[f.path] && evaluatorStatus[f.path].customCompiled})));
        modules.forEach(m => result.push(lang.obj.merge(m, {local: false, instrumented: evaluatorStatus[m.id] && evaluatorStatus[m.id].customCompiled})));
        msger.answer(msg, err ? {error: String(err.stack)} : result);
      });
    },

    "readFile": function(msg, msger) {
      fsService.readFile(msg.data.file, (err, content) => {
        msger.answer(msg, err ? {error: String(err.stack)} : {content: content});
      });
    },

    "writeFile": function(msg, msger) {
      fsService.writeFile(msg.data.file, msg.data.content, err => {
        msger.answer(msg, err ? {error: String(err.stack)} : {status: "OK"});
      });
    },

    "deleteFile": function(msg, msger) {
      fsService.deleteFile(msg.data.file, err => {
        msger.answer(msg, err ? {error: String(err.stack)} : {status: "OK"});
      });
    },

    "cwd": function(msg, msger) {
      fsService.cwd((err, cwd) => {
        msger.answer(msg, err ? {error: String(err.stack)} : {cwd: cwd});
      });
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

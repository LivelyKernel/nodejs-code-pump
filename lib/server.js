/*global require, __dirname*/

var lang = require("lively.lang");
var WebSocketServer = require('websocket').server;
var http = require('http');
var path = require("path");
var fsService = require("./fs-services");
var internal = require("./nodejs/internal");
var vm = require("lively.vm");
var commonjsEvaluator = vm.cjs;
var completions = vm.completions;

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

function stripUnsendableData(evalResult, options) {
  if (evalResult && evalResult.promisedValue) delete evalResult.promisedValue;
  return evalResult;
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
      var timeout = msg.data.hasOwnProperty("timeout") ? msg.data.timeout : 3000/*ms*/,
          timed = timeout ? lang.promise.timeout.bind(null, timeout) : Promise.resolve;

      timed(commonjsEvaluator
        .runEval(msg.data.code, lang.obj.merge({targetModule: msg.data.targetModule}, msg.data.options)))
        .then(stripUnsendableData)
        .then(result => msger.answer(msg, result))
        .catch(err => {
          console.error("error in code-pump eval service: %s", err.stack || err);
          msger.answer(msg, {error: err.stack || String(err)});
        });
    },

    "completions": function(msg, msger) {
      var timeout = msg.data.hasOwnProperty("timeout") ? msg.data.timeout : 3000/*ms*/,
          timed = timeout ? lang.promise.timeout.bind(null, timeout) : Promise.resolve;
      completions.getCompletions(
        code => timed(commonjsEvaluator.runEval(code, {targetModule: msg.data.targetModule})),
        msg.data.prefix)
          .then(result => msger.answer(msg, {completions: result.completions, prefix: result.startLetters}))
          .catch(err => msger.answer(msg, {error: err.stack || String(err)}));
    },

    "statusFor": function(msg, msger) {
      commonjsEvaluator.statusForPrinted(msg.data.module, msg.data.options,
        (err, result) => msger.answer(msg, result));
    },

    "status": function(msg, msger) {
      commonjsEvaluator.status((err, envs) => msger.answer(msg, envs));
    },

    "reload": function(msg, msger) {
      Promise.resolve().then(() => {
        var paths = msg.data.modules, err;
        paths.forEach(ea => commonjsEvaluator.forgetModule(ea));
        paths.forEach(ea => require(ea));
        return {status: "OK"};
      })
      .catch(err => {error: String(err.stack)})
      .then(answer => msger.answer(msg, answer))
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
        n => commonjsEvaluator.status(n),
        n => fsService.findJSFiles(dir, n),
        n => internal.findLoadedModules({dir: dir}, n)
      ], (err, result) => {
        result = lang.arr.flatten(result, 1);
        var evaluatorStatus = result[0],
            files = result[1] || [],
            filePaths = lang.arr.pluck(files, "path"),
            modules = result[2].filter(m => filePaths.indexOf(m.id) === -1),
            result = [];
        files.forEach(f => result.push(lang.obj.merge(f, {format: "cjs", local: true, instrumented: evaluatorStatus[f.path] && evaluatorStatus[f.path].customCompiled, loaded: !!require.cache[f.path]})));
        modules.forEach(m => result.push(lang.obj.merge(m, {format: "cjs", local: false, instrumented: evaluatorStatus[m.id] && evaluatorStatus[m.id].customCompiled, loaded: !!require.cache[m.id]})));
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

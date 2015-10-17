/*global require, process*/

var evaluator = require("./evaluator");
var lang = require("lively.lang");
var path = require("path");

// var log = msg => process.send({type: "log", message: String(msg)});

var setup = false;

var msger = lang.messenger.create({
  send: function(msg, onSendDone) {
    process.send(JSON.stringify(msg));
    onSendDone();
  },
  listen: function(thenDo) {
    if (setup) return thenDo();
    setup = true;
    evaluator.wrapModuleLoad();
    process.on("message", m => msger.onMessage(JSON.parse(m)));
  },
  close: function(thenDo) { process.exit(); thenDo(); },
  isOnline: function() { return true; }
});

var scratchModule = path.join(__dirname, "..", "scratch.js");

msger.addServices({

  "eval": function(msg, msger) {
    var mod = msg.data.module || scratchModule;
    var code = msg.data.code || "'no code'";
    var result = evaluator.evalIn(mod, code);
    if (result instanceof Error) result = result.stack;
    var data = {value: result};
    try {
      JSON.stringify(data);
    } catch (e) {
      var printDepth = msg.data.printDepth || 2;
      data.value = lang.obj.inspect(result, {maxDepth: printDepth})
    }
    msger.answer(msg, data);
  },

  "modules-and-state-query": function(msg, msger) {
    msger.answer(msg, "not yet!");
    // var envs = loadedModules;
    // answer = {
    //   type: "modules-and-state-query-result",
    //   loadedModules: Object.keys(envs).reduce((result, fn) => {
    //     var env = envs[fn];
    //     result[fn] = {
    //       isLoaded: env.isLoaded,
    //       loadError: env.loadError ? String(env.loadError) : undefined,
    //       capturedVariables: Object.keys(env.recorder)
    //     }
    //     return result;
    //   }, {})
    // };
  },
});

module.exports = msger;
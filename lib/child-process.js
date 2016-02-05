/*global require, process*/

var commonjsEvaluator = require("lively.vm").cjs;
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
    commonjsEvaluator.wrapModuleLoad();
    process.on("message", m => msger.onMessage(JSON.parse(m)));
  },
  close: function(thenDo) { process.exit(); thenDo(); },
  isOnline: function() { return true; }
});

var scratchModule = path.join(__dirname, "..", "scratch.js");

msger.addServices({

  "eval": function(msg, msger) {
    commonjsEvaluator
      .evalInAndPrint(
        msg.data.code || "'no code'",
        msg.data.module || scratchModule,
        msg.data.options || {})
      .then(result => msger.answer(msg, {value: result}))
      .catch(err => msger.answer(msg, {error: err.stack || String(err)}));;
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
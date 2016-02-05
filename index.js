/*global process, require*/

var commonJsEvaluator = require("lively.vm").cjs;
var server = require("./lib/server");
var messenger;

function start(host, port, thenDo) {
  if (messenger && messenger.serverState)
    return thenDo && thenDo(null, messenger);
  port = port || 9010;
  host = host || "0.0.0.0";
  commonJsEvaluator.wrapModuleLoad()
  server.startServer({host: host, port: port}, (err, msger) => {
    err && console.error(err);
    messenger = msger;
    msger && process.on("close", () => msger.close());
    thenDo && thenDo(err, msger);
  });
}

function stop(thenDo) {
  if (!messenger || !messenger.serverState) return thenDo();
  server.closeServer(messenger.serverState, err => {
    messenger = null;
    thenDo && thenDo(err);
  });
}

module.exports = {
  start: start,
  stop: stop,
  get messenger() { return messenger; },
  evaluator: commonJsEvaluator,
  process: require("./lib/process")
}
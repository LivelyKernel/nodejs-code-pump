/*global process, require*/

var evaluator = require("./lib/evaluator");
var server = require("./lib/server");

function start(host, port, thenDo) {
  port = port || 9010;
  host = host || "0.0.0.0";
  evaluator.wrapModuleLoad()
  server.startServer({host: host, port: port}, (err, msger) => {
    err && console.error(err);
    msger && process.on("close", () => msger.close());
    thenDo && thenDo(err, msger);
  });
}

module.exports = start;
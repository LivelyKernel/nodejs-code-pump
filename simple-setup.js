var evaluator = require("./lib/evaluator");
var server = require("./lib/server");

evaluator.wrapModuleLoad()

var port = 9010;
var serverMsger = null;

server.startServer({port: port}, (err, s) => serverMsger = err || s);

process.on("close", () => serverMsger.close());

// evaluator.evalIn("util", "exports", {})
// require.cache["/Users/robert/Lively/lively-davfs/VersionedFileSystem.js"]
// evaluator.evalIn("/Users/robert/Lively/LivelyKernel2/node_modules/life_star", "exports", {})
// evaluator.evalIn("/Users/robert/Lively/lively-davfs/VersionedFileSystem.js", "exports", {})
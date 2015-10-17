const util = require('util');
const EventEmitter = require('events');
var lang = require("lively.lang");
var fmt = lang.string.format;
var fun = lang.fun;
var uuid = require('node-uuid');
var fork = require("child_process").fork;
// var temp = require("temp").track();
var temp = require("temp");
var fs = require("fs");
var path = require("path");
var callsite = require("callsite");

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function ProcessData(opts) {
  EventEmitter.call(this);
  lang.obj.extend(this, opts);
};
util.inherits(ProcessData, EventEmitter);

lang.obj.extend(ProcessData.prototype, {
  isWorkspace: false,
  running: false,
  instrumented: false,
  logFile: null,
  id:      null,
  process: null,
  
  readLogSync: function() { return this.logFile ? fs.readFileSync(this.logFile).toString() : ""; },
  readLog: function(dofunc) { return this.logFile ? fs.readFile(this.logFile, dofunc) : dofunc(null,null); },
  
  onProcessMessage: function(m) {
    // console.log(m);
    if (m.type === "eval-result") {
      this.emit("eval-result", m);
      if (m.id) this.emit("eval-result-" + m.id, m);
    }
    if (m.type === "modules-and-state-query-result") {
      this.emit("modules-and-state-query-result", m);
    }
    if (m.type === "evaluator-state") {
      if (m.hasOwnProperty("instrumented")) this.instrumented = m.instrumented;
    }
    if (m.type === "log") {
      console.log(m.message);
    }
  },

  onProcessError: function(err) {
    console.error("Process of eval handler %s errored", this.id);
    console.error(err);
  },

  onProcessExit: function (code, signal) {
    // console.log('Child exited:', code, signal);
    this.running = false;
  },

  fetchModulesAndState: function(thenDo) {
    thenDo = lang.fun.once(thenDo);
    this.process.send({type: "modules-and-state-query"}, err => err && thenDo(err));
    this.once("modules-and-state-query-result", result => thenDo(null, result));
  },

  sendEval: function(code, thenDo) {
    thenDo = lang.fun.once(thenDo);
    if (!this.isWorkspace) return thenDo(new Error("Process not setup as workspace"));
    if (!this.running) return thenDo(new Error("process not running"));
    var id = uuid.v4();
    this.process.send({id: id, type: "eval", code: code}, err => err && thenDo(err));
    this.once("eval-result-" + id, result => thenDo(null, result));
  },

  stop: function(thenDo) {
    if (!this.running) thenDo && thenDo(null);
    this.process.once("close", function() { thenDo && thenDo(null); });
    this.process.kill();
  },
});



// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

var workspaceTemplate = `
process.send({type: "internal", message: "started"});
var evaluater = require("%s/evaluator");
evaluater.setupAsChildProcess();
%s
`;

function runNode(code, args, options, thenDo) {
  var id = 'nodejs-live-eval-' + uuid.v4();
  if (typeof args === "function") { thenDo = args; args = null, options = null; }
  if (typeof options === "function") { thenDo = options; options = null; }

  args = args || [];
  options = lang.obj.merge({logToFile: true, silent: true, cwd: __dirname}, options);
  var tfmedCode = options.isWorkspace ? fmt(workspaceTemplate, __dirname, code) : code;
  var proc, procData;

  fun.composeAsync(
    withJsTempFileDo.bind(null, id, ".js", tfmedCode),
    function(path, n) {
      proc = fork(path, args, options);
      procData = new ProcessData({running: true, id: id, process: proc, isWorkspace: options.isWorkspace});
      proc.on('exit', (code, signal) => procData.onProcessExit(code, signal));
      proc.on("message", (m) => procData.onProcessMessage(m));
      proc.on("error", (err) => procData.onProcessError(err));
      if (!proc.stdout || !options.logToFile) return n(null, null);
      if (typeof options.logToFile === "string") n(null, options.logToFile);
      else withJsTempFileDo("xxx", ".log", "foo", n);
    },
    function(logFile, n) {
      if (logFile) {
        var logStream = fs.createWriteStream(logFile);
        proc.stdout.pipe(logStream);
        proc.stderr.pipe(logStream);
        proc.stdout.on("data", (d) => console.log(String(d)));
        proc.stderr.on("data", (d) => console.log(String(d)));
        procData.logFile = logFile;
      }
      n(null, procData);
    }
  )(thenDo);
}

function runNodeOn(jsFile, args, options, thenDo) {
  if (!path.isAbsolute(jsFile)) {
    // FIXME!!!
    var frames = callsite();
    var frame = frames[1];
    if (!frame.getTypeName()) frame = frames[2];
    var dir = path.dirname(frame.getFileName());
    if (dir === ".")  dir = __dirname;
    jsFile = path.join(dir, jsFile);
  }
  runNode(fmt("require('%s')", jsFile), args, options, thenDo);
}

function withJsTempFileDo(prefix, suffix, content, doFunc) {
  lang.fun.composeAsync(
    n => temp.open({prefix: prefix || 'nodejs-live-eval', suffix: suffix || ".js"}, n),
    (info, n) => fs.writeFile(info.path, content, err => n(err, info.path))
  )(doFunc);
}


module.exports = {
  runNode: runNode,
  runNodeOn: runNodeOn
}

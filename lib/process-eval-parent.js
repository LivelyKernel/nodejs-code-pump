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
var cjs = require("lively.vm").cjs;



// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function runNode(code, args, options, thenDo) {
  if (typeof args === "function") { thenDo = args; args = null, options = null; }
  if (typeof options === "function") { thenDo = options; options = null; }

  args = args || [];
  options = lang.obj.merge({logToFile: true, silent: true, cwd: process.cwd()}, options);
  var id = options.id || 'nodejs-live-eval-' + uuid.v4();
  var proc;

  fun.composeAsync(
    withJsTempFileDo.bind(null, id, ".js", code),
    function(path, n) {
      proc = fork(path, args, options);
      if (!proc.stdout || !options.logToFile) return n(null, null);
      if (typeof options.logToFile === "string") n(null, options.logToFile);
      else withJsTempFileDo(id, ".log", "", n);
    },
    function(logFile, n) {
      if (logFile) {
        var logStream = fs.createWriteStream(logFile);
        proc.stdout.pipe(logStream);
        proc.stderr.pipe(logStream);
        proc.stdout.on("data", d => console.log(String(d)));
        proc.stderr.on("data", d => console.log(String(d)));
        proc.logFile = logFile;
        proc.id = id;
      }
      n(null, proc);
    }
  )(thenDo);
}

function runNodeOn(jsFile, args, options, thenDo) {
  jsFile = cjs.resolve(jsFile);
  runNode(fmt("require('%s')", jsFile), args, options, thenDo);
}

function withJsTempFileDo(prefix, suffix, content, doFunc) {
  lang.fun.composeAsync(
    n => temp.open({prefix: prefix || 'nodejs-live-eval', suffix: suffix || ".js"}, n),
    (info, n) => fs.writeFile(info.path, content, err => n(err, info.path))
  )(doFunc);
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      // proc.on('exit', (code, signal) => procData.onProcessExit(code, signal));
      // proc.on("message", (m) => procData.onProcessMessage(m));
      // proc.on("error", (err) => procData.onProcessError(err));

function createNodejsProcess(options) {
  options = lang.obj.merge({code: ""}, options);

  var proc;
  var msger = lang.messenger.create({
    send: function(msg, onSendDone) {
      proc && proc.send(JSON.stringify(msg));
      onSendDone(proc ? null : new Error("no process"));
    },
    listen: function(thenDo) {
      if (proc) return thenDo();
      if (options.module) runNodeOn(options.module, [], options, cb)
      else runNode(options.code, [], options, cb);
      function cb(err, p) {
        proc = p;
        proc.once("close", () => msger.close());
        proc.on("message", (m) => msger.onMessage(JSON.parse(m)));
        thenDo(err);
      }
    },
    close: function(thenDo) {
      if (!msger.isOnline()) return thenDo && thenDo();
      proc && proc.kill();
      lang.fun.waitFor(() => !msger.isOnline(), thenDo);
    },
    isOnline: function() { return proc && proc.connected; }
  });

  // msger.on("message", function(msg) {
  //   console.log("parent process got message", msg);
  // })

  lang.obj.extend(msger, {
    readLogSync: function() { return proc.logFile ? fs.readFileSync(proc.logFile).toString() : ""; },
    readLog: function(dofunc) { return proc.logFile ? fs.readFile(proc.logFile, dofunc) : dofunc(null,null); },
  });

  return msger;
}

function startNodejsProcess(options, thenDo) {
  var msger = createNodejsProcess(options);
  msger.listen(err => thenDo && thenDo(err, msger));
  return msger;
}

var workspaceTemplate = `
var procMsger = require("%s/process-eval-child");
procMsger.parentId = "%s";
procMsger._id = "%s";
procMsger.listen();
procMsger.sendTo(procMsger.parentId, "child-process-status", {status: "started"});
`;

function startNodejsWorkspace(options, thenDo) {
  options = lang.obj.merge({id: 'nodejs-live-eval-parent-' + uuid.v4()}, options);
  var childId = options.id.replace(/-parent/, "-child");

  options.code = fmt(workspaceTemplate, __dirname, options.id, childId);
  var msger = startNodejsProcess(options, thenDo);

  msger.childId = childId;
  msger.sendToChild = function(action, data, thenDo) {
    msger.sendTo(msger.childId, action, data, thenDo);
  };

  msger.addServices({
    "child-process-status": function(msg, msger) {
      console.log("chldprocess status:", msg.data.status);
      msger.answer(msg, "OK");
    }
  })
  return msger;
}

module.exports = {
  startNodejsProcess: startNodejsProcess,
  startNodejsWorkspace: startNodejsWorkspace
}

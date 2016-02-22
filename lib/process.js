var fs = require("fs");
var fork = require("child_process").fork;
var uuid = require('node-uuid');

// var temp = require("temp").track();
var temp = require("temp");

var vm = require("lively.vm");
var lang = require("lively.lang");

function runNode(code, args, options, thenDo) {
  if (typeof args === "function") { thenDo = args; args = null, options = null; }
  if (typeof options === "function") { thenDo = options; options = null; }

  args = args || [];
  options = lang.obj.merge({codeFile: null, logToFile: true, silent: true, cwd: process.cwd()}, options);
  var id = options.id || 'nodejs-live-eval-' + uuid.v4();
  var proc;

  // return withJsTempFileDo(id, ".js", code)
  return (options.codeFile ?
           Promise.resolve(options.codeFile) :
           withJsTempFileDo(id, ".js", ""))
    .then(file => lang.promise(fs.writeFile)(file, code)
      .then(() => { setTimeout(() => fs.unlink(file), 400); return file; }))
    .then(path => {
      proc = fork(path, args, options);
      if (!proc.stdout || !options.logToFile) return null;
      if (typeof options.logToFile === "string") return options.logToFile;
      return withJsTempFileDo(id, ".log", "");
    })
    .then(logFile => {
      if (logFile) {
        var logStream = fs.createWriteStream(logFile);
        proc.stdout.pipe(logStream);
        proc.stderr.pipe(logStream);
        proc.stdout.on("data", d => console.log(String(d)));
        proc.stderr.on("data", d => console.log(String(d)));
        proc.logFile = logFile;
        proc.id = id;
      }
      return proc
    })
}

function runNodeOn(jsFile, args, options, thenDo) {
  jsFile = vm.cjs.resolve(jsFile);
  runNode(lang.string.format("require('%s')", jsFile), args, options, thenDo);
}

function withJsTempFileDo(prefix, suffix, content) {
  return lang.promise(temp.open)({prefix: prefix || 'code-pump', suffix: suffix || ".js"})
    .then(info => {
      lang.promise(fs.writeFile)(info.path, content)
      return info.path;
    });
}

exports.runNode = runNode;
exports.runNodeOn = runNodeOn;

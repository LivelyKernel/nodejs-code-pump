#!/usr/bin/env node

/*
  Usage
  ./bin/code-pump.js --host 0.0.0.0 --port 9010
*/

var fs = require("fs"),
    lang = require("lively.lang"),
    proc = require("../lib/process"),
    args = process.argv.slice(2);

if (args.indexOf("--help") > -1 || args.indexOf("-h") > -1) {
  printUsage();
  process.exit(0);
}

var useSubProc = args.indexOf("--no-subprocess") === -1,
    port = args.indexOf("--port") > -1 ? Number(args[args.indexOf("--port")+1]) : 9010,
    host = args.indexOf("--host") > -1 ? Number(args[args.indexOf("--host")+1]) : "0.0.0.0",
    currentProcess,
    startFile = "./code-pump-start.js";

if (useSubProc) startSubProcess();
else {
  require("../index").start(host, port, function(err) {
    if (err) console.error("[code-pump process] error:" + err);
    console.log("[code-pump process] started on %s:%s", host, port);
  });
} 


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// helpers

function startSubProcess(options) {
  options = lang.obj.merge({
    host: "0.0.0.0",
    port: 9010,
    codeFile: startFile,
    logToFile: "./code-pump.log",
    autoRestart: true
  }, options);

  var initCode = `
var host = "${options.host}",
    port = ${options.port},
    path = require("path");

require(path.join("${__dirname}", "../index.js")).start(host, port, function(err) {
  if (err) console.error("Code pump error:" + err);
  console.log("code-pump started on %s:%s", host, port);
});`;

  currentProcess = proc.runNode(initCode, [], options)
    .then(proc => {
      proc.on("message", (m) => {
        console.log("[code-pump parent process] got message %s", m);
        if (m === "restart") stopSubProcess();
      });
      proc.on("exit", () => {
        if (options.autoRestart) {
          startSubProcess(options)
          console.log("[code-pump parent process] restarting")
        } else {
          console.log("[code-pump parent process] exited")
        }
      });
      console.log("[code-pump parent process] code pump process started")
      return proc;
    })
}

function stopSubProcess() {
  return !currentProcess ?
    Promise.resolve() :
    currentProcess.then((proc) => {
      return new Promise((resolve, reject) => {
        var i = setInterval(() =>  proc.kill("SIGKILL"), 100);
        proc.on("exit", () => { clearInterval(i); resolve(); });
      })
    })
    .then(() => console.log("[code-pump parent process] stop -> closed"))
    .catch(console.error());
}

function printUsage() {
  var usage = `code-pump usage:
-h  --help            print this message
    --port            port to listen for connections, default 9010
    --port            host to listen for connections, default 0.0.0.0
    --no-subprocess   don't start the actual loader / evaluator in a subprocess
`
  console.log(usage);
}

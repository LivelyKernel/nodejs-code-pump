/*global process, require, global*/

var path = require("path");
var lang = require("lively.lang");
var exec = require("child_process").exec;
var fmt = lang.string.format;

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


function findJSFiles(dir, thenDo) {
  var files, err;
  
  if (!path.isAbsolute(dir)) dir = path.resolve(dir, process.cwd());
  
  var cmdString = 'find ' + dir + ' -type f -iname "*.js" -not -path "*/node_modules/*"';

  exec(cmdString, function(err, out) {
    var files = out.split("\n")
      .filter(line => !!line.trim())
      .map(line => path.relative(dir, line));
    thenDo(err, files);
  })

  // glob("!(node_modules)**/*.js", {cwd: dir},
  //   (_err, _files) => { err = _err; files = _files; });
  // // glob freezes when error in its callback is thrown... safeguard
  // lang.fun.waitFor(() => !!files, () => { thenDo(err, files); });
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

module.exports = {
  findJSFiles: findJSFiles
}

/*global process, require, global*/

var path = require("path");
var lang = require("lively.lang");
var exec = require("child_process").exec;
var fmt = lang.string.format;
var fs = require("fs");

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function findJSFiles(dir, thenDo) {
  var files, err;
  
  if (!path.isAbsolute(dir)) dir = path.resolve(dir, process.cwd());
  
  var cmdString = `find ${dir} -type f -iname "*.js" -not -path "*/node_modules/*" -not -path "*/jspm_packages/*"`;

  exec(cmdString, function(err, out) {
    var files = out.split("\n")
      .filter(line => !!line.trim())
      .map(line => ({fileName: path.relative(dir, line), path: line.trim()}));
    thenDo(err, files);
  })

  // glob("!(node_modules)**/*.js", {cwd: dir},
  //   (_err, _files) => { err = _err; files = _files; });
  // // glob freezes when error in its callback is thrown... safeguard
  // lang.fun.waitFor(() => !!files, () => { thenDo(err, files); });
}

function cwd(thenDo) {
  thenDo(null, process.cwd());
}

function readFile(file, thenDo) {
  fs.readFile(file, (err, content) => thenDo(err, String(content)));
}

function writeFile(fileName, content, thenDo) {
  fileName = path.resolve(fileName);

  if (!path.isAbsolute(fileName)) {
    fileName = path.join(process.cwd(), fileName);
  }
  var dirs = [], dir = fileName, length = dirs.length;
  do {
    dir = path.dirname(dir)
    if (dirs.indexOf(dir) === -1) dirs.push(dir)
  } while (length++ < dirs.length)
  
  dirs.reverse().forEach(function(dir) {
    if (!fs.existsSync(dir)) fs.mkdir(dir);
  });
  
  fs.writeFile(fileName, content, thenDo);
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

module.exports = {
  findJSFiles: findJSFiles,
  readFile: readFile,
  writeFile: writeFile,
  removeFile: fs.unlink,
  cwd: cwd
}

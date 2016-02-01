var Module = require("module").Module;
var lang = require("lively.lang");
var path = require("path");

function loadedModules() {
  return Object.keys(Module._cache);
}

function findLoadedModules(options, thenDo) {
  lang.obj.merge({dir: process.cwd()}, options);
  thenDo(null, loadedModules().map(file => ({
    id: file, fileName: path.relative(options.dir, file)
  })));
}

module.exports = {
  loadedModules: loadedModules,
  findLoadedModules: findLoadedModules
}

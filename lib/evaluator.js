/*global process, require, global*/

var Module = require("module").Module;
var vm = require("lively.vm");
var uuid = require("node-uuid");
var path = require("path");
var lang = require("lively.lang");
var helper = require("./helper");

// maps filenames to envs = {isLoaded: BOOL, loadError: ERROR, recorder: OBJECT}
var loadedModules = {};
var originalCompile = null;
var exceptions = [module.filename];

function isLoaded(fileName) {
  return require.cache[fileName] && fileName in loadedModules;
}

function ensureEnv(fullName) {
  return loadedModules[fullName]
    || (loadedModules[fullName] = {
      loadError: undefined,
      isLoaded: false,
      recorderName: "eval_rec_" + path.basename(fullName).replace(/[^a-z]/gi, "_"),
      recorder: {}
    });
}

function ensureRecorder(fullName) {
  return ensureEnv(fullName).recorder;
}

function customCompile(content, filename) {
  // wraps Module.prototype._compile to capture top-level module definitions
  if (exceptions.indexOf(filename) > -1 || isLoaded(filename))
    return originalCompile.call(this, content, filename);

  // if cache was cleared also reset our recorded state
  if (!require.cache[filename] && loadedModules[filename])
    delete loadedModules[filename];

  var env = ensureEnv(filename),
      magicVars = ["exports", "require", "module", "__filename", "__dirname"],
      tfmOptions = {
        topLevelVarRecorder: env.recorder,
        varRecorderName: env.recorderName,
        dontTransform: [env.recorderName, "global"].concat(magicVars)
      },
      header = "var " + env.recorderName + " = global." + env.recorderName + ";\n",
      header = header + magicVars.map(varName => {
        return env.recorderName + "." + varName + "=" + varName + ";"; }).join("\n"),
      tfmedContent;
      
  try {
    tfmedContent = (header + "\n" + vm.evalCodeTransform(content, tfmOptions));
  } catch (e) {
    console.warn("Cannot compile module %s:", filename, e);
    return originalCompile.call(this, content, filename);
  }

  global[env.recorderName] = env.recorder;

  try {
    var result = originalCompile.call(this, tfmedContent, filename);
    env.loadError = undefined;
    return result;
  } catch (e) {
    env.loadError = e; throw e;
  } finally {
    delete global[env.recorderName];
    env.isLoaded = true;
  }
}

function wrapModuleLoad() {
  if (!originalCompile)
    originalCompile = Module.prototype._compile;
  Module.prototype._compile = customCompile;
}

function envFor(moduleName) {
  // var fullName = require.resolve(moduleName);
  var fullName = helper.resolveFileName(moduleName);
  return ensureEnv(fullName);
}

function evalIn(moduleName, code, options) {
  var fullName = helper.resolveFileName(moduleName);
  if (!require.cache[fullName]) {
    try {
      require(fullName);
    } catch (e) {
      return new Error("Cannot find module " + moduleName + " (tried as " + fullName + ")");
    }
  }
  var m = require.cache[fullName];
  var env = envFor(fullName);
  env.recorder.__filename = m.filename;
  var dirname = env.recorder.__dirname = path.dirname(m.filename);
  env.recorder.require = function(fname) {
    if (!path.isAbsolute(fname))
      fname = path.join(dirname, fname);
    return Module._load(fname, m);
  };
  env.recorder.exports = m.exports;
  env.recorder.module = m;
  code = "var " + env.recorderName + " = global." + env.recorderName + ";\n" + code;
  global[env.recorderName] = env.recorder;
  var result =  vm.syncEval(code, {
    dontTransform: [env.recorderName, "global"],
    varRecorderName: env.recorderName,
    topLevelVarRecorder: env.recorder,
    sourceURL: moduleName,
    context: env.recorder.exports || {}
  });
  
  delete global[env.recorderName];
  return result;
}

function status(thenDo) {
  var files = Object.keys(loadedModules);
  var envs = files.reduce((envs, fn) => {
    envs[fn] = {
      loadError:         loadedModules[fn].loadError,
      isLoaded:          loadedModules[fn].isLoaded,
      recorderName:      loadedModules[fn].recorderName,
      recordedVariables: Object.keys(loadedModules[fn].recorder)
    }
    return envs;
  }, {});
  thenDo(null, envs);
}

function statusForPrinted(moduleName, options, thenDo) {
  options = lang.obj.merge({depth: 3}, options);
  var env = envFor(moduleName);

  var state = {
    loadError:         env.loadError,
    isLoaded:          env.isLoaded,
    recorderName:      env.recorderName,
    recordedVariables: env.recorder
  }
  
  thenDo(null, lang.obj.inspect(state, {maxDepth: options.depth}));
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

module.exports = {
  wrapModuleLoad: wrapModuleLoad,
  envFor: envFor,
  evalIn: evalIn,
  status: status,
  statusForPrinted: statusForPrinted
}

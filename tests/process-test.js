/*global process, beforeEach, afterEach, describe, it, expect*/

var isCommonJS = typeof module !== "undefined" && module.require;
var chai = isCommonJS ? module.require("chai") : window.chai;
var chaiSubset = isCommonJS ? module.require("chai-subset") : window.chaiSubset;
var expect = chai.expect; chai.use(chaiSubset);
var Global = isCommonJS ? global : window;
var lang = isCommonJS ? require("lively.lang") : window.lively.lang;
var fs = require("fs");

var liveEval = require("../index");
var p = liveEval.process;

describe('process', function() {

  it("starts new nodejs process", function(done) {
    lang.fun.composeAsync(
      p.runNode.bind(null, "console.log('test');"),
      (p, n) => p.process.once("close", function() { n(null, p)}),
      (p, n) => {
        expect(p.running).equals(false);
        expect(p.readLogSync()).equals("test\n");
        n();
      }
    )(done);
  });

  it("starts nodejs process on module", function(done) {
    lang.fun.composeAsync(
      p.runNodeOn.bind(null, "./some-module.js"),
      (p,n) => p.process.once("close", function() { n(null, p)}),
      (p,n) => p.readLog(n),
      (logBuffer, n) => { expect(logBuffer.toString()).equals("running some-module\n"); n(); }
    )(done);
  });

  it("evals in context of loaded module", function(done) {
    var proc, evalResult;
    lang.fun.composeAsync(
      p.runNodeOn.bind(null, "./some-module.js", [], {silent: true, isWorkspace: true}),
      (p,n) =>  { proc = p ; p.sendEval('console.log(internalState);', n); },
      (evalR, n) => { evalResult = evalR; proc.stop(n); },
      (n) => proc.readLog(n),
      (logBuffer, n) => {
        expect(evalResult.isError).equals(false, evalResult.value);
        expect(logBuffer.toString()).equals("running some-module\n23\n");
        n(); }
    )(done);
  });

});

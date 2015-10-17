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

  var procMessenger;
  afterEach(done => procMessenger.close(done));

  describe("start / stop", () => {

    it("starts nodejs and runs code", done => {
      lang.fun.composeAsync(
        n => procMessenger = p.startNodejsProcess({code: "console.log('test');"}, n),
        (p, n) => lang.fun.waitFor(() => !p.isOnline(), n),
        n => procMessenger.readLog(n),
        (logBuf, n) => { expect(logBuf.toString()).equals("test\n"); n(); }
      )(done);
    });

    it("starts nodejs on a module", done => {
      lang.fun.composeAsync(
        n => procMessenger = p.startNodejsProcess({module: "./some-module.js"}, n),
        (p, n) => lang.fun.waitFor(() => !p.isOnline(), n),
        n => procMessenger.readLog(n),
        (logBuf, n) => { expect(logBuf.toString()).equals("running some-module\n"); n(); }
      )(done);
    });

  });

  describe("run code", () => {

    it("evals in context of loaded module", function(done) {
      var proc, evalResult;
      lang.fun.composeAsync(
        n => procMessenger = p.startNodejsWorkspace({}, n),
        (_, n) => setTimeout(n ,500),
        n => procMessenger.sendToChild("eval", {code: "1+2"}, n),
        (answer, n) => {
          expect(answer).deep.property("data.value").equals(3);
          n();
        }
      )(done);
    });
    
  });


});

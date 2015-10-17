/*global require, process, before, beforeEach, afterEach, describe, it, expect, global*/

var isCommonJS = typeof module !== "undefined" && module.require;
var chai = isCommonJS ? module.require("chai") : window.chai;
var chaiSubset = isCommonJS ? module.require("chai-subset") : window.chaiSubset;
var expect = chai.expect; chai.use(chaiSubset);
var Global = isCommonJS ? global : window;
var lang = isCommonJS ? require("lively.lang") : window.lively.lang;
var fs = require("fs");

var evaluator = require("../lib/evaluator");

describe('evaluator', function() {

  before(() => evaluator.wrapModuleLoad());
  beforeEach(() => require("./some-module"));
  afterEach(() => delete require.cache[require.resolve("./some-module")]);

  it("captures internal module state", function() {
    expect(evaluator.envFor("./some-module"))
      .deep.property("recorder.internalState")
      .equals(23);
  });

  it("evaluates inside of module", function() {
    expect(evaluator.evalIn("./some-module", "internalState")).equals(23);
  });
});

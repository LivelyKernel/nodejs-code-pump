/*global require, process, before, beforeEach, afterEach, describe, it, expect, global*/

var chai = require("chai");
var chaiSubset = require("chai-subset")
var expect = chai.expect; chai.use(chaiSubset);
var lang = require("lively.lang");
var fs = require("fs");

var evaluator = require("../lib/evaluator");

describe('evaluator', function() {

  before(() => evaluator.wrapModuleLoad());
  after(() => evaluator.unwrapModuleLoad());
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

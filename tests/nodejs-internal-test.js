/*global process, beforeEach, afterEach, describe, it, expect*/

var chai = require("chai");
var chaiSubset = require("chai-subset")
var expect = chai.expect; chai.use(chaiSubset);
var lang = require("lively.lang");
var internal = require("../lib/nodejs-internal");


describe('nodejs-internal', () => {

  it("can list loaded modules", () => {
    console.log(internal.loadedModules());
    expect(internal.loadedModules()).to.include("tests/nodejs-internal-test.js");
  });

});

var fs = require("fs");

function someFunction() {
  return 3 + 4;
}

console.log("running some-module");

var internalState = 23;

module.exports = {
  foo: someFunction
}
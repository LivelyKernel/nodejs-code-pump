/*global require, process, before, beforeEach, afterEach, describe, it, expect, global*/

var isCommonJS = typeof module !== "undefined" && module.require;
var chai = isCommonJS ? module.require("chai") : window.chai;
var chaiSubset = isCommonJS ? module.require("chai-subset") : window.chaiSubset;
var expect = chai.expect; chai.use(chaiSubset);
var Global = isCommonJS ? global : window;
var lang = isCommonJS ? require("lively.lang") : window.lively.lang;

var commonJsEvaluator = require("lively.vm").cjs;
var server = require("../lib/server");
var WebSocketClient = require('websocket').w3cwebsocket;
var state = {clients: [], server: null}

function createWebsocketClient(url, thenDo) {
  var client = new WebSocketClient(url);
  client.onerror = function() { console.log('Connection Error'); };
  client.onopen = function() { thenDo && thenDo(null, client); };
  client.onclose = function() {
    console.log('echo-protocol Client Closed');
    lang.arr.remove(state.clients, client);
  };
  client.onmessage = function(e) { console.log(e); };
  client.sendJSON = function(json, thenDo) {
    json.sender = "client";
    client.send(JSON.stringify(json));
    thenDo && thenDo();
  };
  return client;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

var port = 9010;

describe('server', function() {

  var client, serverMsger;

  before(() => commonJsEvaluator.wrapModuleLoad());
  beforeEach(done => {
    lang.fun.composeAsync(
      n => lang.fun.waitFor(() => !state.server, n),
      n => server.startServer({port: port}, n),
      (msger, n) => { serverMsger = msger; n(); },
      n => createWebsocketClient("ws://0.0.0.0:" + port, n),
      (_client, n) => { client = _client; state.clients.push(_client); n();  }
    )(done);
  });

  afterEach(done => {
    state.clients.forEach(ea => ea.close());
    serverMsger.close(done);
    delete require.cache[require.resolve("./some-module")];
  });

  it("can require a module", function(done) {
    lang.fun.composeAsync(
      n => {
        client.onmessage = e => n(null, e.data),
        client.sendJSON({action: "eval", data: {code: 'require("' + __dirname + '/some-module")'}});
      },
      (data, n) => { expect(data).to.not.include("Error"); n(); },
      n => { expect(global.someModuleGlobal).equals(99, "test module not loaded"); n(); }
    )(done);
  });

  it("evals inside a module", function(done) {
    lang.fun.composeAsync(
      n => {
        client.onmessage = (e) => n(null, e.data);
        client.sendJSON({
          action: "eval",
          data: {module: "./tests/some-module", code: 'internalState'}
        });
      },
      (answer, n) => {
        expect(JSON.parse(answer).data.value).equals(23, "internalState variable not matching");
        n();
      }
    )(done);
  });

});

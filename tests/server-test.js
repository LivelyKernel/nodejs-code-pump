/*global require, process, before, beforeEach, afterEach, describe, it, expect, global*/

var isCommonJS = typeof module !== "undefined" && module.require;
var chai = isCommonJS ? module.require("chai") : window.chai;
var chaiSubset = isCommonJS ? module.require("chai-subset") : window.chaiSubset;
var expect = chai.expect; chai.use(chaiSubset);
var Global = isCommonJS ? global : window;
var lang = isCommonJS ? require("lively.lang") : window.lively.lang;

var evaluator = require("../lib/evaluator");
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
  client.onmessage = function(e) {
    if (typeof e.data === 'string') {
      console.log("Received: '" + e.data + "'");
    }
  };
  client.sendJSON = function(json, thenDo) {
    client.send(JSON.stringify(json));
    thenDo && thenDo();
  };
  return client;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

var port = 9010;

describe('server', function() {

  before(() => evaluator.wrapModuleLoad());

  beforeEach(done => {
    lang.fun.composeAsync(
      n => lang.fun.waitFor(() => !state.server, n),
      n => server.startServer({port: port}, n),
      (serverState, n) => {
        state.server = serverState;
        state.server.httpServer.on("close", () => {
          console.log("server closed");
          state.server = null;
        });
        n();
      },
      n => createWebsocketClient("ws://0.0.0.0:" + port, n),
      (client, n) => { state.clients.push(client); n();  }
    )(done);
  });

  afterEach(done => {
    state.clients.forEach(ea => ea.close());
    server.closeServer(state.server);
    lang.fun.waitFor(1000, () => !state.server, done)
    delete require.cache[require.resolve("./some-module")];
  });

  it("brings up server and client", function(done) {
    var client = state.clients[0];
    lang.fun.composeAsync(
      n => client.sendJSON({action: "eval", data: {code: 'require("./tests/some-module")'}}, n),
      n => setTimeout(n, 400),
      n => { expect(global.someModuleGlobal).equals(99, "test module not loaded"); n(); }
    )(done);

    // expect(evaluator.envFor("./some-module"))
    //   .deep.property("recorder.internalState")
    //   .equals(23);
  });

});

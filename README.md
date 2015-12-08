# nodejs-code-pump

nodejs code injection and extraction. Can evaluate in the context of modules.
Also supports nodejs process creation for "workspace processes". Controlled
either directly via the evaluator / process interfaces or via websockets. Ws
server is part of the package.

Used in particular but not only for [Lively Web](http://lively-web.org).

Basic eval / source transform mechanism is based on
[lively.vm](https://github.com/LivelyKernel/lively.vm).


## Usage

FILL-ME-OUT

### evaluator

```js
var e = require("code-pump").evaluator;
e.evalIn("./some-module", "internalState.of.module"); // => whatever is stored in there
```


### child process

```js
var p = require("code-pump").process;
p.startNodejsWorkspace({}, (err, procMgr) => {
  procMgr.sendToChild("eval", {code: "1+2"}, (err, answer) {
    console.log(answer.data.value); // => 3
  });
});

```

### websockets

server:

```js
require("code-pump").start("localhost", 9009);
```

client:

```js
var ws = new WebSocketClient("ws://localhost:9009/");
ws.send(JSON.stringify({
  action: "eval",
  data: {module: "./tests/some-module", code: '3 + 4 + internalState'}
}));
ws.onmessage(function(e) {
  JSON.parse(e.data).data.value; // => 30
});
```

## License

MIT

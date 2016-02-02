# code-pump [![Build Status](https://travis-ci.org/LivelyKernel/nodejs-code-pump.svg)](https://travis-ci.org/LivelyKernel/nodejs-code-pump)

Live develop your nodejs app and inspect its state, from a nodejs-workspace in
[Lively Web](http://lively-web.org)!

nodejs code injection, extraction, and evaluation. Can evaluate in the context
of modules by using [lively.vm](https://github.com/LivelyKernel/lively.vm).

Also supports nodejs process creation for "workspace processes". Controlled
either directly via the evaluator / process interfaces or via websockets. Ws
server is part of the package.

## Usage

### Option 1: start code-pump from the command line

1. `npm install code-pump --save-dev`
2. `PATH=$(npm bin):$PATH code-pump localhost:9004`
3. In Lively, open a nodejs-workspace, click on the red "disconnected" button,
   and enter ws://localhost:9004

### Option 2: start code-pump with your nodejs app

```js
require("code-pump").start("localhost", 9004, err =>
  console.log(err ? "Code pump error:" + err : "code-pump started!"););
```

Then connect as in 3. above.

<!---=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--->

## API

### evaluator

Given a file `some-module.js` in the base directory of your app that includes

```js
  var internalState = {of: {module: 23}};
```

you can access it via

```js
var e = require("code-pump").evaluator;
e.evalIn("./some-module", "internalState.of.module"); // => 23
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

If you want your own client then setup a server like above

```js
require("code-pump").start("localhost", 9004, err =>
  console.log(err ? "Code pump error:" + err : "code-pump started!"););
```

In your client (nodejs or browser) run

```js
var ws = new WebSocketClient("ws://localhost:9004/");
ws.send(JSON.stringify({
  action: "eval",
  data: {module: "./some-module", code: '3 + 4 + internalState.of.module'}
}));
ws.onmessage(function(e) {
  JSON.parse(e.data).data.value; // => 30
});
```

## License

MIT

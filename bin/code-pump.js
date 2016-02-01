#!/usr/bin/env node

var host = process.argv.slice(2)[0] || "0.0.0.0",
    port = process.argv.slice(3)[0] || 9010;

require("./index.js").start(host, port, function(err) {
  if (err) console.error("Code pump error:" + err);
  console.log("code-pump started on %s:%s", host, port);
});

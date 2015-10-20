var msger = lively.lang.messenger.create({
  send: function(msg, onSendDone) {
    if (typeof msg !== "string") msg = JSON.stringify(msg);
    this.ws.send(msg);
    onSendDone();
  },
  listen: function(thenDo) {
    if (this.isOnline() || !this.shouldReconnect) return thenDo();
    
    if (this.ws) {
      if (this.ws.readyState === this.ws.CONNECTING) return thenDo();
      this.ws.close();
    }

    this.ws = new WebSocket("ws://0.0.0.0:9010/");
    
    this.ws.onmessage = function(e) { msger.onMessage(JSON.parse(e.data)); };
    this.ws.onclose = function() { msger.shouldReconnect && msger.reconnect(); };

    thenDo();
  },
  close: function(thenDo) {
    msger.shouldReconnect = false;
    this.ws && this.ws.close();
    thenDo();
  },
  isOnline: function() { return this.ws && this.ws.readyState === this.ws.OPEN; }
});

msger.shouldReconnect = true;
msger.listen(() => {})

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

msger.on("message", function(m) { show(m); });
msger.sendTo("server", "eval", {code: "1+2"}, function(err, answer) { show(err || answer.data.value) });

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

msger.close();
msger.isOnline();

var Listener = function(manifesturi) {
  this.source = manifesturi;
  const re = /\/(\d+).m3u8$/;
  var res = re.exec(manifesturi);
  this.id = res[1];
  this.nextAdBreakPTS = -1;
  this.nextAdBreakStopPTS = -1;
  this.subscribers = [];
}

Listener.prototype.adStart = function(ev) {
  console.log("Detected ad break at: " + ev.t);
  this.nextAdBreakPTS = ev.t;
  if(this.subscribers) {
    this.subscribers.forEach(function(s) {
      s.invalidateCache();
    });
  }
}

Listener.prototype.adStop = function(ev) {
  console.log("Detected ad break stop at: " + ev.t);
  this.nextAdBreakStopPTS = ev.t;
  if(this.subscribers) {
    this.subscribers.forEach(function(s) {
      s.invalidateCache();
    });
  }
}

Listener.prototype.id = this.id;

Listener.prototype.addSubscriber = function(subscriber) {
  this.subscribers.push(subscriber); 
}

Listener.prototype.nextAdBreak = function() {
  return {
    start: { pts: this.nextAdBreakPTS },
    stop: { pts: this.nextAdBreakStopPTS }
  };
}
module.exports = Listener;

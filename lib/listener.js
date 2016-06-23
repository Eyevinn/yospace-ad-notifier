var Listener = function(manifesturi) {
  this.source = manifesturi;
  const re = /\/(\d+).m3u8$/;
  var res = re.exec(manifesturi);
  this.id = res[1];
  this.nextAdBreakPTS = -1;
  this.nextAdBreakStopPTS = -1;
  this.subscribers = [];

  this.cbobj = {
    adStartCb: (function(ev) {
      console.log("Detected ad break at: " + ev.t);
      if(this.nextAdBreakPTS == -1) {
        this.nextAdBreakPTS = ev.t;
        this.nextAdBreakStopPTS = -1;
        this.subscribers.forEach(function(s) {
          s.invalidateCache();
        });
      }
    }).bind(this),
    adStopCb: (function(ev) {
      console.log("Detected ad break stop at: " + ev.t);
      if(this.nextAdBreakStopPTS == -1) {
        this.nextAdBreakStopPTS = ev.t;
        this.nextAdBreakStart = -1;
        this.subscribers.forEach(function(s) {
          s.invalidateCache();
        });
      }
    }).bind(this)
  };
}

Listener.prototype.id = this.id;
Listener.prototype.cbobj = this.cbobj;

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

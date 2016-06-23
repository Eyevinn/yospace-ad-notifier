var Listener = function(manifesturi) {
  this.source = manifesturi;
  const re = /\/(\d+).m3u8$/;
  var res = re.exec(manifesturi);
  this.id = res[1];
  this.nextAdBreakPTS = -1;
  this.nextAdBreakStopPTS = -1;

  this.cbobj = {
    adStartCb: function(ev) {
      console.log("Detected ad break at: " + ev.t);
      this.nextAdBreakPTS = ev.t;
    },
    adStopCb: function(ev) {
      console.log("Detected ad break stop at: " + ev.t);
      this.nextAdBreakStopPTS = ev.t;
    }
  };
}

Listener.prototype.cbobj = this.cbobj;

Listener.prototype.id = this.id;

Listener.prototype.nextAdBreak = function() {
  return {
    start: { pts: this.nextAdBreakPTS },
    stop: { pts: this.nextAdBreakStopPTS }
  };
}
module.exports = Listener;
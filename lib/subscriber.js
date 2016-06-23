var uid = require('uid-safe');

// Constructor
var Subscriber = function(listener, hls) {
  this.firstPTS = -1;
  this.hls = hls;
  this.listener = listener;
};

Subscriber.prototype.initiateSession = function() {
  this.sessionid = uid.sync(18);
  var hlslistener = this.hls.getHLSListenerById(this.listener.id);
  this.firstPTS = hlslistener.aacPts;
  return this.sessionid;
}

Subscriber.prototype.nextAd = function() {
  var adbreak = this.listener.nextAdBreak();  
  var nextAdPayload = {
    sessionFirstGlobalPTS: this.firstPTS,
    start: {},
    stop: {}
  };
  if (adbreak.start.pts != -1) {
    nextAdPayload.start.GlobalPTS = adbreak.start.pts;
    nextAdPayload.start.PTS = adbreak.start.pts - this.firstPTS;
  }
  if (adbreak.stop.pts != -1) {
    nextAdPayload.stop.GlobalPTS = adbreak.stop.pts;
    nextAdPayload.stop.PTS = adbreak.stop.pts - this.firstPTS;
  }
  return nextAdPayload;
}

Subscriber.prototype.firstPTS = this.firstPTS;

module.exports = Subscriber;

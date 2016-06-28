var uid = require('uid-safe');

// Constructor
var Subscriber = function(listener, firstsegmenturi, hls, cache) {
  this.sessionFirstPTS = -1;
  this.hls = hls;
  this.listener = listener;
  this.cache = cache;
  this.firstsegmenturi = firstsegmenturi;
};

Subscriber.prototype.initiateSession = function() {
  this.sessionid = uid.sync(18);
  var hlslistener = this.hls.getHLSListenerById(this.listener.id);
  if (this.firstsegmenturi && this.hls.getPTSForSegment(hlslistener, this.firstsegmenturi)) {
    this.sessionFirstPTS = this.hls.getPTSForSegment(hlslistener, this.firstsegmenturi);
  } else {
    this.sessionFirstPTS = hlslistener.aacPts - 60;
    console.warn(this.listener.id + " ["+this.sessionid+"]: Using fixed skew (60s)");
  }
  console.log(this.listener.id + " ["+this.sessionid+"]: Session initiated (firstPTS=" + this.sessionFirstPTS + ")");
  return this.sessionid;
}

Subscriber.prototype.invalidateCache = function() {
  if (this.cache) {
    console.log(this.listener.id + ": Invalidating cache for " + this.sessionid);
    this.cache.del(this.sessionid, (function(error, deletions) {
      console.log(this.listener.id + ": Invalidated cache for " + this.sessionid);
    }).bind(this));
  }
}

Subscriber.prototype.nextAd = function() {
  var adbreak = this.listener.nextAdBreak();  
  console.log(this.listener.id + " ["+this.sessionid+"]: Next ad break:", adbreak);
  var nextAdPayload = {
    sessionFirstGlobalPTS: this.sessionFirstPTS,
    start: {},
    stop: {}
  };
  if (adbreak.start.pts != -1) {
    nextAdPayload.start.PTS = Math.max(adbreak.start.pts - this.sessionFirstPTS, 0);
    nextAdPayload.start.GlobalPTS = adbreak.start.pts;
  }
  if (adbreak.stop.pts != -1) {
    nextAdPayload.stop.PTS = Math.max(adbreak.stop.pts - this.sessionFirstPTS, 0);
    nextAdPayload.stop.GlobalPTS = adbreak.stop.pts;
  }
  console.log(this.listener.id + " ["+this.sessionid+"]: Ad payload:", nextAdPayload);
  return nextAdPayload;
}

Subscriber.prototype.firstPTS = this.firstPTS;

module.exports = Subscriber;

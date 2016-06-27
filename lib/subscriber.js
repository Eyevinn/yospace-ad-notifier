var uid = require('uid-safe');

// Constructor
var Subscriber = function(listener, skew, hls, cache) {
  this.sessionFirstPTS = -1;
  this.hls = hls;
  this.listener = listener;
  this.cache = cache;
  this.skew = skew;
};

Subscriber.prototype.initiateSession = function() {
  this.sessionid = uid.sync(18);
  var hlslistener = this.hls.getHLSListenerById(this.listener.id);
  this.sessionFirstPTS = hlslistener.aacPts - this.skew;
  console.log(this.listener.id + ": ["+this.sessionid+"]: Session initiated (skew=-" + this.skew + "s)");
  return this.sessionid;
}

Subscriber.prototype.invalidateCache = function() {
  console.log(this.listener.id + ": Invalidating cache for " + this.sessionid);
  this.cache.del(this.sessionid, (function(error, deletions) {
    console.log(this.listener.id + ": Invalidated cache for " + this.sessionid);
  }).bind(this));
}

Subscriber.prototype.nextAd = function() {
  var adbreak = this.listener.nextAdBreak();  
  console.log(this.listener.id + "["+this.sessionid+"]: Next ad break:", adbreak);
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
  console.log(this.listener.id + ": ["+this.sessionid+"]: ", nextAdPayload);
  return nextAdPayload;
}

Subscriber.prototype.firstPTS = this.firstPTS;

module.exports = Subscriber;

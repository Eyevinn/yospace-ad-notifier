var ts = require('./lib/tsparser');
var hlsid3 = require('./lib/hlsid3')({
  ts: ts
});

var SOURCES = ['http://csm-e.cds1.yospace.com/csm/live/119101367.m3u8'];

SOURCES.forEach(function(s) {
  var cbobj = {
    adStartCb: function(ev) {
      console.log("Detected ad break at: " + ev.t);
    },
    adStopCb: function(ev) {
      console.log("Detected ad break stop at: " + ev.t);
    }
  };
  hlsid3.addHLSListener(s, cbobj);  
});

hlsid3.start();


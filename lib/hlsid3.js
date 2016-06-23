var hlsparser = require('./hlsparser');
var XMLHttpRequest = require('xhr2');

function AdEvent(t) {
  return {
    t: t
  };
}

function _downloadFragment(listener, fragment, downloadedcb) {
  var xhr = new XMLHttpRequest();
  xhr.responseType = 'arraybuffer';
  xhr.onloadend = function(event) {
    var xhr = event.target, status = xhr.status;
    if (status >= 200 && status < 300) {
      var f = {
        fno: fragment.fno,
        payload: xhr.response,
        url: fragment.url
      };
      listener.downloadedFragments[fragment.fno] = f;
      downloadedcb(f); 
    }
  };
  xhr.open('GET', fragment.url, true);
  xhr.send();
}

function _parseFragment(listener, ts, fragment, payload, parsedfragment) {
  var fragmentdata = {};

  fragmentdata.length = payload.byteLength; 
  fragmentdata.payload = new Uint8Array(payload);

  if (fragmentdata.length > 0 && ts.validTS(fragmentdata.payload)) {
    //console.log("Found TS segment");
    ts.parseTSPackets(listener, fragment, fragmentdata.payload);
  }

  fragment.data = fragmentdata;
  parsedfragment(fragment);
}


function HLSID3(options) {
  var tsparser;
  var listeners = [];
  var timer;

  if (!options.ts) {
    throw new Error('Options.ts is required');
  }
  tsparser = options.ts;

  function _handleTick() {
    listeners.forEach(function(l) {
      //console.log(l.src + ": TICK");
      hlsparser.loadAndParseMasterPlaylist(l.src, function(level) {
        hlsparser.loadAndParseLevelPlaylist(level.url, function(fragments) {
          fragments.forEach(function (f) {
            if(typeof l.fragmentCache[f.url] === 'undefined') {
              f.fno = l.fragCount++;
              f.downloaded = false;
              l.fragmentCache[f.url] = f;
            }
          });
        });
      });

      for (var key in l.fragmentCache) {
        if (l.fragmentCache[key].downloaded === false) {
          // console.log('Downloading fragment ('+l.fragmentCache[key].fno+') ' + l.fragmentCache[key].url);
          _downloadFragment(l, l.fragmentCache[key], function(f) {
            l.fragmentCache[f.url].downloaded = true;
          });
        }
      } 

      if (l.downloadedFragments[l.nextExpectedFragment]) {
        var nextFragment = l.downloadedFragments[l.nextExpectedFragment];
        _parseFragment(l, tsparser, l.fragmentCache[nextFragment.url], nextFragment.payload, function(fragment) {
          console.log('Fragment ('+fragment.fno+') parsed (ID3?'+fragment.hasID3+'): '+fragment.url);
          var aacPts = l.aacTrack.samples[l.aacTrack.samples.length-1].npts;
          if (fragment.hasID3) {
            console.log("Ad break: " + l.lastPTSnoAds);
            if (!l.adStart.fired) {
              if (l.lastPTSnoAds) {
                l.adStart.Cb(AdEvent(l.lastPTSnoAds));
              }
              l.adStart.fired = true;
              l.adStop.fired = false;
              l.firstPTSnoAds = null;
            }
            // This fragment is an ad fragment, do not cache it
            l.fragmentCache[fragment.url].downloaded = false;
          } else {
            console.log("("+fragment.fno+") ["+fragment.duration+"s] AAC PTS: " + aacPts);
            l.lastPTSnoAds = aacPts;
            l.adStart.fired = false;
            if (!l.adStop.fired) {
              l.firstPTSnoAds = aacPts - fragment.duration;
              if (l.firstPTSnoAds) {
                l.adStop.Cb(AdEvent(l.firstPTSnoAds));
                l.adStop.fired = true;
              }
            }
          }
          l.nextExpectedFragment++;
        });
      }
    });
  }

  return {
    addHLSListener: function(source, cbobj) {
      var HLSListener = {
        src: source,
        adStart: { Cb: cbobj.adStartCb, fired: false },
        adStop: { Cb: cbobj.adStopCb, fired: false },
        fragmentCache: {},
        fragCount: 0,
        nextExpectedFragment: 0,
        downloadedFragments: {},
        id3Track: { type: 'id3', id: -1, samples: [] },
        aacTrack: { container: 'video/mp2t', type: 'audio', id: -1, samples: [], initPTS: null },
        avcTrack: { container: 'video/mp2t', type: 'video', id: -1, samples: [], nbNalu: 0 },
        lastPTSnoAds: null,
        firstPTSnoAds: null
      };
      listeners.push(HLSListener);
      //console.log("New listener added", HLSListener);
    },
    start: function() {
      timer = setInterval(_handleTick, 1000); 
    },
    stop: function() {
    }
  }
}

module.exports = HLSID3;

var hlsparser = require('./hlsparser');
var XMLHttpRequest = require('xhr2');
var AdEvent = require('./adevent');

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
      if(l.level == null) {
        hlsparser.loadAndParseMasterPlaylist(l.src, function(level) {
          l.level = level;
        });
      } else {
        hlsparser.loadAndParseLevelPlaylist(l.level.url, function(fragments) {
          fragments.forEach(function (f) {
            if(typeof l.fragmentCache[f.url] === 'undefined') {
              f.fno = l.fragCount++;
              f.downloaded = false;
              l.fragmentCache[f.url] = f;
              //console.log(l.id + ": ("+f.fno+") "+f.url);
            }
          });
        });
      }

      for (var key in l.fragmentCache) {
        if (l.fragmentCache[key].downloaded === false) {
          // console.log('Downloading fragment ('+l.fragmentCache[key].fno+') ' + l.fragmentCache[key].url);
          _downloadFragment(l, l.fragmentCache[key], function(f) {
            if (typeof l.fragmentCache[f.url] === 'undefined') {
              l.fragmentCache[f.url] = f;
            }
            l.fragmentCache[f.url].downloaded = true;
          });
        }
      } 

      if (l.downloadedFragments[l.nextExpectedFragment]) {
        var nextFragment = l.downloadedFragments[l.nextExpectedFragment];
        _parseFragment(l, tsparser, l.fragmentCache[nextFragment.url], nextFragment.payload, function(fragment) {
          console.log(l.id + ': Fragment ('+fragment.fno+') parsed (ID3?'+fragment.hasID3+'): '+fragment.url);
          l.aacPts = l.aacTrack.samples[l.aacTrack.samples.length-1].npts;
          if (fragment.hasID3) {
            console.log(l.id + ": ("+fragment.fno+") ["+fragment.duration+"s] Ad break: " + l.lastPTSnoAds);
            if (!l.adStart.fired) {
              if (l.lastPTSnoAds) {
                l.adStart.Cb(new AdEvent(l.lastPTSnoAds));
              }
              l.adStart.fired = true;
              l.adStop.fired = false;
              l.firstPTSnoAds = null;
            }
            // This fragment is an ad fragment, do not cache it
            l.fragmentCache[fragment.url].downloaded = false;
          } else {
            console.log(l.id + ": ("+fragment.fno+") ["+fragment.duration+"s] AAC PTS: " + l.aacPts);
            l.lastPTSnoAds = l.aacPts;
            l.aacMap[fragment.url] = l.aacPts - fragment.duration;
            l.adStart.fired = false;
            if (!l.adStop.fired) {
              l.firstPTSnoAds = l.aacPts - fragment.duration;
              if (l.firstPTSnoAds) {
                l.adStop.Cb(new AdEvent(l.firstPTSnoAds));
                l.adStop.fired = true;
              }
            }
          }
          l.nextExpectedFragment++;
        });
      }

      // Do some memory recycling here...
      // console.log(l.id + ": Saved fragments " + Object.keys(l.downloadedFragments).length);
      if (Object.keys(l.downloadedFragments).length > 10) {
        var i = l.nextExpectedFragment-10;
        var count = 0;
        while(i>=0 && l.downloadedFragments[i] != null) {
          var f = l.downloadedFragments[i];
          delete l.fragmentCache[f.url];
          delete l.downloadedFragments[i];
          if(l.fragmentCache[f.url] == null && l.downloadedFragments[i] == null) {
            console.log(l.id + ": Memory recycling, removed fragment " + i);
          }
          i--;
          count++;
        }
      }
    });
  }


  return {
    addHLSListener: function(id, source, adStartCb, adStopCb) {
      var HLSListener = {
        id: id,
        src: source,
        level: null,
        adStart: { Cb: adStartCb, fired: false },
        adStop: { Cb: adStopCb, fired: false },
        fragmentCache: {},
        fragCount: 0,
        nextExpectedFragment: 0,
        downloadedFragments: {},
        aacMap: {},
        id3Track: { type: 'id3', id: -1, samples: [] },
        aacTrack: { container: 'video/mp2t', type: 'audio', id: -1, samples: [], initPTS: null },
        avcTrack: { container: 'video/mp2t', type: 'video', id: -1, samples: [], nbNalu: 0 },
        lastPTSnoAds: null,
        firstPTSnoAds: null
      };
      listeners.push(HLSListener);
      //console.log("New listener added", HLSListener);
    },
    getHLSListenerById: function(id) {
      for(var i=0; i<listeners.length; i++) {
        if(listeners[i].id === id) {
          return listeners[i];
        }
      }
    },
    getPTSForSegment: function(l, segmenturi) {
      return l.aacMap[segmenturi];
    },
    start: function() {
      timer = setInterval(_handleTick, 1000); 
    },
    stop: function() {
    }
  }
}

module.exports = HLSID3;

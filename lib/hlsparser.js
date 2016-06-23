var XMLHttpRequest = require('xhr2');

function _extractAttributes(string) {
  const re = /\s*(.+?)\s*=((?:\".*?\")|.*?)(?:,|$)/g;
  var match, attrs = {};
  while ((match = re.exec(string)) !== null) {
    var value = match[2], quote = '"';
     
    if (value.indexOf(quote) === 0 &&
        value.lastIndexOf(quote) === (value.length-1)) {
      value = value.slice(1, -1);
    }
    attrs[match[1]] = value;
  } 
  return attrs;
}

function _parseMasterPlaylist(string, parsedmaster) {
  var result;
  var levels = [];
  var re = /#EXT-X-STREAM-INF:([^\n\r]*)[\r\n]+([^\r\n]+)/g;
  while((result = re.exec(string)) != null) {
    var level = {};
    var attr = _extractAttributes(result[1]);
    var l = {
      bw: attr['BANDWIDTH'],
      url: result[2],
      baseurl: result[2].replace(/^((\w+:)?\/\/[^\/]+\/?).*$/,'$1')
    };
    levels.push(l);
  }
  levels.sort(function(a, b) {return a.bw - b.bw});
  // We only need the lowest level
  parsedmaster(levels[0]);
}

function _parseLevelPlaylist(string, parsedlevel) {
  var re = /#EXTINF:([^\n\r]*)[\r\n]+([^\r\n]+)/g;
  var fragments = [];
  while((result = re.exec(string)) != null) {
    var f = {
      duration: result[1].split(",")[0],
      url: result[2],
      hasID3: false
    };
    fragments.push(f);
  }
  parsedlevel(fragments);
}

module.exports.loadAndParseMasterPlaylist = function(playlisturi, parsedcb) {
  var xhr = new XMLHttpRequest();
  xhr.onloadend = function(event) {
    var xhr = event.target, status = xhr.status;
    if (status >= 200 && status < 300) {
      _parseMasterPlaylist(xhr.response, parsedcb);
    }
  };
  xhr.open('GET', playlisturi, true);
  xhr.send();
};

module.exports.loadAndParseLevelPlaylist = function(levellisturi, parsedcb) {
  var xhr = new XMLHttpRequest();
  xhr.onloadend = function(event) {
    var xhr = event.target, status = xhr.status;
    if (status >= 200 && status < 300) {
      _parseLevelPlaylist(xhr.response, parsedcb);
    }
  };
  xhr.open('GET', levellisturi, true);
  xhr.send();
}


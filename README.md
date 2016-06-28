# Setup

Install the necessary modules

    npm install

Make sure Redis cache is running
  
Run the server (defaults to port 4000)

    node app.js


# Example usage

List all available feeds

    curl http://localhost:4000/api/feeds

Response

    [{"id":"119101367","subscribe":{"uri":"/api/subscribe/119101367","method":"POST"}}]

Obtain an endpoint to subscribe to

    curl -X POST http://localhost:4000/api/subscribe/119101367

with the following body

    { firstsegment: { uri: "URI to first segment in the HLS manifest when playback started" } }

Response

    {"firstPTS":209.96266666666668,"sessionid":"b0UDmqns9WcVAAs6eNAP6fZx","nextadbreak":{"uri":"/api/subscribe/119101367/session/b0UDmqns9WcVAAs6eNAP6fZx","method":"GET"}}

"Listen" for next ad break

    curl http://localhost:4000/api/subscribe/119101367/session/b0UDmqns9WcVAAs6eNAP6fZx
  
Response

    {"sessionFirstGlobalPTS":209.96266666666668,"start":{},"stop":{}}


# Reference client implementation

```javascript

initiateSession(manifesturi, 60, function(session) {
  var cbobj = {
    adStartCb: function(t) {
      console.log("Detected ad break at: " + t + ", current=" + player.currentTime);
      adBreakStart = t;
      adBreakStop = null;
    },
    adStopCb: function(t) {
      console.log("Detected ad break stop at: " + t + ", current=" + player.currentTime);
      adBreakStart = null;
      adBreakStop = t;
    }
  };

  var notifier = {
    adStart: { Cb: cbobj.adStartCb, fired: false },
    adStop: { Cb: cbobj.adStopCb, fired: false }
  };
  var timer = setInterval(function() {
    poll('http://ad-notifier.example.com' + session.nextadbreak.uri, function(data) {
      if (data.stop && (typeof data.stop.PTS != "undefined" && data.stop.PTS != -1)) {
        if (!notifier.adStop.fired) {
          notifier.adStop.Cb(Math.max(data.stop.PTS, 0));
          notifier.adStop.fired = true;
          notifier.adStart.fired = false;
        }
      } else if (data.start && (typeof data.start.PTS != "undefined" && data.start.PTS != -1)) {
        if (!notifier.adStart.fired) {
          notifier.adStart.Cb(Math.max(data.start.PTS, 0));
          notifier.adStart.fired = true;
          notifier.adStop.fired = false;
        }
      }
    });
  }, 5000);

  player.src = manifesturi;
  player.play();
});


function initiateSession(manifesturi, done) {
  var streamid = _getStreamID(manifesturi);
  _getFirstSegment(manifesturi, function(segment) {
    var xhr = new XMLHttpRequest();
    xhr.responseType = 'json';
    xhr.onloadend = function(event) {
      var xhr = event.target, status = xhr.status;
      if (status >= 200 && status < 300) {
        done(xhr.response);
      }
    };
    var sessionuri = 'http://ad-notifier.example.com/api/subscribe/' + streamid;
    xhr.open('POST', sessionuri, true);
    xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    xhr.send(JSON.stringify({ firstsegment: {uri: segment.uri} }));
  });
}

function poll(uri, done) {
  var xhr = new XMLHttpRequest();
  xhr.responseType = 'json';
  xhr.onloadend = function(event) {
    var xhr = event.target, status = xhr.status;
    if (status >= 200 && status < 300) {
      done(xhr.response);
    }
  };
  xhr.open('GET', uri, true);
  xhr.send();
}



```

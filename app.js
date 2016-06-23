var express = require('express');
var bodyParser = require('body-parser');

var tsparser = require('./lib/tsparser');
var hlsid3 = require('./lib/hlsid3')({
  ts: tsparser
});
var Listener = require('./lib/listener');
var Subscriber = require('./lib/subscriber');

var SOURCES = ['http://csm-e.cds1.yospace.com/csm/live/119101367.m3u8'];
var listeners = {};
var subscribers = {};

SOURCES.forEach(function(s) {
  var listener = new Listener(s);
  hlsid3.addHLSListener(listener.id, s, listener.cbobj);  
  listeners[listener.id] = listener;
});

hlsid3.start();

var app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
var router = express.Router();

router.use(function(req, res, next) {
  console.log('Handling request');
  next();
});

// Obtain a list of all available feeds to subscribe to
router.get("/feeds", function(req, res) {
  var jsonresponse = [];
  for (var key in listeners) {
    var feed = {
      id: listeners[key].id,
      subscribe: {
        uri: '/api/subscribe/' + listeners[key].id,
        method: 'POST'
      }
    };
    jsonresponse.push(feed);
  }
  return res.json(jsonresponse);
});

// Subscribe to a specific feed. Will return an endpoint to poll
router.post("/subscribe/:id", function(req, res) {
  var listenerid = req.params.id;
  var sub = new Subscriber(listeners[listenerid], hlsid3);
  var sessionid = sub.initiateSession();
  subscribers[sessionid] = sub;
  var jsonresponse = {
    firstPTS: sub.firstPTS,
    sessionid: sessionid,
    nextadbreak: {
      uri: '/api/subscribe/' + req.params.id + '/session/' + sessionid,
      method: 'GET'
    }
  };
  return res.json(jsonresponse);
});

router.get("/subscribe/:listener_id/session/:session_id", function(req, res) {
  var sessionid = req.params.session_id;
  var sub = subscribers[sessionid];
  // Fix some smart caching directives here so we can use a memcache such as Varnish etc
  return res.json(sub.nextAd());
});

app.use('/api', router);
var server = app.listen(4000, function() {
  console.log("Listening for subscribers on port %s...", server.address().port);
});

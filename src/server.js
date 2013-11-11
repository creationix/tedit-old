var http = require('http');
var https = require('https');
var WebSocketServer = require('ws').Server;
var send = require('send');
var net = require('net');
var tls = require('tls');
var urlParse = require('url').parse;

// Defaults to dev version to easy local deployment.
// Dev version must be run from http://localhost:8002
var githubConfig = {
  clientId: process.env.GITHUB_CLIENT_ID || "700f0fceacdc16c17cf9",
  clientSecret: process.env.GITHUB_CLIENT_SECRET || "ad70cde4f687b0a6caadcfc9eeeec7afab524eb4"
};


var server = http.createServer(onRequest);
var wss = new WebSocketServer({server: server});
server.listen(8002);
console.log("HTTP server listening on", server.address());

function onRequest(req, res) {
  var uri = urlParse(req.url, true);
  // Serve static resources
  if (uri.pathname !== "/github-callback") {
    return send(req, uri.pathname)
      .root(__dirname)
      .pipe(res);
  }

  // Handle oauth endpoint.
  https.request({
    method: "POST",
    host: "github.com",
    path: "/login/oauth/access_token",
    headers: {
      "User-Agent": "Node.JS " + process.version,
      "Accept": "application/json",
      "Content-Type": "application/json"
    }
  }, onResponse).end(JSON.stringify({
    client_id: githubConfig.clientId,
    client_secret: githubConfig.clientSecret,
    code: uri.query.code
  }));

  function onResponse(response) {
    res.setHeader("Content-Type", "text/html");
    if (req.code < 200 || req.code >= 300) {
      return res.end("Invalid HTTP response from github: " + req.code);
    }
    res.write("Getting token from github...");
    response.setEncoding("utf8");
    var json = "";
    response.on("data", function (chunk) {
      json += chunk;
    });
    response.on("end", function () {
      // Make sure it's json
      try { JSON.parse(json); }
      catch (err) {
        return res.end(err.stack);
      }
      res.end('<script>' +
        'opener.postMessage(' + json + ', location.origin);' +
        'close();' +
      '</script>');
    });
  }
}

wss.on('connection', function(ws) {
  var req = ws.upgradeReq;
  if (req.host !== req.origin) {
    ws.send("Only same origin allowed");
    ws.close();
    return;
  }

  var match = req.url.match(/^\/(tcp|tls)\/([^\/]+)\/([0-9]+)$/);
  if (!match) {
    ws.send("Invalid request url.\nMust be /:protocol/:host/:port");
    ws.close();
    return;
  }
  var protocol = match[1];
  console.log("ws<->%s Client connected", protocol);
  var host = match[2];
  var port = parseInt(match[3], 10);
  var base = protocol === "tcp" ? net : tls;
  console.log("Connecting to %s:%s", host, port);
  var s = base.connect({host: host, port: port}, onConnect);
  s.on("error", function (err) {
    try {
      ws.send(err);
      ws.close();
    } catch (err) {}
  });
  function onConnect() {
    ws.send("connect");
    console.log("Connected to %s:%s", host, port);
    s.on("error", function (err) {
      try {
        ws.send(err);
        ws.close();
      } catch (err) {}
    });
    ws.on('message', function (message) {
      try {
        s.write(message);
      } catch (err) {}
    });
    ws.on('close', function () {
      try {
        s.end();
      } catch (err) {}
    });
    s.on('data', function (chunk) {
      try {
        ws.send(chunk);
      } catch (err) {}
    });
    s.on('close', function () {
      try {
        ws.close();
      } catch (err) {}
    });
  }
});

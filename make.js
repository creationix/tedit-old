#!/usr/bin/env node
var T = require('tim-task');

// Override paths using environment variables
var WEBDIR = process.env.WEBDIR || "build/web";
var CHROMEDIR = process.env.CHROMEDIR || "build/chrome";

T("web", T.serial(
  T.parallel(
    T.copy("src/icon-196.png", WEBDIR + "/icon-196.png"),
    T.copy("src/index.html", WEBDIR + "/index.html"),
    T.copy("src/server.js", WEBDIR + "/server.js"),
    T.newer("src", /\.(?:less|css)$/, WEBDIR + "/style.css",
      T.lessc("src/style.less", WEBDIR + "/style.css")
    ),
    T.newer("src", /\.js$/, WEBDIR + "/app.js",
      T.build("src/web.js", WEBDIR + "/app.js")
    )
  ),
  T.manifest(WEBDIR, [
    "index.html",
    "style.css",
    "app.js",
  ], "manifest.appcache")
));

T("chrome", T.parallel(
  T.copy("src/manifest.json", CHROMEDIR + "/manifest.json"),
  T.copy("src/icon-128.png", CHROMEDIR + "/icon-128.png"),
  T.copy("src/background.js", CHROMEDIR + "/background.js"),
  T.copy("src/index.html", CHROMEDIR + "/index.html"),
  T.newer("src", /\.(?:less|css)$/, CHROMEDIR + "/style.css",
    T.lessc("src/style.less", CHROMEDIR + "/style.css")
  ),
  T.newer("src", /\.js$/, CHROMEDIR + "/app.js",
    T.build("src/chrome.js", CHROMEDIR + "/app.js")
  )
));

T("clean", T.rmrf("build"));

T("full", T.serial(
  T.run("clean"),
  T.parallel(
    T.run("web"),
    T.run("chrome")
  )
));


var fs = require('fs');
var path = require('path');
var targets = process.argv.slice(2);
if (!targets.length) targets.push("full");

T.execute(T.run, targets, function (err) {
  if (err) {
    console.error(err.stack || err);
    process.exit(-1);
  }
});


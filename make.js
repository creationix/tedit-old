#!/usr/bin/env node
var T = require('tim-task');

// Override paths using environment variables
var WEBDIR = process.env.WEBDIR || "build/web";

T("web", T.parallel(
  T.copy("src/manifest.json", WEBDIR + "/manifest.json"),
  T.copy("src/icon-196.png", WEBDIR + "/icon-196.png"),
  T.copy("src/icon-128.png", WEBDIR + "/icon-128.png"),
  T.copy("src/background.js", WEBDIR + "/background.js"),
  T.copy("src/index.html", WEBDIR + "/index.html"),
  T.copy("src/server.js", WEBDIR + "/server.js"),
  T.newer("src", /\.(?:less|css)$/, WEBDIR + "/style.css",
    T.lessc("src/style.less", WEBDIR + "/style.css")
  ),
  T.newer("src", /\.js$/, WEBDIR + "/app.js",
    T.build("src/app.js", WEBDIR + "/app.js")
  )
));

T("clean", T.rmrf(WEBDIR));

T("full", T.serial(
  T.run("clean"),
  T.run("web")
));


var targets = process.argv.slice(2);
if (!targets.length) targets.push("full");

T.execute(T.run, targets, function (err) {
  if (err) {
    console.error(err.stack || err);
    process.exit(-1);
  }
  // console.log("Done");
});

#!/usr/bin/env node
var T = require('tim-task');

T("build", T.parallel(
  T.copy("src/manifest.json", "app/manifest.json"),
  T.copy("src/icon-196.png", "app/icon-196.png"),
  T.copy("src/icon-128.png", "app/icon-128.png"),
  T.copy("src/background.js", "app/background.js"),
  T.copy("src/index.html", "app/index.html"),
  T.copy("src/server.js", "app/server.js"),
  T.newer("src", /\.(?:less|css)$/, "app/style.css",
    T.lessc("src/style.less", "app/style.css")
  ),
  T.newer("src", /\.js$/, "app/app.js",
    T.build("src/app.js", "app/app.js")
  )
));

T("clean", T.rmrf("app"));

T("full", T.serial(
  T.run("clean"),
  T.run("build")
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

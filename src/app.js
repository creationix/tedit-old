var gitProject = require('./gitfs.js');
var SplitView = require('./SplitView.js');
var LogView = require('./LogView.js');
var Editor = require('./Editor.js');
var TreeView = require('./TreeView.js');

var body = new SplitView({
  orientation: "bottom",
  size: Math.min(200, window.innerHeight >> 1),
  el: document.body,
  main: new SplitView({
    orientation: "left",
    size: Math.min(200, window.innerWidth >> 1),
    main: new Editor(require('./sample.js#txt'), {
      "Ctrl-Enter": require('./run.js'),
      "Ctrl-0": function (cm) {
        size = 16;
        zoom();
        cm.refresh();
      },
      "Ctrl-=": function (cm) {
        size *= 1.1;
        zoom();
        cm.refresh();
      },
      "Ctrl--": function (cm) {
        size /= 1.1;
        zoom();
        cm.refresh();
      },
    }),
  }),
  side: new LogView()
});


gitProject("test", function (err, fs) {
  if (err) return console.log(err);
  console.log(fs);
});

window.addEventListener('resize', onResize, true);
var width, height, size = 16;
onResize();
zoom();
function onResize() {
  var newWidth = window.innerWidth;
  var newHeight = window.innerHeight;
  if (newWidth === width && newHeight === height) return;
  width = newWidth, height = newHeight;
  body.resize(width, height);
}
function zoom() {
  document.body.style.fontSize = size + "px";
}


// var db = localDb("test");
// var repo = jsGit(db);
// var fs = newFileSystem(repo);
// fs.onChange = function (path, value, entry) {
//   if (value) console.log("CHANGE", path, entry.hash);
//   else console.log("DELETE", path);
// };

// var walk = require('./walk.js');
// var initFs = require('./init.js');
// var serial = require('./serial.js');

// serial(
//   initFs(db, fs),
//   walk(repo)
// )(function (err) {
//   if (err) return console.log(err);
//   console.log("Done");
// });


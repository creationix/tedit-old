var gitProject = require('./gitfs.js');
var SplitView = require('./SplitView.js');
var LogView = require('./LogView.js');
var Editor = require('./Editor.js');
var TreeView = require('./TreeView.js');

var body, editor, main;

body = new SplitView({
  orientation: "bottom",
  size: Math.min(200, window.innerHeight >> 1),
  el: document.body,
  main: main = new SplitView({
    orientation: "left",
    size: Math.min(200, window.innerWidth >> 1),
    main: editor = new Editor({
      "Ctrl-Enter": require('./run.js'),
    }),
  }),
  side: new LogView()
});
window.addEventListener('resize', onResize, true);
onResize();

gitProject("test", function (err, fs) {
  if (err) return console.log(err);
  main.addSide(new TreeView(fs, editor));
});

var width, height;
function onResize() {
  var newWidth = window.innerWidth;
  var newHeight = window.innerHeight;
  if (newWidth === width && newHeight === height) return;
  width = newWidth, height = newHeight;
  body.resize(width, height);
}


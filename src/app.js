var gitProject = require('./gitfs.js');
var SplitView = require('./SplitView.js');
var Editor = require('./Editor.js');
var TreeView = require('./TreeView.js');

var body, tree, editor;

body = new SplitView({
  el: document.body,
  orientation: "left",
  size: Math.min(200, window.innerWidth >> 1),
  main: editor = new Editor({
    "Ctrl-Enter": require('./run.js'),
  }),
  side: tree = new TreeView(editor),
});
window.addEventListener('resize', onResize, true);
onResize();

gitProject("test", function (err, fs, repo, db) {
  if (err) return console.log(err);
  repo.name = "test";
  tree.addRepo(repo);
});

var width, height;
function onResize() {
  var newWidth = window.innerWidth;
  var newHeight = window.innerHeight;
  if (newWidth === width && newHeight === height) return;
  width = newWidth, height = newHeight;
  body.resize(width, height);
}


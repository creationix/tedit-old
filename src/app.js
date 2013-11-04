var platform = {
  sha1: require('git-sha1'),
  bops: require('bops-browser'),
  tcp: require('websocket-tcp-client').tcp,
  tls: require('websocket-tcp-client').tls,
  trace: function (name, stream, message) {
    if (stream) return stream;
    console.log(name, message);
  }
};

var git = {
  repo: require('js-git')(platform),
  remote: require('git-net')(platform),
  db: require('git-indexeddb')(platform)
};

var SplitView = require('./SplitView.js');
var Editor = require('./Editor.js');
var TreeView = require('./TreeView.js');
var LogView = require('./LogView.js');

var body, tree, editor;

body = new SplitView({
  el: document.body,
  orientation: "bottom",
  size: Math.min(200, window.innerHeight >> 1),
  main: new SplitView({
    orientation: "left",
    size: Math.min(200, window.innerWidth >> 1),
    main: editor = new Editor({
      "Ctrl-Enter": require('./run.js'),
      "Ctrl-S": function () { tree.stageChanges(); },
    }),
    side: tree = new TreeView(editor, git)
  }),
  side: new LogView()
});
window.addEventListener('resize', onResize, true);
onResize();

var width, height;
function onResize() {
  var newWidth = window.innerWidth;
  var newHeight = window.innerHeight;
  if (newWidth === width && newHeight === height) return;
  width = newWidth, height = newHeight;
  body.resize(width, height);
}


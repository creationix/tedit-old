var SplitView = require('./SplitView.js');
var Editor = require('./Editor.js');
var TreeView = require('./TreeView.js');
var LogView = require('./LogView.js');

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
platform.http = require('git-http')(platform);

var git = {
  repo: require('js-git')(platform),
  remote: require('git-net')(platform),
  db: require('git-indexeddb')(platform)
};

var body, tree, editor;

var zooms = [
  25, 33, 50, 67, 75, 90, 100, 110, 120, 125, 150, 175, 200, 250, 300, 400, 500
];

var index = zooms.indexOf(100);
var original = 16;
var size;
var width, height;

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
      "Ctrl-0": function (cm) {
        index = zooms.indexOf(100);
        setSize();
        cm.refresh();
      },
      "Ctrl-=": function (cm) {
        if (index >= zooms.length - 1) return;
        index++;
        setSize();
        cm.refresh();
      },
      "Ctrl--": function (cm) {
        if (index <= 0) return;
        index--;
        setSize();
        cm.refresh();
      }
    }),
    side: tree = new TreeView(editor, git)
  }),
  side: new LogView()
});
window.addEventListener('resize', onResize, true);
onResize();
setSize();

function onResize() {
  var newWidth = window.innerWidth;
  var newHeight = window.innerHeight;
  if (newWidth === width && newHeight === height) return;
  width = newWidth, height = newHeight;
  body.resize(width, height);
}

function setSize() {
  var old = size;
  size = zooms[index] * original / 100;
  if (old === size) return;
  document.body.style.fontSize = size + "px";
}

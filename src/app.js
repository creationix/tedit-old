var SplitView = require('./SplitView.js');
var Editor = require('./Editor.js');
var TreeView = require('./TreeView.js');
var LogView = require('./LogView.js');

module.exports = function (git) {

var prefs = git.prefs;

var body, tree, editor;

var zooms = [
  25, 33, 50, 67, 75, 90, 100, 110, 120, 125, 150, 175, 200, 250, 300, 400, 500
];
  
var index = prefs.get("zoomIndex", zooms.indexOf(100));
var original = 16;
var size;
var width, height;
var leftSize = prefs.get("leftSize", Math.min(200, window.innerWidth >> 1));
var bottomSize = prefs.get("bottomSize", Math.min(200, window.innerHeight >> 1));
var accessToken = prefs.get("accessToken");

body = new SplitView({
  el: document.body,
  orientation: "bottom",
  size: bottomSize,
  onResize: function (size) {
    if (size === bottomSize) return;
    bottomSize = size;
    prefs.set("bottomSize", bottomSize);
  },
  main: new SplitView({
    orientation: "left",
    size: leftSize,
    onResize: function (size) {
      if (size === leftSize) return;
      leftSize = size;
      prefs.set("leftSize", leftSize);
    },
    main: editor = new Editor({
      "Ctrl-Enter": require('./run.js'),
      "Ctrl-S": function () { tree.stageChanges(); },
      "Ctrl-0": function (cm) {
        index = zooms.indexOf(100);
        prefs.set("zoomIndex", index);
        setSize();
        cm.refresh();
      },
      "Ctrl-=": function (cm) {
        if (index >= zooms.length - 1) return;
        index++;
        prefs.set("zoomIndex", index);
        setSize();
        cm.refresh();
      },
      "Ctrl--": function (cm) {
        if (index <= 0) return;
        index--;
        prefs.set("zoomIndex", index);
        setSize();
        cm.refresh();
      }
    }, prefs),
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

};
var CodeMirror = require('./codemirror.js');
window.CodeMirror = CodeMirror;

module.exports = Editor;

var zooms = [
  25, 33, 50, 67, 75, 90, 100, 110, 120, 125, 150, 175, 200, 250, 300, 400, 500
];

function Editor(extraKeys) {
  var index = zooms.indexOf(100);
  var original = 16;
  var size;
  function setSize() {
    var old = size;
    size = zooms[index] * original / 100;
    if (old === size) return;
    document.body.style.fontSize = size + "px";
    cm.refresh();
  }
  extraKeys["Ctrl-0"] = function (cm) {
    index = zooms.indexOf(100);
    setSize();
  };
  extraKeys["Ctrl-="] = function (cm) {
    if (index >= zooms.length - 1) return;
    index++;
    setSize();
  };
  extraKeys["Ctrl--"] = function (cm) {
    if (index <= 0) return;
    index--;
    setSize();
  };
  this.el = document.createElement('div');
  var cm = this.cm = CodeMirror(this.el, {
    value: "",
    mode: "javascript",
    theme: "ambiance",
    // lineNumbers: true,
    extraKeys: extraKeys
  });
  setSize();
  this.entry = {};
}
Editor.prototype.resize = function (width, height) {
  this.el.style.width = width + "px";
  this.el.style.height = height + "px";
  this.cm.refresh();
  this.cm.focus();
};

Editor.prototype.swap = function (doc) {
  var old = this.cm.swapDoc(doc);
  return old;
};
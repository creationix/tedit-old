var CodeMirror = require('./codemirror.js');

module.exports = Editor;

function Editor(code, extraKeys) {
  var size, original;
  size = original = 17;
  extraKeys["Ctrl-0"] = function (cm) {
    size = original;
    document.body.style.fontSize = size + "px";
    cm.refresh();
  };
  extraKeys["Ctrl-="] = function (cm) {
    size *= 1.1;
    document.body.style.fontSize = size + "px";
    cm.refresh();
  };
  extraKeys["Ctrl--"] = function (cm) {
    size /= 1.1;
    document.body.style.fontSize = size + "px";
    cm.refresh();
  };
  document.body.style.fontSize = size + "px";
  this.el = document.createElement('div');
  this.cm = CodeMirror(this.el, {
    value: code,
    mode: "javascript",
    theme: "ambiance",
    autofocus: true,
    lineNumbers: true,
    extraKeys: extraKeys
  });
}
Editor.prototype.resize = function (width, height) {
  this.el.style.width = width + "px";
  this.el.style.height = height + "px";
  this.cm.refresh();
};

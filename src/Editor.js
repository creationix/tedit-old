var CodeMirror = require('./codemirror.js');

module.exports = Editor;

function Editor(code, extraKeys) {
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

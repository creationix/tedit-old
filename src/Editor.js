/*global URL*/
var CodeMirror = require('./codemirror.js');
var domBuilder = require('dombuilder');
var bops = require('bops-browser');
var getMime = require('./mime.js');
window.CodeMirror = CodeMirror;

module.exports = Editor;

function Editor(extraKeys) {
  domBuilder(["$el",
  ], this);
  var cm = this.cm = CodeMirror(this.el, {
    value: "",
    mode: "javascript",
    theme: "ambiance",
    // lineNumbers: true,
    extraKeys: extraKeys
  });
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
  this.cm.focus();
  return old;
};

Editor.prototype.newDoc = function (file) {
  var mime = getMime(file.name);

  if (/(?:\/json$|^text\/)/.test(mime)) {
    // Store the value as a string.
    file.value = bops.to(file.value);
    var doc = new CodeMirror.Doc(file.value, mime);
    doc.on('change', function () {
      file.onChange();
    });
    return doc;
  }
  if (/^image\//.test(mime)) {
    console.log("SHOW IMAGE", mime, file.value);
    return;
  }
  console.log("Unknown type " + mime);
};

Editor.prototype.showImage = function (file, mime) {
  var $ = {};
  var self = this;
  file.repo.loadAs("blob", file.hash, function (err, binary) {
    if (err) return file.onError(err);
    var blob = new Blob([binary], {type: mime});
    var url = URL.createObjectURL(blob);
    self.el.appendChild(domBuilder([
      [".shield.dark$shield", {onclick: closePreview}],
      [".preview$preview",
        ["img", {src: url}]
      ]
    ], $));

  });
  function closePreview(evt) {
    evt.preventDefault();
    evt.stopPropagation();
    self.el.removeChild($.shield);
    self.el.removeChild($.preview);
  }
};



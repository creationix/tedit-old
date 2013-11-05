/*global URL*/
var CodeMirror = require('./codemirror.js');
var domBuilder = require('dombuilder');
var bops = require('bops-browser');
var getMime = require('./mime.js');
window.CodeMirror = CodeMirror;

module.exports = Editor;

function Editor(extraKeys, prefs) {
  domBuilder(["$el",
    [".fill$cmEl"],
    [".fill.preview$imageEl", {
      css: { display: "none" },
      onclick: this.toggleTile.bind(this)
    }, [".fill$previewEl"]]
  ], this);
  this.cm = CodeMirror(this.cmEl, {
    value: prefs.get("scratchpad") || require('./welcome.js#txt'),
    mode: "javascript",
    theme: "ambiance",
    // lineNumbers: true,
    extraKeys: extraKeys
  });
  this.entry = {};
  // The transient global scratchpad.
  var scratchpad = this.scratchpad = this.cm.getDoc();
  scratchpad.on('change', function () {
    prefs.set("scratchpad", scratchpad.getValue());
  });
}
Editor.prototype.resize = function (width, height) {
  this.el.style.width = width + "px";
  this.el.style.height = height + "px";
  this.cm.refresh();
  this.cm.focus();
};

Editor.prototype.swap = function (doc) {
  if (doc === undefined) {
    doc = this.scratchpad;
  }
  if (doc instanceof CodeMirror.Doc) {
    if (this.imageDoc) {
      this.imageDoc = null;
      this.previewEl.style.backgroundImage = "";
      this.imageEl.style.display = "none";
      this.cmEl.style.display = "block";
    }
    this.cm.swapDoc(doc);
    this.cm.focus();
  }
  else {
    if (!this.imageDoc) {
      this.cmEl.style.display = "none";
      this.imageEl.style.display = "block";
    }
    this.imageDoc = doc;
    this.previewEl.style.backgroundImage = "url(" + doc.url + ")";
    if (doc.tiled) this.previewEl.classList.remove("zoom");
    else this.previewEl.classList.add("zoom");
  }
};

Editor.prototype.toggleTile = function () {
  var tiled = this.imageDoc.tiled = !this.imageDoc.tiled;
  if (tiled) this.previewEl.classList.remove("zoom");
  else this.previewEl.classList.add("zoom");
}

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
    var blob = new Blob([file.value], {type: mime});
    var value = file.value;
    return {
      getValue: function () { return value; },
      url: URL.createObjectURL(blob),
      tile: false
    };
  }
  console.log("Unknown type " + mime);
};



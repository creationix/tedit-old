var CodeMirror = require('./codemirror.js');
var domBuilder = require('dombuilder');
module.exports = TreeView;

/*
Nodes by path can contain

 - hash - the git hash of the staged or commited value
 - name - filename
 - mode - gitmode of entry
 - parent - reference to parent tree (if any)
 - staged - there are saved, but uncommited changes
 - dirty - the value doesn't match the hash (unsaved)
 - entries - cached entries for open trees (raw value from js-git)
 - doc - reference to the editor document
 - onchange - hook for gui code to update css classes

If you close a directory with dirty contents, it stages everything
dirty and then discards the non-folders and closed folders inside.


*/


  //     return fs.readAs("text", path, function (err, text) {
  //       reading = false;
  //       if (err) return console.log(err);
  //       doc = docs[path] = new CodeMirror.Doc(text, mime);
  //       doc.on('change', function (evt) {
  //         var newText = doc.getValue();
  //         console.log(entry.parent, entry.name, newText === text);
  //       });
  //       return swap();
  //     });

  //     function swap() {
  //       var old = editor.swap(doc);
  //       if (isNew) scratchpad = old;
  //     }



function TreeView(editor) {

  var selected;

  function Node(repo, mode, name, hash, parent) {
    this.repo = repo;
    // The gitmode should always be 040000 for Trees
    // and 0100644 or 0100755 for files.
    this.mode = mode;
    // The name of this entry within it's parent.
    this.name = name;
    // The hash of this entry in git.
    this.hash = hash;
    // A reference to the parent tree if any.
    this.parent = parent;
    // The raw body from js-git of what's stored in hash
    // Used for dirty checking.
    this.value = null;
    // The actual dirty flag
    this.dirty = false;
    // Build uio elements
    domBuilder(["li$el",
      ["$rowEl", { onclick: onClick(this) },
        ["i$iconEl"], ["span$nameEl"]
      ]
    ], this);
    this.updateUI();
  }

  Node.prototype.onError = function (err) {
    throw err;
  };

  Node.prototype.load = function (type) {
    var self = this;
    return this.repo.loadAs(type, this.hash, function (err, value) {
      if (err) return self.onError(err);
      self.value = value;
      return self.onClick();
    });
  };

  Node.prototype.updateUI = function () {
    var classes = ["row"];
    if (this.dirty) classes.push("dirty");
    if (this.mode & 0111) classes.push("executable");
    if (selected === this) classes.push("selected");
    this.rowEl.setAttribute('class', classes.join(" "));
    this.rowEl.setAttribute('title', this.hash);
    classes.length = 0;
    if (this.mode === 040000) {
      // Root tree gets a box icon since it represents the repo.
      if (!this.parent) classes.push("icon-box");
      // Tree nodes with children are open
      else if (this.children) classes.push("icon-folder-open");
      // Others are closed.
      else classes.push("icon-folder");
    }
    else if (this.mode === 0100644 || this.mode === 0100755) {
      var mime = getMime(this.name);
      if (/(?:\/json$|^text\/)/.test(mime)) {
        classes.push("icon-doc-text");
      }
      else if (/^image\//.test(mime)) {
        classes.push("icon-picture");
      }
      else if (/^video\//.test(mime)) {
        classes.push("icon-video");
      }
      else {
        classes.push("icon-doc");
      }
    }
    else {
      console.error("Invalid mode", this);
    }
    this.iconEl.setAttribute('class', classes.join(" "));
    this.nameEl.textContent = this.name;
  };

  function Tree(repo, mode, name, hash, parent) {
    Node.call(this, repo, mode, name, hash, parent);
    // The sub list for children
    this.el.appendChild(domBuilder(["ul$ul"], this));
    this.children = null;
  }
  Tree.prototype = Object.create(Node.prototype, {
    constructor: { value: Tree }
  });

  Tree.prototype.onClick = function () {
    if (!this.value) return this.load("tree");

    // If we're already open, we need to close the folder
    if (this.children) {
      // First remove all children of the ul.
      this.ul.textContent = "";
      // TODO walk children saving any outstanding changes.
      this.children = null;
      return this.updateUI();
    }

    var self = this;
    // Create UI instances for the children.
    this.children = this.value.map(function (entry) {
      var Constructor;
      if (entry.mode === 040000) Constructor = Tree;
      else if (entry.mode === 0100644 || entry.mode === 0100755) Constructor = File;
      else throw "TODO: Implement more mode types";
      return new Constructor(self.repo, entry.mode, entry.name, entry.hash, self);
    });
    // Put folders first.
    this.children.sort(folderFirst);
    this.ul.appendChild(domBuilder(this.children.map(getEl)));
    this.updateUI();
  };

  Tree.prototype.isDirty = function () {
    if (this.value === null) return false;
    if (this.children.length !== this.value.length) return true;
    var length = this.value.length;
    // TODO: sort children to match git sort order in cached value.
    for (var i = 0; i < length; i++) {
      var child = this.children[i];
      var entry = this.value[i];
      if (child.mode !== entry.mode) return true;
      if (child.name !== entry.name) return true;
      if (child.hash !== entry.hash) return true;
    }
    return false;
  };

  function File(repo, mode, name, hash, parent) {
    Node.call(this, repo, mode, name, hash, parent);
    // Reference to the editor instance
    this.doc = null;
  }
  File.prototype = Object.create(Node.prototype, {
    constructor: { value: File }
  });

  File.prototype.onClick = function () {
    if (!this.value) return this.load("text");

    if (!this.doc) {
      var mime = getMime(this.name);
      if (!/(?:\/json$|^text\/)/.test(mime)) {
        // TODO: open non code files
        return;
      }
      this.doc = new CodeMirror.Doc(this.value, mime);
      this.doc.on('change', this.onChange.bind(this));
    }

    var old;
    if (selected) old = selected;
    selected = this;
    if (old) old.updateUI();
    this.updateUI();
    editor.swap(this.doc);
  };

  File.prototype.onChange = function () {
    var dirty = this.value !== this.doc.getValue();
    if (dirty === this.dirty) return;
    this.dirty = dirty;
    this.updateUI();
  };

  File.prototype.isDirty = function () {
    if (this.value === null) return false;
    return this.value !== this.doc.getValue();
  };


  domBuilder([".tree$el", ["ul$ul"]], this);

  this.addRepo = function (repo) {
    var ul = this.ul;
    getRoot(repo, function (err, hash) {
      if (err) throw err;
      var root = new Tree(repo, 040000, repo.name, hash, null);
      ul.appendChild(root.el);
      // Auto-open tree
      root.onClick();
    });
  };
}


TreeView.prototype.resize = function (width, height) {
  this.el.style.width = width + "px";
  this.el.style.height = height + "px";
};


// Quick sort function that puts folders first by abusing their low mode value.
function folderFirst(a, b) {
  return a.mode - b.mode;
}

// Tiny mime library that helps us know which files we can edit and what icons to show.
var mimes = {
  "text/javascript": /\.js$/i,
  "text/css": /\.css$/i,
  "text/html": /\.html?$/i,
  "text/x-markdown": /\.(?:md|markdown)$/i,
  "text/xml": /\.(?:xml|svg)$/i,
  "text/typescript": /\.ts$/i,
  "application/json": /\.json$/i,
  "image/png": /\.png$/i,
  "image/jpeg": /\.jpe?g$/i,
  "image/gif": /\.gif$/i,
  "video/mpeg": /\.mpe?g$/i,
  "video/mp4": /\.(?:mp4|m4v)$/i,
  "video/ogg": /\.ogg$/i,
  "video/webm": /\.webm$/i,
  "application/zip": /\.zip$/i,
  "application/gzip": /\.(?:gz|tgz)$/i,
  "text/plain": /(?:^(?:README|LICENSE)|\.(?:txt|log)$)/i,
};

function getMime(path) {
  for (var mime in mimes) {
    if (mimes[mime].test(path)) return mime;
  }
  return "application/octet-stream";
}

function getEl(node) { return node.el; }

// Nice wrapper to route row clicks to click handler.
function onClick(node) {
  return function (evt) {
    evt.preventDefault();
    evt.stopPropagation();
    node.onClick();
  };
}

function getRoot(repo, callback) {
  return repo.readRef("tags/current", function (err, current) {
    if (err) return callback(err);
    if (current) return callback(null, current);
    return repo.loadAs("commit", "HEAD", function (err, head) {
      if (err) return callback(err);
      if (head) return callback(null, head.tree);
      return callback(new Error("No root at all"));
    });
  });
}
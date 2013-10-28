var domBuilder = require('dombuilder');
module.exports = TreeView;

/*
Nodes

 - repo - the js-git repo instance
 - path - path for matching with commit hashes
 - mode - gitmode of entry
 - name - filename
 - hash - the git hash of the staged or commited value
 - parent - reference to parent tree (if any)
 - staged - there are saved, but uncommited changes
 - children - cached entries for open trees (raw value from js-git)
 - doc - reference to the editor document

If you close a directory with dirty contents, it stages everything
dirty and then discards the non-folders and closed folders inside.
*/

function TreeView(editor) {

  // selected is a reference to the currently selected node
  // commitTree is a lookup of commit tree hashes for detecting staged changes.
  var selected, commitTree;

  this.saveCurrent = function () {
    if (!selected) return;
    var root = selected.parent;
    while (root.parent) root = root.parent;
    root.save(function () {
      root.repo.createRef("refs/tags/current", root.hash, function (err) {
        if (err) return root.onError(err);
      });
    });
  };

  // The transient global scratchpad.
  var scratchpad;

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
    // Calculate the path.
    this.path = parent ? parent.path + "/" + name : "";
    // The raw body from js-git of what's stored in hash
    // Used for dirty checking.
    this.value = null;
    // Build uio elements
    domBuilder(["li$el",
      ["$rowEl", { onclick: onClick(this) },
        ["i$iconEl"], ["span$nameEl"]
      ]
    ], this);
    this.onChange();
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

  Node.prototype.onChange = function () {
    var classes = ["row"];
    if (this.isDirty()) classes.push("dirty");
    if (this.mode & 0111) classes.push("executable");
    if (this.hash !== commitTree[this.path]) classes.push("staged");
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

  Tree.prototype.hasDirtyChildren = function () {
    for (var i = 0, l = this.children.length; i < l; i++) {
      var child = this.children[i];
      if (child.isDirty()) return true;
      if (child.children) {
        if (child.hasDirtyChildren()) return true;
      }
    }
    return false;
  };

  Tree.prototype.save = TreeSave;
  function TreeSave(callback) {
    if (!callback) return TreeSave.bind(this);
    var self = this;
    // No children means nothing to save.
    if (!this.children) return callback();
    var left = 1;
    this.children.forEach(function (child) {
      if (child.isDirty() || child.children) {
        left++;
        child.save(check);
      }
    });
    check();

    function check(err) {
      if (err) return self.emitError(err);
      if (--left) return;

      var value = self.children.map(function (child) {
        return { mode: child.mode, name: child.name, hash: child.hash };
      });

      if (!self.isDirty()) return callback();

      return self.repo.saveAs("tree", value, function (err, hash) {
        if (err) return self.onError(err);
        self.value = value;
        self.hash = hash;
        self.onChange();
        return callback();
      });
    }
  }

  Tree.prototype.onClick = function () {
    if (!this.value) return this.load("tree");

    // If we're already open, we need to close the folder
    if (this.children) {
      // If selected is a descendent, we can't close.
      var parent = selected && selected.parent;
      while (parent) {
        if (parent === this) return;
        parent = parent.parent;
      }
      // If there are any dirty descendents, we can't close.
      if (this.children && this.hasDirtyChildren()) return;

      // TODO walk children saving any outstanding changes.
      // First remove all children of the ul.
      this.ul.textContent = "";
      this.children = null;
      return this.onChange();
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
    this.onChange();
  };

  Tree.prototype.isDirty = function () {
    if (this.value === null || this.children === null) return false;
    var length = this.value.length;
    if (this.children.length !== length) return true;
    this.value.sort(byName);
    this.children.sort(byName);
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

  File.prototype.isDirty = function () {
    return this.doc && this.value !== null && this.value !== this.doc.getValue();
  };

  File.prototype.save = function (callback) {
    if (!this.isDirty()) return callback();
    var self = this;
    var value = this.doc.getValue();
    this.repo.saveAs("blob", value, function (err, hash) {
      if (err) return self.onError(err);
      self.value = value;
      self.hash = hash;
      self.onChange();
      return callback();
    });
  };

  File.prototype.onClick = function () {
    if (!this.value) return this.load("text");

    if (!this.doc) {
      var mime = getMime(this.name);
      if (!/(?:\/json$|^text\/)/.test(mime)) {
        // TODO: open non code files
        return;
      }
      // TODO: UTF-8 decode contents.
      this.doc = editor.newDoc(this.value, mime);
      this.doc.on('change', this.onChange.bind(this));
    }

    if (selected === this) {
      // Deselect a file reverting to the scratchpad
      selected = null;
      this.onChange();
      editor.swap(scratchpad);
    }
    else if (selected) {
      // Move selection to a new file
      var old = selected;
      selected = this;
      old.onChange();
      this.onChange();
      editor.swap(this.doc);
    }
    else {
      // Stash scratchpad and select a file
      selected = this;
      this.onChange();
      scratchpad = editor.swap(this.doc);
    }
  };


  domBuilder([".tree$el", ["ul$ul"]], this);

  this.addRepo = function (repo) {
    var ul = this.ul;
    getRoot(repo, function (err, hash, hashes) {
      if (err) throw err;
      commitTree = hashes;
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

// Sort using the same algorithm git uses internally to build trees
function byName(a, b) {
  a = a.name + "/";
  b = b.name + "/";
  return a < b ? -1 : a > b ? 1 : 0;
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
  // path-to-hash lookup for the latest commit.
  var commitTree = {};
  return repo.loadAs("commit", "HEAD", function (err, head) {
    if (err) return callback(err);
    return repo.readRef("refs/tags/current", function (err, current) {
      if (err) return callback(err);
      if (!head) return callback(null, current, commitTree);
      if (!current) return callback(new Error("No root at all"));
      return walk("", head.tree, function (err) {
        if (err) return callback(err);
        return callback(null, head.tree, commitTree);
      });
    });
  });


  function walk(path, hash, callback) {
    var done = false, left = 1;
    commitTree[path] = hash;
    repo.loadAs("tree", hash, function (err, tree) {
      if (err) return callback(err);
      tree.forEach(function (entry) {
        var childPath = path + "/" + entry.name;
        commitTree[childPath] = entry.hash;
        if (entry.mode !== 040000) return;
        left++;
        return walk(childPath, entry.hash, check);
      });
      check();
    });
    function check(err) {
      if (done) return;
      if (err) {
        done = true;
        return callback(err);
      }
      if (--left) return;
      done = true;
      return callback();
    }
  }

}
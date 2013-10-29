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

  this.stageChanges = stageChanges;
  function stageChanges() {
    if (!selected) return;
    var root = selected.parent;
    while (root.parent) root = root.parent;
    root.save(function () {
      root.repo.createRef("refs/tags/current", root.hash, function (err) {
        if (err) return root.onError(err);
      });
    });
  }

  // The transient global scratchpad.
  var scratchpad;

  function ContextMenu(node, evt, items) {
    if (node) {
      var old = selected;
      selected = node;
      if (old) old.onChange();
      node.onChange();
    }

    evt.preventDefault();
    evt.stopPropagation();
    var $ = {};

    var css = { left: evt.pageX + "px" };
    if (evt.pageY < window.innerHeight / 2) {
      css.top = evt.pageY + "px";
    }
    else {
      css.bottom = (window.innerHeight - evt.pageY) + "px";
    }
    var attrs = { css: css };
    document.body.appendChild(domBuilder([
      [".shield$shield", {onclick: closeMenu, oncontextmenu: closeMenu}],
      ["ul.contextMenu$ul", attrs, items.map(function (item) {
        if (item.sep) return ["li.sep", ["hr"]];
        var attrs = {};
        if (item.action) {
          attrs.onclick = function (evt) {
            item.action();
            closeMenu(evt);
          };
        }
        else {
          attrs.class = "disabled";
        }
        return ["li", attrs,
          ["i", {class: "icon-" + item.icon}],
          item.label
        ];
      })],
    ], $));

    this.close = closeMenu;
    function closeMenu(evt) {
      evt.preventDefault();
      evt.stopPropagation();
      document.body.removeChild($.ul);
      document.body.removeChild($.shield);
      $ = null;
      if (node) {
        selected = old;
        if (old) old.onChange();
        node.onChange();
      }
    }
  }


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
    this.el.js = this;
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
    if (!this.children) return false;
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
      // If there are any dirty descendents, we can't close.
      if (this.children && this.hasDirtyChildren()) return;

      // If selected is a deselect it.
      var parent = selected && selected.parent;
      while (parent) {
        if (parent === this) {
          var old = selected;
          old.onChange();
          editor.swap(scratchpad);
          selected = null;
          break;
        }
        parent = parent.parent;
      }

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

  Tree.prototype.onContextMenu = function (evt) {
    var items = [];
    if (this.hasDirtyChildren()) items.push({icon: "asterisk", label: "Stage all Changes", action: stageChanges});
    if (this.hash !== commitTree[this.path]) {
      items.push({icon: "plus-squared", label: "Commit Staged Changes"});
    }
    items.push({icon: "doc-text", label: "Create File"});
    items.push({icon: "folder", label: "Create Folder"});
    items.push({icon: "link", label: "Create SymLink"});
    items.push({icon: "edit", label: "Rename Folder"});
    items.push({sep:true});
    if (this.parent) {
      items.push({icon: "trash", label: "Delete Folder"});
    }
    else {
      if (this.remote) {
        items.push({icon: "upload-cloud", label: "Push Changes to Remote"});
        items.push({icon: "download-cloud", label: "Pull Changes from Remote"});
      }
      items.push({icon: "th-list", label: "View Commit History"});
      items.push({icon: "tags", label: "View Tags and Branches"});
      items.push({sep:true});
      items.push({icon: "trash", label: "Remove Repository"});
    }
    new ContextMenu(this, evt, items);
  };

  File.prototype.onContextMenu = function (evt) {
    var items = [];
    if (this.isDirty()) items.push({icon: "asterisk", label: "Stage All Changes", action: stageChanges});
    if (this.hash !== commitTree[this.path]) {
      items.push({icon: "plus-squared", label: "Commit Staged Changes"});
    }
    items.push({icon: "edit", label: "Rename File"});
    items.push({sep:true});
    items.push({icon: "trash", label: "Delete File"});
    new ContextMenu(this, evt, items);
  };

  this.onContextMenu = function (evt) {
    var items = [];
    items.push({icon: "box", label: "Create new local repository"});
    items.push({sep:true});
    items.push({icon: "github", label: "Clone from GitHub"});
    items.push({icon: "bitbucket", label: "Clone from BitBucket"});
    items.push({icon: "box", label: "Clone from custom URL"});
    new ContextMenu(null, evt, items);
  };

  domBuilder([".tree$el", ["ul$ul"]], this);

  this.el.js = this;

  var self = this;
  this.el.addEventListener('contextmenu', function (evt) {
    var target = evt.target;
    while (target) {
      if (target.js && target.js.onContextMenu) {
        return target.js.onContextMenu(evt);
      }
      if (target === self.el) return;
      target = target.parentElement;
    }
  }, false);

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
      current = current || head && head.tree;
      if (!current) return callback(new Error("No root at all"));
      if (!head) return callback(null, current, commitTree);
      return walk("", head.tree, function (err) {
        if (err) return callback(err);
        return callback(null, current, commitTree);
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
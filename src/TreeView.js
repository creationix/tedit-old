var domBuilder = require('dombuilder');
var getMime = require('./mime.js');
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

function TreeView(editor, git) {

  // selected is a reference to the currently selected node
  // commitTree is a lookup of commit tree hashes for detecting staged changes.
  var selected, commitTree;
  var username, email;

  function deselect() {
    var old = selected;
    old.onChange();
    editor.swap(scratchpad);
    selected = null;
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
            if (typeof item.action === "string") {
              item.action = node[item.action];
            }
            closeMenu(evt);
            item.action.call(node);
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
    if (!this.hash) {
      if (type === "tree") this.value = [];
      else this.value = "";
      return this.onClick();
    }
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
    this.nameEl.textContent = this.name;
    if (this.mode === 040000) {
      // Root tree gets a box icon since it represents the repo.
      if (!this.parent) {
        var url = this.repo.remote && this.repo.remote.href;
        if (/\bgithub\b/.test(url)) classes.push("icon-github");
        else if (/\bbitbucket\b/.test(url)) classes.push("icon-bitbucket");
        else classes.push("icon-box");
      }
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
    else if (this.mode === 0120000) {
      classes.push("icon-link");
      this.nameEl.appendChild(domBuilder(["span.target", this.target]));
    }
    else {
      console.error("Invalid mode", this);
    }
    this.iconEl.setAttribute('class', classes.join(" "));
  };

  Node.prototype.stageChanges = function () {
    // Find the root tree
    var root = this;
    while (root.parent) root = root.parent;
    root.save(function () {
      root.repo.createRef("refs/tags/current", root.hash, function (err) {
        if (err) return root.onError(err);
      });
    });
  };

  Node.prototype.createCommit = function () {

    // Get information from the user.
    username = username || prompt("Enter your name");
    if (!username) return;
    email = email || prompt("Enter your email");
    if (!email) return;
    var message = prompt("Enter commit message");
    if (!message) return;

    // Find the root tree
    var root = this;
    while (root.parent) root = root.parent;
    var repo = this.repo;


    repo.loadAs("commit", "HEAD", function (err, head, hash) {
      if (err) throw err;
      repo.saveAs("commit", {
        tree: root.hash,
        parent: hash,
        author: { name: username, email: email },
        message: message
      }, function (err, hash) {
        if (err) throw err;
        repo.updateHead(hash, function (err) {
          if (err) throw err;
        });
      });
    });
  };

  Node.prototype.renameSelf = function () {
    var name = prompt("Enter new name", this.name);
    if (!name || name === this.name) return;
    this.name = name;
    this.updatePath();
    this.parent.orderChildren();
    this.parent.onChange();
  };

  Node.prototype.updatePath = function () {
    this.path = this.parent.path + "/" + this.name;
    this.onChange();
    if (!this.children) return;
    this.children.forEach(function (child) {
      child.updatePath();
    });
  };

  Node.prototype.removeSelf = function () {
    if (this.isDirty() && !confirm("Are your sure you want to discard unstaged changes for " + this.path)) return;
    if (selected === this) deselect();
    else if (selected && this.children) this.clearChildren();
    this.parent.removeChild(this);
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

  Tree.prototype.save = function (callback) {
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

  Tree.prototype.clearChildren = function () {
    var parent = selected && selected.parent;
    while (parent) {
      if (parent === this) {
        deselect();
        break;
      }
      parent = parent.parent;
    }
  };

  Tree.prototype.onClick = function () {
    if (this.value === null) return this.load("tree");

    // If we're already open, we need to close the folder
    if (this.children) {
      // If there are any dirty descendents, we can't close.
      if (this.isDirty() || this.children && this.hasDirtyChildren()) return;

      // If selected is a deselect it.
      this.clearChildren();

      // TODO walk children saving any outstanding changes.
      // First remove all children of the ul.
      this.ul.textContent = "";
      this.children = null;
      return this.onChange();
    }

    var self = this;
    // Create UI instances for the children.
    this.children = this.value.map(function (entry) {
      return self.childFromEntry(entry);
    });
    // Put folders first.
    this.orderChildren();
    this.onChange();
  };

  Tree.prototype.orderChildren = function () {
    this.children.sort(folderFirst);
    this.ul.textContent = "";
    this.ul.appendChild(domBuilder(this.children.map(getEl)));
  };

  Tree.prototype.childFromEntry = function (entry) {
    var Constructor;
    if (entry.mode === 040000) Constructor = Tree;
    else if (entry.mode === 0100644 || entry.mode === 0100755) Constructor = File;
    else if (entry.mode === 0120000) Constructor = SymLink;
    else throw "TODO: Implement more mode types";
    return new Constructor(this.repo, entry.mode, entry.name, entry.hash, this);
  };

  Tree.prototype.addChild = function (child) {
    this.children.push(child);
    this.orderChildren();
    this.onChange();
    child.onClick();
  };

  Tree.prototype.removeChild = function (child) {
    var index = this.children.indexOf(child);
    if (index < 0) return;
    this.children.splice(index, 1);
    this.orderChildren();
    this.onChange();
  };

  Tree.prototype.createFile = function () {
    var name = prompt("Enter name for new file");
    if (!name) return;
    var child = this.childFromEntry({
      mode: 0100644,
      name: name,
      hash: undefined
    });
    this.addChild(child);
  };

  Tree.prototype.createFolder = function () {
    var name = prompt("Enter name for new folder");
    if (!name) return;
    var child = this.childFromEntry({
      mode: 040000,
      name: name,
      hash: undefined
    });
    this.addChild(child);
  };

  Tree.prototype.createSymLink = function () {
    var name = prompt("Enter name for the new symlink");
    if (!name) return;

    var child = this.childFromEntry({
      mode: 0120000,
      name: name,
      hash: undefined
    });
    this.addChild(child);
  };

  Tree.prototype.isDirty = function () {
    if (!this.hash) return true;
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

  Tree.prototype.onContextMenu = function (evt) {
    var items = [];
    var dirty = this.isDirty() || this.hasDirtyChildren();
    if (dirty) items.push({icon: "asterisk", label: "Stage all Changes", action: "stageChanges"});
    if (this.hash !== commitTree[this.path]) {
      items.push({icon: "plus-squared", label: "Commit Staged Changes", action: "createCommit"});
    }
    if (this.children) {
      items.push({icon: "doc-text", label: "Create File", action: "createFile"});
      items.push({icon: "folder", label: "Create Folder", action: "createFolder"});
      items.push({icon: "link", label: "Create SymLink", action: "createSymLink"});
    }
    if (this.parent) {
      items.push({icon: "edit", label: "Rename Folder", action: "renameSelf"});
    }
    if (this.parent) {
      if (!dirty) {
        items.push({sep:true});
        items.push({icon: "trash", label: "Delete Folder", action: "removeSelf"});
      }
    }
    else {
      items.push({sep:true});
      if (this.repo.remote) {
        items.push({icon: "upload-cloud", label: "Push Changes to Remote"});
        items.push({icon: "download-cloud", label: "Pull Changes from Remote"});
      }
      else {
        items.push({icon: "upload-cloud", label: "Set remote url", action: "setRemote"});
      }
      items.push({icon: "th-list", label: "View Commit History"});
      items.push({icon: "tags", label: "View Tags and Branches"});
      items.push({sep:true});
      items.push({icon: "trash", label: "Remove Repository"});
    }
    new ContextMenu(this, evt, items);
  };

  Tree.prototype.setRemote = function () {
    var url = prompt("Enter remote git url", this.repo.remote && this.repo.remote.href);
    if (!url) return;
    this.repo.remote = git.remote(url);
    this.onChange();
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
    return !this.hash || this.doc && this.value !== null && this.value !== this.doc.getValue();
  };

  File.prototype.save = function (callback) {
    if (!this.isDirty()) return callback();
    var self = this;
    // UTF-8 Encode the value
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
    if (this.value === null) return this.load("blob");
    if (!this.doc) {
      this.doc = editor.newDoc(this);
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

  File.prototype.onContextMenu = function (evt) {
    var items = [];
    var dirty = this.isDirty();
    if (dirty) items.push({icon: "asterisk", label: "Stage All Changes", action: "stageChanges"});
    if (this.hash !== commitTree[this.path]) {
      items.push({icon: "plus-squared", label: "Commit Staged Changes", action: "createCommit"});
    }
    items.push({icon: "edit", label: "Rename File", action: "renameSelf"});
    items.push({icon: "asterisk", label: "Toggle Executable", action: "toggleExec"});
    items.push({sep:true});
    items.push({icon: "trash", label: "Delete File", action: "removeSelf"});
    new ContextMenu(this, evt, items);
  };

  File.prototype.toggleExec = function () {
    this.mode = this.mode === 0100755 ? 0100644 : 0100755;
    this.onChange();
    this.parent.onChange();
  };

  function SymLink(repo, mode, name, hash, parent) {
    Node.call(this, repo, mode, name, hash, parent);
    var self = this;
    if (hash) repo.loadAs("text", hash, function (err, target) {
      if (err) return self.onError(err);
      self.value = self.target = target;
      self.onChange();
    });
  }
  SymLink.prototype = Object.create(Node.prototype, {
    constructor: { value: SymLink }
  });

  SymLink.prototype.isDirty = function () {
    if (!this.hash) return true;
    return this.value && this.target && this.value !== this.target;
  };

  SymLink.prototype.onClick = function () {
    var target = prompt("Update symlink target", this.target);
    if (!target) return;
    this.target = target;
    this.onChange();
  };

  SymLink.prototype.save = function (callback) {
    if (!this.isDirty()) return callback();
    var self = this;
    var target = this.target;
    this.repo.saveAs("blob", target, function (err, hash) {
      if (err) return self.onError(err);
      self.value = target;
      self.hash = hash;
      self.onChange();
      return callback();
    });
  };

  SymLink.prototype.onContextMenu = function (evt) {
    var items = [];
    var dirty = this.isDirty();
    if (dirty) items.push({icon: "asterisk", label: "Stage All Changes", action: "stageChanges"});
    if (this.hash !== commitTree[this.path]) {
      items.push({icon: "plus-squared", label: "Commit Staged Changes", action: "createCommit"});
    }
    items.push({icon: "edit", label: "Rename SymLink", action: "renameSelf"});
    items.push({sep:true});
    items.push({icon: "trash", label: "Delete SymLink", action: "removeSelf"});
    new ContextMenu(this, evt, items);
  };


  this.onContextMenu = function (evt) {
    var items = [];
    items.push({icon: "box", label: "Create new local repository", action: createRepo});
    items.push({icon: "box", label: "Clone from remote Repository", action: cloneRepo});
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

  // Hook for Control-S shortcut in editor.
  this.stageChanges = function () {
    if (!selected) return;
    selected.stageChanges();
  };

  function createRepo() {
    var name = prompt("Enter name for new repo");
    if (!name) return;
    var db = git.db(name);
    db.init(function (err) {
      if (err) throw err;
      var repo = git.repo(db);
      repo.name = name;
      addRepo(repo);
    });
  }

  function cloneRepo() {
    var url = prompt("Enter git url to clone");
    if (!url) return;
    var remote;
    remote = git.remote(url);
    var name = prompt("Enter local name", remote.pathname.replace(/\.git$/, '').replace(/^\//, ''));
    if (!name) return;
    var db = git.db(name);
    db.init(function (err) {
      if (err) throw err;
      var repo = git.repo(db);
      console.log("Cloning " + remote.href + " to " + name + "...");
      repo.fetch(remote, {}, function (err) {
        if (err) throw err;
        repo.name = name;
        repo.remote = remote;
        addRepo(repo);
      });
    });
  }

  function addRepo(repo) {
    getRoot(repo, function (err, hash, hashes) {
      if (err) throw err;
      commitTree = hashes;
      var root = new Tree(repo, 040000, repo.name, hash, null);
      self.ul.appendChild(root.el);
      // Auto-open tree
      root.onClick();
    });
  }
}

TreeView.prototype.resize = function (width, height) {
  this.el.style.width = width + "px";
  this.el.style.height = height + "px";
};

// Quick sort function that puts folders first by abusing their low mode value.
function folderFirst(a, b) {
  if (a.mode !== b.mode) return a.mode - b.mode;
  // Fallback to sorted by name.
  return byName(a, b);
}

// Sort using the same algorithm git uses internally to build trees
function byName(a, b) {
  a = a.name + "/";
  b = b.name + "/";
  return a < b ? -1 : a > b ? 1 : 0;
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

function walkCommitTree(repo, root, callback) {
  var commitTree = {};
  return walk("", root, function (err) {
    if (err) return callback(err);
    return callback(null, commitTree);
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

function getRoot(repo, callback) {
  // path-to-hash lookup for the latest commit.
  return repo.loadAs("commit", "HEAD", function (err, head) {
    if (err) return callback(err);
    return repo.readRef("refs/tags/current", function (err, current) {
      if (err) return callback(err);
      current = current || head && head.tree;
      if (!current) {
        return repo.saveAs("tree", [], function (err, current) {
          repo.createRef("refs/tags/current", current, function (err) {
            if (err) return callback(err);
            return callback(null, current, {});
          });
        });
      }
      if (!head) return callback(null, current, {});
      walkCommitTree(repo, head.tree, function (err, commitTree) {
        if (err) return callback(err);
        return callback(null, current, commitTree);
      });
    });
  });
}

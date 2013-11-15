var domBuilder = require('dombuilder');
var getMime = require('./mime.js');
var githubConfig = require('./github-config.js');
var XHR = require('js-github/src/xhr.js');
var githubRepo = require('js-github');
var progressParser = require('./progress-parser.js');

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
  var prefs = git.prefs;

  window.onbeforeunload = function () {
    if (selected && selected.isDirty()) return 'You have unsaved changes!';
  };

  // selected is a reference to the currently selected node
  var selected;
  var username = prefs.get("name"), email = prefs.get("email");
  var accessToken = prefs.get("accessToken");
  var request = accessToken ? XHR("", accessToken) : null;

  // List of local repos.  key is name
  //   url -  value is remote url (may be null)
  //   opened - hash of paths of opened folders.
  var repos = prefs.get("repos", {});
  if (Array.isArray(repos) || !repos || typeof repos !== "object") repos = {};

  function deselect() {
    var old = selected;
    old.onChange();
    editor.swap();
    selected = null;
  }

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
            try {
              item.action.call(node);
            }
            catch (err) {
              console.log(err);
            }
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
    this.hash = this.originalHash = hash;
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

  Node.prototype.isStaged = function () {
    return this.hash !== this.originalHash;
  };

  Node.prototype.onChange = function (recurse) {
    var title = this.path;
    var classes = ["row"];
    if (this.isDirty()) {
      title += " (dirty)";
      classes.push("dirty");
    }
    if (this.isStaged()) {
      title += " (staged)";
      classes.push("staged");
    }
    if (selected === this) classes.push("selected");
    this.rowEl.setAttribute('class', classes.join(" "));
    classes.length = 0;
    if (!this.parent) {
      var meta = repos[this.repo.name];
      var url = this.repo.remote && this.repo.remote.href;
      if (meta.github) url = "github://" + meta.github;
      title = url + title;
      if (/\bgithub\b/.test(url)) classes.push("icon-github");
      else if (/\bbitbucket\b/.test(url)) classes.push("icon-bitbucket");
      else if (url) classes.push("icon-box");
    }
    if (this.mode & 0111) {
      classes.push("executable");
      title += " (executable)";
    }
    this.nameEl.textContent = this.name;
    this.nameEl.setAttribute('class', classes.join(" "));
    this.nameEl.setAttribute('title', title);
    classes.length = 0;
    if (this.mode === 040000) {
      // Root tree gets a box icon since it represents the repo.
      if (!this.parent) {
        if (this.children) classes.push("icon-book-open");
        else classes.push("icon-book");
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
    this.iconEl.setAttribute('title', this.hash);
    if (recurse && this.children) {
      this.children.forEach(function (child) {
        child.onChange(true);
      });
    }
  };

  Node.prototype.stageChanges = function () {
    // Find the root tree
    var root = this;
    while (root.parent) root = root.parent;
    root.save(function () {
      if (root.hash === root.current) return;
      root.repo.updateRef("refs/tags/current", root.hash, function (err) {
        if (err) return root.onError(err);
        root.current = root.hash;
      });
    });
  };

  Node.prototype.createCommit = function () {

    // Get information from the user.
    var message = prompt("Enter commit message");
    if (!message) return;
    var repo = this.repo;

    if (!repo.github) {
      if (!username) {
        username = username || prompt("Enter your name");
        if (!username) return;
        prefs.set("name", username);
      }
      if (!email) {
        email = email || prompt("Enter your email");
        if (!email) return;
        prefs.set("email", email);
      }
    }

    // Find the root tree
    var root = this;
    while (root.parent) root = root.parent;

    repo.loadAs("commit", "HEAD", function (err, head, hash) {
      if (err) throw err;
      repo.saveAs("commit", {
        tree: root.hash,
        parent: hash,
        author: repo.github ? undefined : { name: username, email: email },
        message: message
      }, function (err, hash) {
        if (err) throw err;
        repo.updateHead(hash, function (err) {
          if (err) throw err;
          root.onChange(true);
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

  function Tree(repo, mode, name, hash, parent, originalHash) {
    Node.call(this, repo, mode, name, hash, parent);
    if (originalHash) this.originalHash = originalHash;
    // The sub list for children
    this.el.appendChild(domBuilder(["ul$ul"], this));
    this.children = null;
    if (repos[repo.name].opened[this.path]) this.onClick();

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
  };

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
      // If selected is a descendent, deselect it.
      this.clearChildren();

      // If there are any dirty descendents, we can't close.
      if (this.isDirty() || this.children && this.hasDirtyChildren()) {
        this.stageChanges();

        return;
      }


      // TODO walk children saving any outstanding changes.
      // First remove all children of the ul.
      this.ul.textContent = "";
      this.children = null;
      delete repos[this.repo.name].opened[this.path];
      prefs.set("repos", repos);
      return this.onChange();
    }

    var self = this;
    // Create UI instances for the children.
    this.children = this.value.map(function (entry) {
      return self.childFromEntry(entry);
    });
    // Put folders first.
    this.orderChildren();
    repos[this.repo.name].opened[this.path] = true;
    prefs.set("repos", repos);
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
    var items = nodeMenu(this), group = [];
    if (this.children) {
      group.push({icon: "doc-text", label: "Create File", action: "createFile"});
      group.push({icon: "folder", label: "Create Folder", action: "createFolder"});
      group.push({icon: "link", label: "Create SymLink", action: "createSymLink"});
    }
    addSection(items, group);
    if (this.parent) {
      group.push({icon: "pencil", label: "Rename Folder", action: "renameSelf"});
      if (!(this.isDirty() || this.hasDirtyChildren())) {
        group.push({icon: "trash", label: "Delete Folder", action: "removeSelf"});
      }
    }
    else {
      if (this.remote) {
        if (this.repo.fetchPack) {
          group.push({icon: "download-cloud", label: "Fetch new objects from remote", action: "fetchPack"});
        }
        if (this.repo.sendPack()) {
          group.push({icon: "upload-cloud", label: "Send new objects to remote", action: "sendPack"});
        }
      }
      else {
        if (this.repo.fetchPack || this.repo.sendPack) {
          group.push({icon: "upload-cloud", label: "Set remote", action: "setRemote"});
        }
      }
      group.push({icon: "th-list", label: "View Commit History"});
      group.push({icon: "tags", label: "View Tags and Branches"});
      addSection(items, group);
      group.push({icon: "trash", label: "Remove Repository", action: "removeRepo"});
    }
    addSection(items, group);
    new ContextMenu(this, evt, items);
  };

  Tree.prototype.removeRepo = function () {
    removeRepo(this);
  };

  Tree.prototype.setRemote = function () {
    var url = prompt("Enter remote git url", this.repo.remote && this.repo.remote.href);
    if (!url) return;
    this.repo.remote = git.remote(url);
    repos[this.name] = url;
    prefs.set("repos", repos);
    this.onChange();
  };

  Tree.prototype.pull = function () {
    // TODO: warn about non-fast-forward updates loosing changes.
    var tree = this;
    tree.clearChildren();
    this.repo.fetch(this.repo.remote, {}, function (err, refs) {
      if (err) return tree.onError(err);
      tree.repo.loadAs("commit", refs.HEAD, function (err, head) {
        if (err) return tree.onError(err);
        tree.repo.updateRef("refs/tags/current", head.tree, function (err) {
          if (err) return tree.onError(err);
          tree.current = head.tree;
          getRoot(tree.repo, function (err, hash) {
            if (err) throw err;
            var root = new Tree(tree.repo, 040000, tree.repo.name, hash, null);
            self.ul.replaceChild(root.el, tree.el);
          });
        });
      });
    });
  };

  Tree.prototype.push = function () {
    var tree = this;
    this.repo.push(this.repo.remote, {}, function (err) {
      if (err) return tree.onError(err);
    });
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
      this.stageChanges();
      selected = null;
      this.onChange();
      editor.swap();
    }
    else if (selected) {
      // Move selection to a new file
      var old = selected;
      old.stageChanges();
      selected = this;
      old.onChange();
      this.onChange();
      editor.swap(this.doc);
    }
    else {
      // Stash scratchpad and select a file
      selected = this;
      this.onChange();
      editor.swap(this.doc);
    }
  };

  File.prototype.onContextMenu = function (evt) {
    var items = nodeMenu(this), group = [];
    group.push({icon: "pencil", label: "Rename File", action: "renameSelf"});
    group.push({icon: "asterisk", label: "Toggle Executable", action: "toggleExec"});
    addSection(items, group);
    group.push({icon: "trash", label: "Delete File", action: "removeSelf"});
    addSection(items, group);
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
    var items = nodeMenu(this), group = [];
    group.push({icon: "pencil", label: "Rename SymLink", action: "renameSelf"});
    addSection(items, group);
    group.push({icon: "trash", label: "Delete SymLink", action: "removeSelf"});
    addSection(items, group);
    new ContextMenu(this, evt, items);
  };


  this.onContextMenu = function (evt) {
    var items = [];
    items.push({icon: "box", label: "Create new local repository", action: createRepo});
    items.push({icon: "box", label: "Clone from remote Repository", action: cloneRepo});
    if (accessToken) {
      items.push({icon: "github", label: "Mount public github repository", action: mountRepo});
    }
    new ContextMenu(null, evt, items);
  };

  domBuilder(["$el",
    [".tree",
      ["ul$ul"],
    ],
    ["$authButtons", { css: {
      position: "absolute",
      bottom: 0,
      right: 0
    }}, accessToken ? renderLogout() : renderLogin()]
  ], this);

  function renderLogin() {
    return [
      ["button", {
        onclick: startOauth,
        title: "Use this to authenticate with server-assisted oauth2"
      }, "Github Oauth"],
      ["button", {
        onclick: enterToken,
        title: "Manually create a 'Personal Access Token' and enter it here"
      }, "Enter Token"]
    ];
  }

  function renderLogout() {
    return ["button", {
      onclick: clearToken,
      title: "Forget the saved github access token"
    }, "Forget Auth"];
  }

  function loginAuth() {
    prefs.set("accessToken", accessToken);
    request = XHR("", accessToken);
    console.log("Stored Access Token");
    self.authButtons.textContent = "";
    self.authButtons.appendChild(domBuilder(renderLogout()));
  }

  function clearToken() {
    accessToken = null;
    request = null;
    githubLogin = null;
    prefs.set("accessToken", accessToken);
    console.log("Forgot Access Token");
    self.authButtons.textContent = "";
    self.authButtons.appendChild(domBuilder(renderLogin()));
  }

  function startOauth(evt) {
    evt.preventDefault();
    evt.stopPropagation();
    window.addEventListener("message", onMessage, false);

    function onMessage(evt) {
      window.removeEventListener("message", onMessage, false);
      var tmp = document.createElement('a');
      tmp.href = evt.origin;
      if (tmp.hostname !== window.location.hostname) return;
      accessToken = evt.data.access_token;
      if (accessToken) loginAuth();
      else throw new Error("Problem getting oauth: " + JSON.stringify(evt.data));
    }
    window.open("https://github.com/login/oauth/authorize" +
      "?client_id=" + githubConfig.clientId +
      "&redirect_uri=" + githubConfig.redirectUri +
      "&scope=public_repo");

  }

  function enterToken(evt) {
    evt.preventDefault();
    evt.stopPropagation();
    accessToken = prompt("Enter access token from https://github.com/settings/applications");
    if (!accessToken) return;
    loginAuth();
  }

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

  setTimeout(function () {
    Object.keys(repos).forEach(function (name) {
      livenRepo(name, repos[name]);
    });
  }, 0);

  function createRepo() {
    var name;
    do {
      name = prompt("Enter name for new repo");
      if (!name) return;
    } while (name in repos);
    livenRepo(name, {
      currentTree: null,
      lastCommit: null
    });
  }

  var githubLogin = null;
  function mountRepo() {
    if (!githubLogin) return request("GET", "/user", onUser);
    function onUser(err, result) {
      if (err) throw err;
      githubLogin = result.login;
      return mountRepo();
    }
    var root = prompt("Enter username/project", githubLogin + "/");
    if (!root) return;
    var name = root;
    var n = 1;
    while (name in repos) {
      name = root + "-" + n++;
    }
    return request("GET", "/repos/" + root, onRepo);
    function onRepo(err, result) {
      if (err) throw err;
      livenRepo(name, {
        github:root,
        description: result.description,
      });
    }
  }

  function cloneRepo() {
    var url = prompt("Enter git url to clone");
    if (!url) return;
    var remote = git.remote(url);
    var name;
    do {
      name = prompt("Enter local name", remote.pathname.replace(/\.git$/, '').replace(/^\//, ''));
      if (!name) return;
    } while (name in repos);
    livenRepo(name, {
      url: url,
      clone: true
    });
  }

  function removeRepo(tree) {
    if (!confirm("Are you sure you want to remove '" + tree.repo.name + "'?")) return;
    tree.repo.db && tree.repo.db.clear(function (err) {
      if (err) throw err;
    });
    tree.clearChildren();
    self.ul.removeChild(tree.el);
    delete repos[tree.repo.name];
    prefs.set("repos", repos);
  }

  function livenRepo(name, meta) {
    var changed = false, repo;
    // Meta needs to be an object.
    if (Array.isArray(meta) || typeof meta !== "object") meta = {};
    // url, github, currentTree, and lastCommit need to be strings or not there
    if (meta.url && typeof meta.url !== "string") {
      delete meta.url;
      changed = true;
    }
    if (meta.github && typeof meta.github !== "string") {
      delete meta.github;
      changed = true;
    }
    if (meta.currentTree && typeof meta.currentTree !== "string") {
      delete meta.currentTree;
      changed = true;
    }
    if (meta.lastCommit && typeof meta.lastCommit !== "string") {
      delete meta.lastCommit;
      changed = true;
    }
    // meta.opened needs to be an object
    if (!meta.opened || Array.isArray(meta.opened) || typeof meta.opened !== "object") {
      meta.opened = {"":true};
      changed = true;
    }
    if (meta.name !== name) {
      meta.name = name;
      changed = true;
    }
    if (repos[name] !== meta) {
      repos[name] = meta;
      changed = true;
    }

    // Create mounted github repos.
    if (meta.github) {
      if (!accessToken) {
        console.error("Can't mount github repo without access token");
        return;
      }
      repo = githubRepo(meta.github, accessToken);
      return findHead();
    }

    // Create or load local database
    var db = git.db(name);
    return db.init(function (err) {
      if (err) throw err;
      repo = git.repo(db);
      return findHead();
    });

    function findHead() {
      repo.name = name;
      meta.name = name;
      if (meta.url) repo.remote = git.remote(meta.url);

      if (!meta.clone) return findCommit();

      delete meta.clone;
      // TODO: rename repo.fetch to repo.clone
      var last = Date.now();
      return repo.fetch(repo.remote, {
        onProgress: progressParser(function (message, num, max) {
          var now = Date.now();
          if (now - last > 100 || !max || num === max) {
            if (max) message += " (" + num + "/" + max + ")";
            console.log(message);
            last = now;
          }
        })
      }, function (err, refs) {
        if (err) throw err;
        meta.lastCommit = refs.HEAD;
        changed = true;
        findCommit();
      });
    }

    function findCommit() {

      // If the lastCommit is unknown, assume HEAD
      if (meta.lastCommit || meta.lastCommit === undefined) {
        return repo.loadAs("commit", meta.lastCommit || "HEAD", onCommit);
      }
      return onCommit();
    }

    function onCommit(err, commit, hash) {
      if (err) throw err;
      var originalTree = commit ? commit.tree : null;
      if (meta.lastCommit === undefined && hash) {
        changed = true;
        meta.lastCommit = hash;
      }
      if (meta.currentTree === undefined) {
        changed = true;
        meta.currentTree = originalTree;
      }
      if (changed) prefs.set("repos", repos);
      var root = new Tree(repo, 040000, name, meta.currentTree, null, originalTree);
      self.ul.appendChild(root.el);
    }
  }

  // function addRepo(meta, repo, commitTree) {
  // }
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
    try {
      node.onClick();
    }
    catch(err) {
      console.log(err);
    }
  };
}

function getRoot(repo, callback) {
  // path-to-hash lookup for the latest commit.
  return repo.loadAs("commit", "HEAD", function (err, head) {
    if (err) return callback(err);
    return repo.readRef("refs/tags/current", function (err, current) {
      if (err) return callback(err);
      if (!current && head) {
        current = head.tree;
        repo.createRef("refs/tags/current", current, function (err) {
          if (err) throw err;
        });
      }

      if (!current) {
        return repo.saveAs("tree", [], function (err, current) {
          repo.updateRef("refs/tags/current", current, function (err) {
            if (err) return callback(err);
            return callback(null, current, {});
          });
        });
      }
      if (!head) return callback(null, current, {});
      return callback(null, current);
    });
  });
}

// Tiny helper to make menu generation code cleaner
function addSection(items, group) {
  if (!group.length) return;
  if (items.length) items.push({sep: true});
  items.push.apply(items, group);
  group.length = 0;
}

function nodeMenu(node) {
  var items = [];
  if (node.isDirty()) {
    items.push({icon: "asterisk", label: "Stage All Changes", action: "stageChanges"});
  }
  if (node.isStaged()) {
    items.push({icon: "plus-squared", label: "Commit Staged Changes", action: "createCommit"});
  }
  return items;
}


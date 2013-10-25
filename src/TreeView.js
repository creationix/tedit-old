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

function Node(mode, name, hash, parent, onChange) {
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
  // A callback function for the UI to update it's state.
  this.onChange = onChange;
}

Node.prototype.update = function () {
  var isDirty = this.isDirty();
  if (isDirty !== this.dirty) {
    this.dirty = isDirty;
    this.onChange();
  }
  if (this.parent) this.parent.update();
};

function Tree(mode, name, hash, parent, onChange) {
  Node.call(this, mode, name, hash, parent, onChange);
  // References to the child nodes.
  this.children = null;
}
Tree.prototype = Object.create(Node.prototype, {
  constructor: { value: Tree }
});

Tree.prototype.type = "tree";

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

function File(mode, name, hash, parent, onChange) {
  Node.call(this, mode, name, hash, parent, onChange);
  // Reference to the editor instance
  this.doc = null;
}
File.prototype = Object.create(Node.prototype, {
  constructor: { value: File }
});

File.prototype.type = "text";

File.prototype.isDirty = function () {
  if (this.value === null) return false;
  return this.value !== this.doc.getValue();
};




function TreeView(fs, editor) {

  // Place to store the tree.  Indexed by path.
  // node.opened - boolean telling if folder should auto-open when created.
  // node.doc - editor document for code file
  // node.dirty - boolean telling if there are unstaged changes
  // node.staged - boolean telling if there are staged, but uncommited changes
  var nodes = { "": { opened: true } };
  
  var opened = { "": true };
  var docs = {};

  // This is a reference to the currently selected node
  var selected;
  
  // A simple semaphore to make sure that only one async operation happens at once.
  // This is used for quick operations like reading a directory or file's contents.
  var reading = false;
  
  // There is a virtual document that's transient and shown when no file is selected.
  // This is a reference to it's doc.
  var scratchpad;

  // Render the tree with a single repo as the root.
  this.el = domBuilder([".tree", ["ul",
    renderTree({ root: fs.name })
  ]]);

  function renderTree(entry) {
    var $ = {};
    var name, path, openIcon, closeIcon;
    if (entry.root) {
      name = entry.root;
      path = "";
      openIcon = "icon-box";
      closeIcon = "icon-box";
    }
    else {
      name = entry.name;
      path = entry.parent + "/" + name;
      openIcon = "icon-folder-open";
      closeIcon = "icon-folder";
    }

    var node = domBuilder(["li",
      [".row$row", { onclick: event(toggle) },
        ["i$icon", { class: closeIcon }], name
      ],
      ["ul$ul"]
    ], $);

    if (opened[path]) {
      opened[path] = !opened[path];
      toggle();
    }

    return node;

    function toggle() {
      if (reading) return;
      opened[path] = !opened[path];
      if (opened[path]) {
        $.icon.setAttribute('class', openIcon);
        reading = setTimeout(function () {
          $.ul.appendChild(domBuilder(["li", "Loading..."]));
        }, 300);
        return fs.readAs("tree", path, onTree);
      }
      $.icon.setAttribute('class', closeIcon);
      $.ul.textContent = "";
    }

    function onTree(err, entries, tree) {
      $.ul.textContent = "";
      clearTimeout(reading);
      reading = false;
      if (err) {
        $.ul.appendChild(domBuilder(["li.error", err.toString()]));
        return;
      }
      $.row.setAttribute("title", tree.hash);
      entries.sort(folderFirst);
      $.ul.appendChild(domBuilder(entries.map(mapEntry)));
    }
  }

  function mapEntry(entry) {
    if (entry.mode === 040000) return renderTree(entry);
    if (entry.mode === 0100644 || entry.mode === 0100755) {
      return renderFile(entry);
    }
    if (entry.mode === 0120000) return renderSymLink(entry);
    if (entry.mode === 0160000) return renderGitLink(entry);
    return ["li.error", "Unknown mode 0" + entry.mode.toString(8)];
  }

  function renderFile(entry) {
    var path = entry.parent + "/" + entry.name;
    var $ = { path: path };
    var mime = getMime(entry.name);
    var action, icon;
    if (/(?:\/json$|^text\/)/.test(mime)) {
      icon = "icon-doc-text";
      action = editCode;
    }
    else if (/^image\//.test(mime)) {
      icon = "icon-picture";
      action = viewImage;
    }
    else if (/^video\//.test(mime)) {
      icon = "icon-video";
      action = viewVideo;
    }
    else {
      icon = "icon-doc";
    }
    var attrib = { title: entry.hash };
    if (action) attrib.onclick = event(action);
    return domBuilder(["li",
      [".row$row", attrib,
        ["i", { class: icon }], entry.name
      ],
    ], $);

    function editCode() {
      var isNew = false;
      if (reading) return;
      if (selected) {
        selected.row.classList.remove("selected");
      }
      else {
        isNew = true;
      }
      if (selected === $) {
        selected = null;
        editor.swap(scratchpad);
        return;
      }
      selected = $;
      selected.row.classList.add("selected");

      var doc = docs[path];
      if (doc) return swap();

      reading = true;
      return fs.readAs("text", path, function (err, text) {
        reading = false;
        if (err) return console.log(err);
        doc = docs[path] = new CodeMirror.Doc(text, mime);
        doc.on('change', function (evt) {
          var newText = doc.getValue();
          console.log(entry.parent, entry.name, newText === text);
        });
        return swap();
      });

      function swap() {
        var old = editor.swap(doc);
        if (isNew) scratchpad = old;
      }

    }

    function viewImage() {
      console.log("TODO: Image", entry, mime);
    }

    function viewVideo() {
      console.log("TODO: Video", entry, mime);
    }
  }

  function renderSymLink(entry) {
    return ["li", "TODO: Implement renderSymLink"];
  }

  function renderGitLink(entry) {
    return ["li", "TODO: Implement renderGitLink"];
  }

}

TreeView.prototype.resize = function (width, height) {
  this.el.style.width = width + "px";
  this.el.style.height = height + "px";
};

// Helper wrapper to make onclick handlers easier to write.
function event(fn) {
  return function (evt) {
    evt.preventDefault();
    evt.stopPropagation();
    return fn.apply(this, Array.prototype.slice.call(arguments, 1));
  };
}

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

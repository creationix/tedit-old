var domBuilder = require('dombuilder');
module.exports = TreeView;

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

function event(fn) {
  return function (evt) {
    evt.preventDefault();
    evt.stopPropagation();
    return fn.apply(this, Array.prototype.slice.call(arguments, 1));
  };
}

function folderFirst(a, b) {
  return a.mode - b.mode;
}


function TreeView(fs, editor) {

  var opened = { "": true };

  this.el = domBuilder([".tree", ["ul",
    renderTree({ root: fs.name })
  ]]);

  function renderTree(entry) {
    var $ = {};
    var reading = false;
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
    var $ = {};
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
      fs.readAs("text", entry.parent + "/" + entry.name, function (err, text, entry) {
        if (err) return console.log(err);
        entry.value = text;
        entry.mime = mime;
        var old = editor.swap(entry);
        console.log("TODO: handle old", old);
      });
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

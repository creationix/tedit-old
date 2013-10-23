var domBuilder = require('dombuilder');
module.exports = TreeView;

// Git file modes:
// 0040000 16384 "tree" - tree
// 0100644 33188 "blob" - file
// 0100755 33261 "blob" - executable file
// 0120000 40960 "blob" - symlink
// 0160000 57344 "commit" - gitlink

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


function TreeView(fs, autoOpen) {

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
    return domBuilder(["li",
      [".row$row", { title:entry.hash, onclick: event(toggle) },
        ["i.icon-doc"], entry.name
      ],
    ], $);

    function toggle() {
      console.log("file", entry);
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


// function
//       ["li", [".row", ["i.icon-box"], "test"],
//         ["ul$ul"]
//       ],

//       ["li", [".row", ["i.icon-folder-open"], "res"],
//         ["ul",
//           ["li", [".row", ["i.icon-video"], "video.m4a"]],
//           ["li", [".row", ["i.icon-picture"], "picture.png"]],
//           ["li", [".row", ["i.icon-doc"], "libuv.so"]],
//         ]
//       ],
//       ["li", [".row", ["i.icon-folder"], "css"]],
//       ["li", [".row", ["i.icon-doc-text"], "app.js"]],
//     ]
//   ]);

var domBuilder = require('dombuilder');
module.exports = TreeView;

function TreeView(fs) {
  this.fs = fs;
  this.el = domBuilder([".tree",
    ["ul",
      ["li", [".row", ["i.icon-folder-open"], "res"],
        ["ul",
          ["li", [".row", ["i.icon-video"], "video.m4a"]],
          ["li", [".row", ["i.icon-picture"], "picture.png"]],
          ["li", [".row", ["i.icon-doc"], "libuv.so"]],
        ]
      ],
      ["li", [".row", ["i.icon-folder"], "css"]],
      ["li", [".row", ["i.icon-doc-text"], "app.js"]],
      ["li", [".row", ["i.icon-box"], "test"]],
    ]
  ]);
}

TreeView.prototype.resize = function (width, height) {
  this.el.style.width = width + "px";
  this.el.style.height = height + "px";
};

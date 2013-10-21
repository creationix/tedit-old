// Git file modes:
// 0040000 16384 "tree" - tree
// 0100644 33188 "blob" - file
// 0100755 33261 "blob" - executable file
// 0120000 40960 "blob" - symlink
// 0160000 57344 "commit" - gitlink

module.exports = function (repo) {
  var paths = {};

  var exports = {
    readAs: readAs,
    writeFile: writeFile,
    deleteFile: deleteFile,
    getEntry: getEntry,
    paths: paths
  };
  return exports;

  // Get a path entry
  function getEntry(path) {
    // Normalize the path
    path = path.replace(/^\/*/, '').replace(/\/*$/, '');
    if (path) path = "/" + path;

    // Look up the entry.
    var entry = paths[path];
    // Create new entries if they don't exist yet.
    if (entry) return entry;

    entry = paths[path] = {
      mode: null, name: null, hash: null, parent: null
    };

    // Calculate what we can know from the path alone
    if (path) {
      var index = path.lastIndexOf("/");
      entry.parent = path.substr(0, index);
      entry.name = path.substr(index + 1);
    }
    // Root node is somewhat special.  It's always a tree.
    else {
      entry.mode = 040000;
    }

    return entry;
  }

  function loadHash(entry, callback) {
    // If it already has a hash, callback right away.
    if (entry.hash) return callback();

    if (entry.parent === null) {
      return repo.loadAs("commit", "HEAD", onHead);
    }
    return readTree(entry.parent, onParent);

    function onHead(err, head) {
      if (err) return callback(err);
      entry.hash = head.tree;
      return callback(null, entry);
    }

    function onParent(err) {
      if (err) return callback(err);
      return callback(null, entry);
    }
  }

  function readTree(path, callback) {
    var entry = getEntry(path);
    return loadHash(entry, onHash);

    function onHash(err) {
      if (err) return callback(err);
      return repo.loadAs("tree", entry.hash, onTree);
    }

    function onTree(err, tree) {
      if (err) return callback(err);
      tree.forEach(function (childEntry, i) {
        var child = getEntry(path + "/" + childEntry.name);
        if (child.mode === null) child.mode = childEntry.mode;
        if (child.hash === null) child.hash = childEntry.hash;
        tree[i] = child;
      });
      return callback(null, tree, entry);
    }
  }

  function readAs(type, path, callback) {
    if (type === "tree") return readTree(path, callback);
    var entry = getEntry(path);
    return loadHash(entry, onHash);

    function onHash(err) {
      if (err) return callback(err);
      return repo.loadAs(type, entry.hash, onBody);
    }

    function onBody(err, body) {
      if (err) return callback(err);
      return callback(null, body, entry);
    }
  }

  // Changes is a hash where key is name and value is action:
  //   true (update) or false (delete)
  function updateTree(path, toDelete, callback) {
    var entries, tree;
    return readTree(path, function (err, e, t) {
      if (err) return callback(err);
      entries = e;
      tree = t;
      if (toDelete) {
        for (var i = entries.length - 1; i >= 0; i--) {
          var entry = entries[i];
          if (toDelete !== entry.name) continue;
          entries.splice(i, 1);
          if (exports.onChange) {
            var childPath = path + "/" + entry.name;
            exports.onChange(childPath, null, entry);
          }
          break;
        }
      }
      if (entries.length || tree.parent === null) {
        return repo.saveAs("tree", entries, onSave);
      }
      return updateTree(tree.parent, tree.name, callback);
    });

    function onSave(err, hash) {
      if (err) return callback(err);
      if (hash === tree.hash) return callback();
      tree.hash = hash;
      if (exports.onChange) exports.onChange(path, entries, tree);
      if (tree.parent !== null) return updateTree(tree.parent, null, callback);
      callback();
    }

  }

  function deleteFile(path, callback) {
    var entry = getEntry(path);
    return updateTree(entry.parent, entry.name, callback);
  }

  function writeFile(path, body, callback) {
    var entry = getEntry(path);
    return repo.saveAs("blob", body, onHash);

    function onHash(err, hash) {
      if (err) return callback(err);
      if (entry.hash === hash) return callback();
      entry.hash = hash;
      if (exports.onChange) exports.onChange(path, body, entry);
      updateTree(entry.parent, null, onUpdate);
    }

    function onUpdate(err) {
      if (err) return callback(err);
      callback(null, entry);
    }
  }

};

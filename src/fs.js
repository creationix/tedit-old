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
    commit: commit,
  };
  return exports;

  function commit(meta, callback) {
    if (!callback) return commit.bind(this, meta);
    repo.readRef("refs/tags/current", function (err, current) {
      if (err) return callback(err);
      if (!current) {
        return callback(new Error("No current state to commit"));
      }
      repo.loadAs("commit", "HEAD", function (err, head, hash) {
        if (err) return callback(err);
        if (head && head.tree === current) {
          return callback(new Error("No changes to commit"));
        }
        meta.tree = current;
        if (head) meta.parent = hash;
        repo.saveAs("commit", meta, function (err, hash) {
          if (err) return callback(err);
          repo.updateHead(hash, callback);
        });
      });
    });
  }

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
      return repo.readRef("refs/tags/current", onCurrent);
    }
    return readTree(entry.parent, onParent);

    function onCurrent(err, hash) {
      if (err) return callback(err);
      if (hash === undefined) return repo.loadAs("commit", "HEAD", onHead);
      entry.hash = hash;
      return callback(null, entry);
    }

    function onHead(err, head) {
      if (head === undefined) return callback(err, entry);
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
    entry.mode = entry.mode || 0040000;

    return loadHash(entry, onHash);

    function onHash(err) {
      if (err) return callback(err);
      if (!entry.hash) return callback(null, [], entry);
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
    if (!callback) return readAs.bind(this, type, path);
    if (type === "tree") return readTree(path, callback);
    var entry = getEntry(path);
    return loadHash(entry, onHash);

    function onHash(err) {
      if (err) return callback(err);
      if (!entry.hash) {
        err = new Error("ENOENT: No such file: " + path);
        err.code = "ENOENT";
        return callback(err);
      }
      return repo.loadAs(type, entry.hash, onBody);
    }

    function onBody(err, body) {
      if (err) return callback(err);
      return callback(null, body, entry);
    }
  }

  // Update an entry in a tree.  Use null value to delete.
  function updateParent(entry, callback) {
    readTree(entry.parent, function (err, entries, tree) {
      if (err) return callback(err);
      var found = false;
      for (var i = entries.length - 1; i >= 0; i--) {
        var peer = entries[i];
        if (peer.name !== entry.name) continue;
        found = true;
        if (entry.hash) break;
        entries.splice(i, 1);
        if (exports.onChange) {
          exports.onChange(entry.parent + "/" + entry.name, null, entry);
        }
        break;
      }
      if (!found) {
        entries.push(entry);
      }

      if (tree.name && entries.length === 0) {
        tree.hash = false;
        return updateParent(tree, callback);
      }
      return repo.saveAs("tree", entries, function (err, hash) {
        if (err) return callback(err);
        if (hash === tree.hash) return callback();
        tree.hash = hash;
        if (exports.onChange) exports.onChange(entry.parent, entries, tree);
        if (tree.parent !== null) return updateParent(tree, callback);
        repo.createRef("refs/tags/current", hash, callback);
      });
    });
  }

  function deleteFile(path, callback) {
    if (!callback) return deleteFile.bind(this, path);
    var entry = getEntry(path);
    entry.hash = false;
    return updateParent(entry, callback);
  }

  function writeFile(path, body, callback) {
    if (!callback) return writeFile.bind(this, path, body);
    var entry = getEntry(path);
    entry.mode = entry.mode || 0100644;
    return repo.saveAs("blob", body, onHash);

    function onHash(err, hash) {
      if (err) return callback(err);
      if (entry.hash === hash) return callback();
      entry.hash = hash;
      if (exports.onChange) exports.onChange(path, body, entry);
      updateParent(entry, onUpdate);
    }

    function onUpdate(err) {
      if (err) return callback(err);
      callback(null, entry);
    }
  }

};

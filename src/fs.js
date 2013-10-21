// Git file modes:
// 0040000 16384 "tree" - tree
// 0100644 33188 "blob" - file
// 0100755 33261 "blob" - executable file
// 0120000 40960 "blob" - symlink
// 0160000 57344 "commit" - gitlink

module.exports = function (repo) {
  var paths = {};

  return {
    readAs: readAs,
  };

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
        child.mode = childEntry.mode;
        child.hash = childEntry.hash;
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

};

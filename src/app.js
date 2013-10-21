var log = console.log = require('domlog');
log.setup({
  top: 0,
  bottom: 0,
  height: "auto",
  background: "#000",
  overflow: "auto",
  fontFamily: 'inherit',
});

var platform = {
  sha1: require('git-sha1'),
  bops: require('bops-browser')
};
var jsGit = require('js-git')(platform);
var localDb = require('git-chrome-local-db')(platform);

function newRepo(name, callback) {
  if (!callback) return newRepo.bind(this, name);
  var db = localDb(name);
  var repo = jsGit(db);
  return db.init(function(err) {
    if (err) return callback(err);
    callback(null, repo);
  });
}


function FileSystem(repo) {
  var byPath = {};

  return {
    getTree: getTreeByPath,
    getFile: getFileByPath
  };

  // Get the tree object for a path.
  function getTreeByPath(path, callback) {
    if (!callback) return getTreeByPath.bind(this, path);
    path = trimPath(path) + "/";
    if (path in byPath) return callback(null, byPath[path]);
    if (path === "/") {
      return repo.loadAs("commit", "HEAD", onCommit);
    }
    return getTreeByPath(dirname(path), onParent);

    function onCommit(err, commit) {
      if (err) return callback(err);
      callback(null, Tree(path, commit.tree));
    }

    function onParent(err, parent) {
      if (err) return callback(err);
      return parent.getTree(basename(path), callback);
    }
  }

  function getFileByPath(path, callback) {
    if (!callback) return getFileByPath.bind(this, path);
    path = trimPath(path);
    if (path in byPath) return callback(null, byPath[path]);
    return getTreeByPath(dirname(path), onParent);

    function onParent(err, parent) {
      if (err) return callback(err);
      return parent.getFile(basename(path), callback);
    }
  }

  function Tree(path, hash) {
    var entries;
    byPath[path] = this;

    return {
      getTree: getTree,
      getFile: getFile,
      getEntries: getEntries,
    };

    function getTree(name, callback) {
      if (!entries) {
        return loadEntries(function (err) {
          if (err) return callback(err);
          return getTree(name, callback);
        });
      }
      var entry;
      try { entry = findTree(name); }
      catch (err) { return callback(err); }
      var childPath = path + "/" + name + "/";
      if (childPath in byPath) return callback(null, byPath[childPath]);
      return callback(null, Tree(childPath, entry.hash));
    }

    function getFile(name, callback) {
      if (!entries) {
        return loadEntries(function (err) {
          if (err) return callback(err);
          return getFile(name, callback);
        });
      }
      var entry;
      try { entry = findFile(name); }
      catch (err) { return callback(err); }
      var childPath = path + "/" + name;
      if (childPath in byPath) return callback(null, byPath[childPath]);
      return callback(null, File(childPath, entry.hash, !!(entry.mode & 0100)));
    }

    function getEntries(callback) {
      if (!entries) {
        return loadEntries(function (err) {
          if (err) return callback(err);
          return getEntries(callback);
        });
      }
      var mapped = {};
      entries.forEach(function (entry) {
        mapped[entry.name] = mapEntry(entry);
      });
      callback(null, mapped);

    }

    function mapEntry(entry) {
      var childPath = path + "/" + entry.name;
      var hash = entry.hash;
      if (entry.mode === 040000)
        return Tree(hash, childPath);
      if (entry.mode === 0100644)
        return File(hash, childPath, false);
      if (entry.mode === 0100755)
        return File(hash, childPath, true);
      if (entry.mode === 0120000)
        return SymLink(hash, childPath);
      if (entry.mode === 0160000)
        return GitLink(hash, childPath);
      else throw new Error("Invalid mode: 0" + entry.mode.toString(8));
    }

    function loadEntries(callback) {
      repo.loadAs("tree", hash, function (err, result) {
        if (err) return callback(err);
        entries = result;
        return callback();
      });
    }

    function findEntry(name) {
      for (var i = 0, l = entries.length; i < l; i++) {
        var entry = entries[i];
        if (entry.name === name) return entry;
      }
      var err = new Error("ENOENT: No such entry: " + path + "/" + name);
      err.code = "ENOENT";
      throw err;
    }

    function findTree(name) {
      var entry = findEntry(name);
      if (entry.mode === 040000) return entry;
      var err = new Error("ENOTDIR: not a directory: " + path + "/" + name);
      err.code = "ENOTDIR";
      throw err;
    }

    function findFile(name) {
      var entry = findEntry(name);
      if (entry.mode & 0777000 === 0100000) return entry;
      var err = new Error("ENOTFILE: not a file: " + path + "/" + name);
      err.code = "ENOTFILE";
      throw err;
    }

  }

  function File(path, hash, executable) {
    this.
    return {};
  }

  function SymLink(path, hash) {
    return {};
  }

  function GitLink(path, hash) {
    return {};
  }
}

function basename(path) {
  return path.match(/([^\/]+)\/*$/)[1];
}

function dirname(path) {
  return path.replace(/[^\/]+\/*$/, '');
}

function trimPath(path) {
  return path.replace(/^\/*/, '').replace(/\/*$/, '');
}

newRepo("test", function (err, repo) {
  if (err) return log(err);
  window.repo = repo;
  var fs = FileSystem(repo);

  repo.getHead(function (err, head) {
    if (err) return log(err);
    if (head) return onReady();
    return require('./init.js')(repo, onReady);
  });

  function onReady(err) {
    if (err) return log(err);
    log("repo", repo);
    repo.loadAs("commit", "HEAD", onHead);
  }

  function onHead(err, head) {
    if (err) return log(err);
    log("last commit", head);
    fs.getTree("", function (err, root) {
      if (err) return log(err);
      console.log("root", root);
      root.getEntries(function (err, entries) {
        if (err) return log(err);
        log(entries);
      });
    });
  }

});
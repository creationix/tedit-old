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
var newFileSystem = require('./fs.js');

function newRepo(name, callback) {
  if (!callback) return newRepo.bind(this, name);
  var db = localDb(name);
  var repo = jsGit(db);
  return db.init(function(err) {
    if (err) return callback(err);
    callback(null, repo);
  });
}

function wrap(fn) {
  if (typeof fn !== "function") {
    var err = new TypeError("fn must be a function");
    return log(err);
  }
  return function (err) {
    if (err) {
      return log(err);
    }
    var args = Array.prototype.slice.call(arguments, 1);
    try {
      fn.apply(null, args);
    }
    catch (err) {
      return log(err);
    }
  };
}

chrome.storage.local.clear();

newRepo("test", wrap(function (repo) {
  var head;
  var fs = newFileSystem(repo);
  fs.onChange = function (path, value, entry) {
    if (value) console.log("CHANGE", path, value, entry.hash);
    else console.log("DELETE", path, value, entry.hash);
  }
  return repo.getHead(wrap(onHead));

  function onHead(hash) {
    if (hash) return onReady(hash);
    return require('./init.js')(repo, wrap(onReady));
  }

  function onReady(hash) {
    head = hash;
    log("repo", repo);
    log("fs", {
      "/": fs.getEntry("").hash,
      "/app": fs.getEntry("app").hash,
      "/app/sample.txt": fs.getEntry("app/sample.txt").hash,
    });
    fs.readAs("text", "app/sample.txt", wrap(onFile));
  }

  function onFile(body, entry) {
    log(entry, body);
    log("fs", {
      "/": fs.getEntry("").hash,
      "/app": fs.getEntry("app").hash,
      "/app/sample.txt": fs.getEntry("app/sample.txt").hash,
    });
    fs.writeFile("app/sample.txt", "This is new content!\n", wrap(onSave));
  }

  function onSave(entry) {
    log(entry);
    log("fs", {
      "/": fs.getEntry("").hash,
      "/app": fs.getEntry("app").hash,
      "/app/sample.txt": fs.getEntry("app/sample.txt").hash,
    });
    fs.writeFile("app/sample.txt", "This is new content!\n", wrap(onSave2));
  }

  function onSave2(entry) {
    log(entry);
    log("fs", {
      "/": fs.getEntry("").hash,
      "/app": fs.getEntry("app").hash,
      "/app/sample.txt": fs.getEntry("app/sample.txt").hash,
    });
    var commit = {
      tree: fs.getEntry("").hash,
      parent: head,
      author: { name: "Tim Caswell", email: "tim@creationix.com" },
      message: "Update code"
    };
    console.log("HEAD", head)
    repo.saveAs("commit", commit, wrap(function (hash) {
      return repo.updateHead(hash, wrap(function () {
        head = hash;
        console.log("HEAD", head);
        repo.logWalk("HEAD", wrap(onStream));
      }));
    }));
  }

  function onStream(history) {
    history.read(wrap(onRead));

    function onRead(commit) {
      if (!commit) {
        return fs.deleteFile("app/sample.txt", wrap(onDelete));
      }
      console.log(commit.hash, commit.message);
      repo.treeWalk(commit.tree, wrap(onStream2));
    }

    function onStream2(files) {
      files.read(wrap(onFile));

      function onFile(file) {
        if (!file) {
          return history.read(wrap(onRead));
        }
        console.log(file.hash, file.path);
        files.read(wrap(onFile));
      }
    }
  }

  function onDelete() {
    console.log("DONE");
  }

}));


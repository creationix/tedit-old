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

// chrome.storage.local.clear();
var db = localDb("test");
var repo = jsGit(db);
var fs = newFileSystem(repo);
fs.onChange = function (path, value, entry) {
  if (value) console.log("CHANGE", path, entry.hash);
  else console.log("DELETE", path);
};

var author = {name: "Tim Caswell", email: "tim@creationix.com"};

serial(
  db.init(),
  walk(),

  fs.writeFile("/tedit/package.json", require('../package.json#txt')),
  fs.commit({ author: author, message: "Create package.json" }),
  walk(),

  fs.writeFile("/tedit/src/app.js", require('./app.js#txt')),
  fs.writeFile("/tedit/src/fs.js", require('./fs.js#txt')),
  fs.commit({ author: author, message: "Add app and fs code." }),
  walk(),

  fs.deleteFile("/tedit/package.json"),
  fs.commit({ author: author, message: "Delete package.json." }),
  walk(),

  fs.deleteFile("/tedit/src/app.js"),
  fs.commit({ author: author, message: "Delete sample app." }),
  walk()
)(function (err) {
  if (err) return log(err);
  console.log("Done");
});

function walk(callback) {
  if (!callback) return walk;
  var history, tree, head, current;
  repo.loadAs("commit", "HEAD", onHead);
  function onHead(err, result) {
    head = result && result.tree;
    return repo.readRef("tags/current", onCurrent);
  }
  function onCurrent(err, result) {
    current = result;
    if (current && current !== head) {
      return onCommit(null, {
        message: "Uncommitted tree",
        tree: current
      });
    }
    if (head) return onEntry();
    console.log("Empty repo");
    return callback();
  }

  function onHistory(err, result) {
    if (result === undefined) return callback(err);
    history = result;
    history.read(onCommit);
  }

  function onCommit(err, commit) {
    if (commit === undefined) return callback(err);
    console.log(commit.hash, commit.message);
    repo.treeWalk(commit.tree, onTree);
  }

  function onTree(err, result) {
    if (result === undefined) return callback(err);
    tree = result;
    tree.read(onEntry);
  }

  function onEntry(err, entry) {
    if (err) return callback(err);
    if (!entry) {
      if (history) return history.read(onCommit);
      if (head) return repo.logWalk("HEAD", onHistory);
      return callback();
    }
    console.log(entry.hash, entry.path, entry.type);
    tree.read(onEntry);
  }
}

// Mini control-flow library
function serial() {
  var i = 0, steps = arguments, callback;
  return function (cb) {
    callback = cb;
    return next();
  };

  function next(err) {
    if (err) return callback(err);
    var step = steps[i++];
    if (!(typeof step === 'function' && step.length === 1)) {
      throw new TypeError("Step is not continuable: " + step);
    }
    if (!step) return callback();
    return step(next);
  }

}

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
  var fs = newFileSystem(repo);
  return repo.getHead(wrap(onHead));

  function onHead(head) {
    if (head) return onReady();
    return require('./init.js')(repo, wrap(onReady));
  }

  function onReady() {
    log("repo", repo);
    log("fs", fs);
    fs.readAs("text", "app/sample.txt", wrap(onFile));
    fs.readAs("tree", "", wrap(onTree));
  }

  function onFile(body, entry) {
    log(body, entry);
  }

  function onTree(entries, entry) {
    log("entry", entry)
    log("entries", entries);
  }
}));


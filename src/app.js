

// var CodeMirror = require('./codemirror.js');

// var code;
// if (window.location.hash) {
//   code = decodeURIComponent(window.location.hash.substr(1));
// }
// else {
//   code = require("./sample.js#txt");
// }

// document.body.textContent = "";
// CodeMirror(document.body, {
//   value: code,
//   mode:  "javascript",
//   theme: "ambiance",
//   autofocus: true,
//   lineNumbers: true,
//   extraKeys: {
//     "Ctrl-Enter": run
//   }
// });

var log = console.log = require('domlog');
log.setup({
  top: 0,
  // top: "400px",
  bottom: 0,
  height: "auto",
  background: "#000",
  overflow: "auto",
  fontFamily: 'inherit',
});

// var template = require('./template.js#txt');
// var worker;
// var offset = template.substr(0, template.indexOf("// userCode\n")).split("\n").length - 1;

// function run(instance) {
//   if (worker) {
//     worker.terminate();
//     worker = null;
//   }
//   log.container.textContent = "";
//   var userCode = instance.getValue();
//   var total = userCode.split("\n").length;
//   window.location.hash = encodeURI(userCode);

//   var code = template.replace("// userCode", userCode);
//   var blob = new Blob([code], {type:"application/javascript"});
//   var blobURL = window.URL.createObjectURL(blob);
//   worker = new Worker(blobURL);
//   worker.onerror = function (evt) {
//     evt.preventDefault();
//     var details = {};
//     var line = evt.lineno - offset;
//     var column = evt.colno;
//     if (column !== undefined) {
//       details.column = column;
//     }
//     if (line < total) {
//       details.line = line;
//       instance.setCursor(line - 1, column);
//     }
//     log(evt.message, details);
//   };

//   worker.onmessage = function(evt) {
//     var data = evt.data;
//     if (Array.isArray(data)) log.apply(null, evt.data);
//     if (data.error) log(data.error);
//   };
//   worker.postMessage("");

// }

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

var cache = {};

function FileSystem(repo) {
  this.repo = repo;
  this.root = null;
  this.head = null;
}

FileSystem.prototype.readTree = fileSystemReadTree;
function fileSystemReadTree(path, callback) {
  if (!callback) return fileSystemReadTree.bind(this, path);
  throw new Error("TODO: implement")
}

function Tree(repo, hash, path) {
  var cached = cache[path];
  if (cached.hash === hash) return cached;
  cache[path] = this;
  this.repo = repo;
  this.hash = hash;
  this.path = path;
}
Tree.prototype.read = treeRead;

// Read a directory listing the files
function treeRead(callback) {
  if (!callback) return treeRead.bind(this);
  var base = this.path;
  var repo = this.repo;
  return this.repo.loadAs("tree", onLoad);
  function onLoad(err, entries) {
    if (err) return callback(err);
    callback(null, entries.map(mapEntry));
  }
  function mapEntry(entry) {
    var path = base + "/" + entry.name;
    var hash = entry.hash;
    if (entry.mode === 040000)
      return new Tree(repo, hash, path);
    if (entry.mode === 0100644)
      return new File(repo, hash, path, false);
    if (entry.mode === 0100755)
      return new File(repo, hash, path, true);
    if (entry.mode === 0120000)
      return new SymLink(repo, hash, path);
    if (entry.mode === 0160000)
      return new GitLink(repo, hash, path);
    else throw new Error("Invalid mode: 0" + entry.mode.toString(8));
  }
}

function File(repo, hash, path, exec) {
  var cached = cache[path];
  if (cached.hash === hash) return cached;
  this.repo = repo;
  this.hash = hash;
  this.path = path;
  this.exec = exec;
}
File.prototype.read = fileRead;
function fileRead(callback) {
  if (!callback) return fileRead.bind(this);

}

function SymLink(repo, hash, path) {
  var cached = cache[path];
  if (cached.hash === hash) return cached;
  this.repo = repo;
  this.hash = hash;
  this.path = path;
}

function GitLink(repo, hash, path) {
  var cached = cache[path];
  if (cached.hash === hash) return cached;
  this.repo = repo;
  this.hash = hash;
  this.path = path;
}

newRepo("test", function (err, repo) {
  if (err) return log(err);
  window.repo = repo;

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
    log("HEAD", head);
  }


});
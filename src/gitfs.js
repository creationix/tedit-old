var platform = {
  sha1: require('git-sha1'),
  bops: require('bops-browser')
};

var jsGit = require('js-git')(platform);
var localDb = require('git-chrome-local-db')(platform);
var newFileSystem = require('./fs.js');

module.exports = function (name, callback) {
  var db = localDb(name);
  var repo = jsGit(db);
  var fs = newFileSystem(repo);
  fs.name = name;
  // require('./init.js')(db, fs, onInit);
  db.init(onInit);
  
  function onInit(err) {
    if (err) return callback(err);
    callback(null, fs);
  }
};
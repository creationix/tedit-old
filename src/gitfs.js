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
  db.init(function (err) {
    if (err) return callback(err);
    callback(null, fs);
  });
};
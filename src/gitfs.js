var newFileSystem = require('./fs.js');

module.exports = function (name, callback) {
  var db = localDb(name);
  var repo = jsGit(db);
  var fs = newFileSystem(repo);
  fs.name = name;
  // require('./init.js')(db, fs, onInit);
  db.init(function (err) {
    if (err) return callback(err);
    db.get("HEAD", function (err, head) {
      if (head) return onInit();
      return require('./init.js')(db, fs, onInit);
    });
  });

  function onInit(err) {
    if (err) return callback(err);
    callback(null, fs, repo, db);
  }
};
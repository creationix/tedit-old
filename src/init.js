var serial = require('./serial.js');
// The job of this module is to create a new local git repository
// complete with a sample commit if none exists.
module.exports = init;
var author = {name: "Tim Caswell",email: "tim@creationix.com"};

function init(db, fs, callback) {
  if (callback) return init(db, fs)(callback);
  // chrome.storage.local.clear();
  return serial(
    db.init(),
    fs.writeFile("/tedit/package.json", require('../package.json#txt')),
    fs.commit({ author: author, message: "Create package.json" }),
    fs.writeFile("/tedit/src/app.js", require('./app.js#txt')),
    fs.writeFile("/tedit/src/fs.js", require('./fs.js#txt')),
    fs.commit({ author: author, message: "Add app and fs code." }),
    fs.writeFile("/tedit/src/index.html", require('./index.html#txt')),
    fs.writeFile("/sample.js", require('./sample.js#txt'))
  );
}


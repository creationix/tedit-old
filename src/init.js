var serial = require('./serial.js');
// The job of this module is to create a new local git repository
// complete with a sample commit if none exists.
module.exports = init;
var author = {name: "Tim Caswell",email: "tim@creationix.com"};

function init(db, fs, callback) {
  if (callback) return init(db, fs)(callback);
  return serial(
    db.clear(),
    db.init(),
    fs.writeFile("/package.json", require('../package.json#txt')),
    fs.commit({ author: author, message: "Create package.json" }),
    fs.writeFile("/src/TreeView.js", require('./TreeView.js#txt')),
    fs.writeFile("/src/Editor.js", require('./Editor.js#txt')),
    fs.writeFile("/src/index.html", require('./index.html#txt')),
    fs.commit({ author: author, message: "Add app and fs code." }),
    fs.writeFile("/samples/sample.js", require('./sample.js#txt')),
    fs.commit({ author: author, message: "Add sample file." })
  );
}


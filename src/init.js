
// The job of this module is to create a new local git repository
// complete with a sample commit if none exists.
module.exports = function (repo, callback) {
  return repo.setHead("master", onSet);

  function onSet(err) {
    if (err) return callback(err);
    return repo.saveAs("blob", require('./sample.js#txt'), onBlob);
  }

  function onBlob(err, hash) {
    if (err) return callback(err);
    var tree = [
      { mode: 0100644, name: "sample.txt", hash: hash }
    ];
    console.log("Creating tree", tree);
    return repo.saveAs("tree", tree, onTree);
  }

  function onTree(err, hash) {
    if (err) return callback(err);
    var tree = [
      { mode: 040000, name: "app", hash: hash }
    ];
    console.log("Creating parent tree", tree);
    return repo.saveAs("tree", tree, onTree2);
  }

  function onTree2(err, hash) {
    if (err) return callback(err);
    var commit = {
      tree: hash,
      author: { name: "Tim Caswell", email: "tim@creationix.com" },
      message: "Create Repository with Sample Code"
    };
    return repo.saveAs("commit", commit, onCommit);
  }

  function onCommit(err, hash) {
    if (err) return callback(err);
    return repo.updateHead(hash, function (err) {
      if (err) return callback(err);
      callback(null, hash);
    });
  }
};
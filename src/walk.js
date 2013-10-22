module.exports = walk;

function walk(repo, callback) {
  if (!callback) return walk.bind(this, repo);
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

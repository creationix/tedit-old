var deline = require('./deline.js');
module.exports = fetch;
function fetch(socket, repo, opts, callback) {

  var read = socket.read,
      write = socket.write,
      abort = socket.abort;
  var onProgress = opts.onProgress,
      onError = opts.onError,
      wants = opts.wants,
      depth = opts.depth,
      caps = opts.caps;
  var cb;

  if (opts.deline) {
    if (onProgress) onProgress = deline(onProgress);
    if (onError) onError = deline(onError);
  }

  if (!wants.length) {
    write(null);
    write("done\n");
    return callback();
  }

  return repo.listRefs("refs", onRefs);

  function onRefs(err, refs) {
    if (err) return callback(err);

    // want-list
    for (var i = 0, l = wants.length; i < l; ++i) {
      write("want " + wants[i] + (i === 0 ? " " + caps.join(" ") : "") + "\n");
    }
    if (depth) {
      write("deepen " + depth + "\n");
    }
    write(null);

    // have-list
    for (var ref in refs) {
      write("have " + refs[ref] + "\n");
    }

    // compute-end
    write("done\n");
    return read(onResponse);
  }

  function onResponse(err, resp) {
    if (err) return callback(err);
    if (resp === undefined) return callback(new Error("Server disconnected"));
    if (resp === null) return read(onResponse);
    var match = resp.match(/^([^ \n]*)(?: (.*))?/);
    var command = match[1];
    var value = match[2];
    if (command === "shallow") {
      return repo.createRef("shallow", value, onShallow);
    }
    if (command === "NAK" || command === "ACK") {
      return callback(null, { read: packRead, abort: abort });
    }
    return callback(new Error("Unknown command " + command + " " + value));
  }

  function onShallow(err) {
    if (err) return callback(err);
    return read(onResponse);
  }

  function packRead(callback) {
    if (cb) return callback(new Error("Only one read at a time"));
    cb = callback;
    return read(onItem);
  }

  function onItem(err, item) {
    var callback = cb;
    if (item === undefined) {
      cb = null;
      return callback(err);
    }
    if (item) {
      if (item.progress) {
        if (onProgress) onProgress(item.progress);
        return read(onItem);
      }
      if (item.error) {
        if (onError) onError(item.error);
        return read(onItem);
      }
    }
    if (!item) return read(onItem);
    cb = null;
    return callback(null, item);
  }
}

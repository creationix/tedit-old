// input push-filter: (emit) -> emit
// output is simple-stream pull-filter: (stream) -> stream
module.exports = pushToPull;
function pushToPull(parser) {
  return function (stream) {
  
    var write = parser(onData);
    var cb = null;
    var queue = [];
      
    return { read: read, abort: stream.abort };
    
    function read(callback) {
      if (queue.length) return callback(null, queue.shift());
      if (cb) return callback(new Error("Only one read at a time."));
      cb = callback;
      stream.read(onRead);
      
    }

    function onRead(err, item) {
      var callback = cb;
      cb = null;
      if (err) return callback(err);
      try {
        write(item);
      }
      catch (err) {
        return callback(err);
      }
      return read(callback);
    }

    function onData(item) {
      queue.push(item);
    }

  };
}

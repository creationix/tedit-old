module.exports = function (platform) {
  var writable = require('./writable.js');
  var sharedFetch = require('./fetch.js');
  var sharedDiscover = require('./discover.js');
  var pushToPull = require('push-to-pull');
  var pktLine = require('./pkt-line.js')(platform);
  var framer = pushToPull(pktLine.framer);
  var deframer = pushToPull(pktLine.deframer);
  var tcp = platform.tcp;
  var trace = platform.trace;

  // opts.hostname - host to connect to (github.com)
  // opts.pathname - path to repo (/creationix/conquest.git)
  // opts.port - override default port (9418)
  return function (opts) {

    var connection;

    opts.discover = discover;
    opts.fetch = fetch;
    opts.close = closeConnection;
    return opts;

    function connect(callback) {
      return tcp.connect(opts.port, opts.hostname, function (err, socket) {
        if (err) return callback(err);
        var input = deframer(socket);
        if (trace) input = trace("input", input);

        var output = writable(input.abort);
        connection = {
          read: input.read,
          abort: input.abort,
          write: output
        };
        if (trace) output = trace("output", output);
        output = framer(output);
        socket.sink(output)(function (err) {
          if (err) console.error(err.stack || err);
          // TODO: handle this better somehow
          // maybe allow writable streams
        });
        callback();
      });
    }

    // Send initial git-upload-pack request
    // outputs refs and caps
    function discover(callback) {
      if (!callback) return discover.bind(this);
      if (!connection) {
        return connect(function (err) {
          if (err) return callback(err);
          return discover(callback);
        });
      }
      connection.write("git-upload-pack " + opts.pathname + "\0host=" + opts.hostname + "\0");
      sharedDiscover(connection, callback);
    }

    function fetch(repo, opts, callback) {
      if (!callback) return fetch.bind(this, repo, opts);
      if (!connection) {
        return callback(new Error("Please connect before fetching"));
      }
      return sharedFetch(connection, repo, opts, callback);
    }

    function closeConnection(callback) {
      if (!callback) return closeConnection.bind(this);
      connection.write();
      callback();
    }
  };
};
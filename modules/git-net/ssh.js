module.exports = function (platform) {
  var writable = require('./writable.js');
  var sharedFetch = require('./fetch.js');
  var sharedDiscover = require('./discover.js');
  var pushToPull = require('push-to-pull');
  var trace = platform.trace;
  var pktLine = require('./pkt-line.js')(platform);
  var framer = pushToPull(pktLine.framer);
  var deframer = pushToPull(pktLine.deframer);
  var ssh = platform.ssh;

  // opts.hostname - host to connect to (github.com)
  // opts.pathname - path to repo (/creationix/conquest.git)
  // opts.port - override default port (22)
  // opts.auth - username:password or just username
  // opts.privateKey - binary contents of private key to use.
  return function (opts) {
    if (!opts.hostname) throw new TypeError("hostname is a required option");
    if (!opts.pathname) throw new TypeError("pathname is a required option");

    var tunnel, connection;

    opts.discover = discover;
    opts.fetch = fetch;
    opts.close = closeConnection;
    return opts;

    function connect(command, callback) {
      if (connection) return callback();
      ssh(opts, function (err, result) {
        if (err) return callback(err);
        tunnel = result;
        tunnel.exec(command, function (err, socket) {
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
            throw err;
            // TODO: handle this better somehow
            // maybe allow writable streams
          });
          callback();
        });
      });
    }

    // Send initial git-upload-pack request
    // outputs refs and caps
    function discover(callback) {
      if (!callback) return discover.bind(this);
      if (!connection) {
        return connect("git-upload-pack", function (err) {
          if (err) return callback(err);
          return discover(callback);
        });
      }
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
      tunnel.close();
      callback();
    }

  };

};
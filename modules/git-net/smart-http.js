module.exports = function (platform) {
  var writable = require('./writable.js');
  var sharedDiscover = require('./discover.js');
  var sharedFetch = require('./fetch.js');
  var pushToPull = require('push-to-pull');
  var pktLine = require('./pkt-line.js')(platform);
  var framer = pushToPull(pktLine.framer);
  var deframer = pushToPull(pktLine.deframer);
  var http = platform.http;
  var trace = platform.trace;
  var bops = platform.bops;
  var agent = platform.agent;
  var urlParse = require('./url-parse.js');

  // opts.hostname - host to connect to (github.com)
  // opts.pathname - path to repo (/creationix/conquest.git)
  // opts.port - override default port (80 for http, 443 for https)
  return function (opts) {
    opts.tls = opts.protocol === "https:";
    opts.port = opts.port ? opts.port | 0 : (opts.tls ? 443 : 80);
    if (!opts.hostname) throw new TypeError("hostname is a required option");
    if (!opts.pathname) throw new TypeError("pathname is a required option");

    opts.discover = discover;
    opts.fetch = fetch;
    opts.close = closeConnection;

    var write, read, abort, cb, error, pathname, headers;

    return opts;

    function connect() {
      write = writable();
      var output = write;
      if (trace) output = trace("output", output);
      output = framer(output);
      read = null;
      abort = null;
      post(pathname, headers, output, onResponse);
    }

    function onResponse(err, code, headers, body) {
      if (err) return onError(err);
      if (code !== 200) return onError(new Error("Unexpected status code " + code));
      if (headers['content-type'] !== 'application/x-git-upload-pack-result') {
        return onError(new Error("Wrong content-type in server response"));
      }
      body = deframer(body);
      if (trace) body = trace("input", body);
      read = body.read;
      abort = body.abort;

      if (cb) {
        var callback = cb;
        cb = null;
        return read(callback);
      }
    }

    function onError(err) {
      if (cb) {
        var callback = cb;
        cb = null;
        return callback(err);
      }
      error = err;
    }

    function enqueue(callback) {
      if (error) {
        var err = error;
        error = null;
        return callback(err);
      }
      cb = callback;
    }


    function addDefaults(extras) {

      var headers = {
        "User-Agent": agent,
        "Host": opts.hostname,
      };

      // Hack to workaround gist bug.
      // https://github.com/creationix/js-git/issues/25
      if (opts.hostname === "gist.github.com") {
        headers["User-Agent"] = "git/1.8.1.2";
        headers["X-Real-User-Agent"] = agent;
      }

      for (var key in extras) {
        headers[key] = extras[key];
      }
      return headers;
    }

    function get(path, headers, callback) {
      return http.request({
        method: "GET",
        hostname: opts.hostname,
        tls: opts.tls,
        port: opts.port,
        auth: opts.auth,
        path: opts.pathname + path,
        headers: addDefaults(headers)
      }, onGet);

      function onGet(err, code, responseHeaders, body) {
        if (err) return callback(err);
        if (code === 301) {
          var uri = urlParse(responseHeaders.location);
          opts.protocol = uri.protocol;
          opts.hostname = uri.hostname;
          opts.tls = uri.protocol === "https:";
          opts.port = uri.port;
          opts.auth = uri.auth;
          opts.pathname = uri.path.replace(path, "");
          return get(path, headers, callback);
        }
        return callback(err, code, responseHeaders, body);
      }
    }

    function buffer(body, callback) {
      var parts = [];
      body.read(onRead);
      function onRead(err, item) {
        if (err) return callback(err);
        if (item === undefined) {
          return callback(null, bops.join(parts));
        }
        parts.push(item);
        body.read(onRead);
      }
    }

    function post(path, headers, body, callback) {
      headers = addDefaults(headers);
      if (typeof body === "string") {
        body = bops.from(body);
      }
      if (bops.is(body)) {
        headers["Content-Length"] = body.length;
      }
      else {
        if (headers['Transfer-Encoding'] !== 'chunked') {
          return buffer(body, function (err, body) {
            if (err) return callback(err);
            headers["Content-Length"] = body.length;
            send(body);
          });
        }
      }
      send(body);
      function send(body) {
        http.request({
          method: "POST",
          hostname: opts.hostname,
          tls: opts.tls,
          port: opts.port,
          auth: opts.auth,
          path: opts.pathname + path,
          headers: headers,
          body: body
        }, callback);
      }
    }

    // Send initial git-upload-pack request
    // outputs refs and caps
    function discover(callback) {
      if (!callback) return discover.bind(this);
      get("/info/refs?service=git-upload-pack", {
        "Accept": "*/*",
        "Accept-Encoding": "gzip",
        "Pragma": "no-cache"
      }, function (err, code, headers, body) {
        if (err) return callback(err);
        if (code !== 200) return callback(new Error("Unexpected status code " + code));
        if (headers['content-type'] !== 'application/x-git-upload-pack-advertisement') {
          return callback(new Error("Wrong content-type in server response"));
        }

        body = deframer(body);
        if (trace) body = trace("input", body);

        body.read(function (err, line) {
          if (err) return callback(err);
          if (line.trim() !== '# service=git-upload-pack') {
            return callback(new Error("Missing expected service line"));
          }
          body.read(function (err, line) {
            if (err) return callback(err);
            if (line !== null) {
              return callback(new Error("Missing expected terminator"));
            }
            sharedDiscover(body, callback);
          });
        });
      });
    }

    function fetch(repo, opts, callback) {
      if (!callback) return fetch.bind(this, repo, opts);
      pathname = "/git-upload-pack";
      headers = {
        "Content-Type": "application/x-git-upload-pack-request",
        "Accept": "application/x-git-upload-pack-result",
      };

      return sharedFetch({
        read: resRead,
        abort: resAbort,
        write: resWrite
      }, repo, opts, callback);
    }

    function resRead(callback) {
      if (read) return read(callback);
      return enqueue(callback);
    }

    function resAbort(callback) {
      if (abort) return abort(callback);
      return callback();
    }

    function resWrite(line) {
      if (!write) connect();
      if (line === "done\n") {
        write(line);
        write();
        write = null;
      }
      else {
        write(line);
      }
    }

    function closeConnection(callback) {
      if (!callback) return closeConnection.bind(this);
      callback();
    }
  };
};
var sha1 = require('./lib/sha1.js');
var pathJoin = require('./lib/pathjoin.js');
var parallel = require('./lib/parallel.js');

var mime = "text/cache-manifest";

var cache = {};

module.exports = appcache;

function appcache(req, callback) {
  // If the file is external load and cache it for speed.
  if (req.target) {
    var cached = cache[req.target.hash];
    if (!cached) {
      return req.target.fetch(function (err, input) {
        if (input === undefined) return callback(err);
        cache[req.target.hash] = ("" + input).split("\n").filter(Boolean);
        return appcache(req, callback);
      });
    }
    req.args = req.args.concat(cached);
  }

  render(req, function (err, manifest) {
    if (err) return callback(err);
    var etag = 'W/"' + sha1(manifest) + '"';
    callback(null, {etag: etag, mime: mime, fetch:function (callback) {
      callback(null, manifest);
    }});
  });
}

function render(req, callback) {
  parallel(req.args.map(function (file) {
    return req.repo.servePath(req.root, pathJoin(req.base, file));
  }), function (err, entries) {
    if (err) return callback(err);
    var manifest = "CACHE MANIFEST\n";
    entries.forEach(function(entry, i) {
      if (entry) {
        manifest += req.args[i] + "#" + entry.etag + "\n";
      }
      else {
        manifest += req.args[i] + "\n";
      }
    });
    callback(null, manifest);
  });
}
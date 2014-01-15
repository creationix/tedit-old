var mine = require('./lib/mine.js');
var gen = require('./lib/gen.js');
var pathJoin = require('./lib/pathjoin.js');
var sha1 = require('./lib/sha1.js');


module.exports = cjs;

function cjs(req, callback) {
  var etag = 'W/"' + sha1(req.root + ":" + req.target.etag) + '"';
  var modules = {};  // compiled modules
  var packagePaths = {}; // key is base + name , value is full path
  var aliases = {}; // path aliases from the "browser" directive in package.json
  var path = '-';

  return callback(null, {etag: etag, fetch: fetch});

  function fetch(callback) {
    req.target.fetch(onInput);

    function onInput(err, input) {
      if (err) return callback(err);
      input = "" + input;
      processJs(req.target.path, input, function (err) {
        if (err) return callback(err);
        var out;
        try { out = gen({
          initial: req.target.path,
          modules: modules
        }, true) + "\n"; }
        catch (err) { return callback(err); }
        callback(null, out);
      });
    }

    function processJs(path, js, callback) {
      var deps = mine(js);
      modules[path] = { type: "javascript", value: js, deps: deps };
      next(0);
      function next(index) {
        var dep = deps[index];
        if (!dep) return callback(null, path);
        resolveModule(pathJoin(path, '..'), dep.name, function (err, newPath) {
          if (err) return callback(err);
          dep.newPath = newPath;
          next(index + 1);
        });
      }
    }

    function resolveModule(base, path, callback) {
      if (path[0] === ".") {
        return resolvePath(pathJoin(base, path), callback);
      }

      // non-local requires are assumed to belong to packages
      var index = path.indexOf("/");
      var name = index < 0 ? path : path.substr(0, index);
      return loadPackage(base, name, onPackage);

      function onPackage(err, metaPath) {
        if (metaPath === undefined) return callback(err);
        if (index < 0) path = metaPath;
        else path = pathJoin(metaPath, path.substr(index));
        return resolvePath(path, callback);
      }
    }

    function resolvePath(path, callback) {
      if (path in aliases) path = aliases[path];
      if (path in modules) return callback(null, path);
      if (/\.js$/.test(path)) {
        return loader(path, false, onJavaScript);
      }
      if (/\.json$/.test(path)) {
        return loader(path, false, onJson);
      }
      if (/#txt$/.test(path)) {
        return loader(path.substr(0, path.length - 4), false, onText);
      }
      if (/#bin$/.test(path)) {
        return loader(path.substr(0, path.length - 4), true, onBinary);
      }
      return callback(new Error("Invalid path extension: " + path));

      function onJavaScript(err, js) {
        if (js === undefined) return callback(err);
        processJs(path, js, callback);
      }

      function onJson(err, json) {
        if (json === undefined) return callback(err);
        var value;
        try { value = JSON.parse(json); }
        catch (err) { return callback(err); }
        modules[path] = { type: "json", value: value };
        callback(null, path);
      }

      function onText(err, text) {
        if (text === undefined) return callback(err);
        modules[path] = { type: "text", value: text };
        callback(null, path);
      }

      function onBinary(err, binary) {
        if (binary === undefined) return callback(err);
        modules[path] = { type: "binary", value: binary };
        callback(null, path);
      }

    }

    function loader(path, binary, callback) {
      req.repo.servePath(req.root, path, null, function (err, res) {
        if (!res) return callback(err);
        res.fetch(function (err, data) {
          if (err) return callback(err);
          if (Buffer.isBuffer(data)) {
            if (!binary) data = data.toString();
          }
          else {
            if (binary) data = new Buffer(data);
          }
          callback(null, data);
        });
      });
    }

    function loadPackage(base, name, callback) {
      var key = pathJoin(base, name);
      if (key in packagePaths) return callback(null, packagePaths[key]);
      var metaPath = pathJoin(base, "modules", name, "package.json");
      loader(metaPath, false, function (err, json) {
        if (err) return callback(err);
        if (!json) {
          if (base === "/" || base === ".") return callback();
          return loadPackage(pathJoin(base, ".."), name, callback);
        }
        var meta;
        try { meta = JSON.parse(json); }
        catch (err) { return callback(err); }
        base = pathJoin(metaPath, "..");
        packagePaths[key] = base;
        if (meta.main) {
          aliases[base] = pathJoin(base, meta.main);
        }
        if (meta.browser) {
          for (var original in meta.browser) {
            aliases[pathJoin(base, original)] = pathJoin(base, meta.browser[original]);
          }
        }
        callback(null, base);
      });
    }
  }
}
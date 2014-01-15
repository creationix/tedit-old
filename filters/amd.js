var mine = require('./lib/mine.js');
var pathJoin = require('./lib/pathjoin.js');

module.exports = amd;

function amd(req, callback) {
  var etag = req.target.etag;
  etag = etag.substr(0, etag.length - 1) + '-amd"';
  return callback(null, {etag: etag, fetch: fetch});
  
  function fetch(callback) {
    req.target.fetch(function (err, js) {
      if (err) return callback(err);
      js = "" + js;
      var deps = mine(js);
      var length = deps.length;
      var paths = new Array(length);
      for (var i = length - 1; i >= 0; i--) {
        var dep = deps[i];
        var depPath = pathJoin(req.base, dep.name);
        paths[i] = depPath;
        js = js.substr(0, dep.offset) + depPath + js.substr(dep.offset + dep.name.length);
      }
      var js = "define(" + JSON.stringify(req.path) + ", " + 
          JSON.stringify(paths) + ", function (module, exports) {\n" +
          js + "\n});\n";
      callback(null, js);
    });
  }

}

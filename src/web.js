// Check if a new cache is available on page load.
window.addEventListener('load', function(e) {
  window.applicationCache.addEventListener('updateready', function(e) {
    if (window.applicationCache.status == window.applicationCache.UPDATEREADY) {
      // Browser downloaded a new app cache.
      // if (confirm('A new version of this site is available. Load it?')) {
        window.location.reload();
      // }
    } else {
      // Manifest didn't changed. Nothing new to server.
    }
  }, false);
}, false);

var platform = {
  sha1: require('git-sha1'),
  bops: require('bops-browser'),
  tcp: require('websocket-tcp-client').tcp,
  tls: require('websocket-tcp-client').tls,
  trace: function (name, stream, message) {
    if (stream) return stream;
    console.log(name, message);
  }
};
platform.http = require('git-http')(platform);

require('./app.js')({
  repo: require('js-git')(platform),
  remote: require('git-net')(platform),
  db: require('git-indexeddb')(platform),
  prefs: require('./prefs.js'),
});

var platform = {
  sha1: require('git-sha1'),
  bops: require('bops-browser'),
  tcp: require('./chrome-tcp.js'),
  trace: function (name, stream, message) {
    if (stream) return stream;
    console.log(name, message);
  }
};
platform.http = require('git-http')(platform);

require('./chrome-prefs.js')(function (err, prefs) {
  if (err) throw err;
  require('./app.js')({
    repo: require('js-git')(platform),
    remote: require('git-net')(platform),
    db: require('git-indexeddb')(platform),
    prefs: prefs,
  });
});


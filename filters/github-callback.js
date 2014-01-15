// Embedded config is only for http://localhost:8002 version.
// Other deployments must provide config via environment variables.
var githubConfig = {
  clientId: env.GITHUB_CLIENT_ID || "700f0fceacdc16c17cf9",
  clientSecret: env.GITHUB_CLIENT_SECRET || "ad70cde4f687b0a6caadcfc9eeeec7afab524eb4"
};

module.exports = function (req, callback) {
  var json;
  request({
    protocol: "https",
    method: "POST",
    host: "github.com",
    path: "/login/oauth/access_token",
    headers: {
      "User-Agent": "js-git",
      "Accept": "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      client_id: githubConfig.clientId,
      client_secret: githubConfig.clientSecret,
      code: req.query.code
    })
  }, function (response) {
    if (response.statusCode !== 200) {
      return callback(new Error("Invalid response code from github: " + response.statusCode));
    }
    json = response.body;
    // Make sure it's json
    try { JSON.parse(json); }
    catch (err) { return callback(err); }
    callback(null, {mime: "text/html", fetch: fetch});
  });

  function fetch(callback) {
    callback(null, 
             '<script>' +
             'opener.postMessage(' + json + ', location.origin);' +
             'close();' +
             '</script>');
  }

};

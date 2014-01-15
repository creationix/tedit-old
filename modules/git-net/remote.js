var urlParse = require('./url-parse.js');
module.exports = function (platform) {
  var tcp, http, ws, ssh;
  return processUrl;
  function processUrl(url) {
    var opts = urlParse(url);
    if (opts.protocol === "git:") {
      if (!platform.tcp) throw new Error("Platform does not support git: urls");
      tcp = tcp || require('./tcp.js')(platform);
      return tcp(opts);
    }
    if (opts.protocol === "http:" || opts.protocol === "https:") {
      if (!platform.http) throw new Error("Platform does not support http(s): urls");
      http = http || require('./smart-http.js')(platform);
      return http(opts);
    }
    if (opts.protocol === "ws:" || opts.protocol === "wss:") {
      if (!platform.ws) throw new Error("Platform does not support ws(s): urls");
      ws = ws || require('./ws.js')(platform);
      return ws(opts);
    }
    if (opts.protocol === "ssh:") {
      if (!platform.ssh) throw new Error("Platform does not support ssh: urls");
      ssh = ssh || require('./ssh.js')(platform);
      return ssh(opts);
    }
    throw new Error("Unknown protocol " + opts.protocol);
  }
};

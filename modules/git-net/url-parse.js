module.exports = urlParse;

function urlParse(href) {
  var protocol, username, password, hostname, port, pathname, search, hash;
  var match, host, path;
  // Match URL style remotes
  if (match = href.match(/^(?:(wss?:|https?:|git:|ssh:)\/\/)([^\/]+)([^:]+)$/)) {
    protocol = match[1],
    host = match[2];
    path = match[3];
    match = host.match(/^(?:([^@:]+)(?::([^@]+))?@)?([^@:]+)(?::([0-9]+))?$/);
    username = match[1];
    password = match[2];
    hostname = match[3];
    port = match[4];
    match = path.match(/^([^?]*)(\?[^#]*)?(#.*)?$/);
    pathname = match[1];
    if (protocol === "ssh:") pathname = pathname.substr(1);
    search = match[2];
    hash = match[3];
  }
  // Match scp style ssh remotes
  else if (match = href.match(/^(?:([^@]+)@)?([^:\/]+)([:\/][^:\/][^:]+)$/)) {
    protocol = "ssh:";
    username = match[1];
    host = hostname = match[2];
    path = pathname = match[3];
    if (pathname[0] === ":") pathname = pathname.substr(1);
  }
  else {
    throw new Error("Uknown URL format: " + href);
  }

  if (port) port = parseInt(port, 10);
  else if (protocol === "http:" || protocol === "ws:") port = 80;
  else if (protocol === "https:" || protocol === "wss:") port = 443;
  else if (protocol === "ssh:") port = 22;
  else if (protocol === "git:") port = 9418;

  var opt = {
    href: href,
    protocol: protocol
  };
  if (username) {
    opt.username = username;
    if (password) {
      opt.password = password;
      opt.auth = username + ":" + password;
    }
    else {
      opt.auth = username;
    }
  }
  opt.host = host;
  opt.hostname = hostname;
  opt.port = port;
  opt.path = path;
  opt.pathname = pathname;
  if (search) opt.search = search;
  if (hash) opt.hash = hash;

  return opt;
}

var hostname = window.location.hostname;
if (hostname === "localhost") {
  module.exports = {
    clientId: "700f0fceacdc16c17cf9",
    redirectUri: "http://localhost:8002/github-callback"
  };
}
else if (hostname === "tedit.creationix.com") {
  module.exports = {
    clientId: "f89769973f4842fde5bc",
    redirectUri: "https://tedit.creationix.com/github-callback"
  };
}
else {
  throw new Error("Missing config for hostname: " + hostname);
}

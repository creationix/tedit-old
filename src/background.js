/*global chrome*/
chrome.app.runtime.onLaunched.addListener(function() {
  chrome.app.window.create('/index.html', {
    id: "tim-edit",
  });
});

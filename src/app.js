var SplitView = require('./SplitView.js');
var Editor = require('./Editor.js');
var TreeView = require('./TreeView.js');
var LogView = require('./LogView.js');

module.exports = function (git) {

var prefs = git.prefs;

var body, tree, editor;

var zooms = [
  25, 33, 50, 67, 75, 90, 100, 110, 120, 125, 150, 175, 200, 250, 300, 400, 500
];

var index = prefs.get("zoomIndex", zooms.indexOf(100));
var original = 16;
var size;
var width, height;
var leftSize = prefs.get("leftSize", Math.min(200, window.innerWidth >> 1));
var bottomSize = prefs.get("bottomSize", Math.min(200, window.innerHeight >> 1));
var accessToken = prefs.get("accessToken");

body = new SplitView({
  el: document.body,
  orientation: "bottom",
  size: bottomSize,
  onResize: function (size) {
    if (size === bottomSize) return;
    bottomSize = size;
    prefs.set("bottomSize", bottomSize);
  },
  main: new SplitView({
    orientation: "left",
    size: leftSize,
    onResize: function (size) {
      if (size === leftSize) return;
      leftSize = size;
      prefs.set("leftSize", leftSize);
    },
    main: editor = new Editor({
      "Ctrl-Enter": require('./run.js'),
      "Ctrl-S": function () { tree.stageChanges(); },
      "Ctrl-0": function (cm) {
        index = zooms.indexOf(100);
        prefs.set("zoomIndex", index);
        setSize();
        cm.refresh();
      },
      "Ctrl-=": function (cm) {
        if (index >= zooms.length - 1) return;
        index++;
        prefs.set("zoomIndex", index);
        setSize();
        cm.refresh();
      },
      "Ctrl--": function (cm) {
        if (index <= 0) return;
        index--;
        prefs.set("zoomIndex", index);
        setSize();
        cm.refresh();
      }
    }, prefs),
    side: tree = new TreeView(editor, git)
  }),
  side: new LogView()
});
window.addEventListener('resize', onResize, true);
onResize();
setSize();

function onResize() {
  var newWidth = window.innerWidth;
  var newHeight = window.innerHeight;
  if (newWidth === width && newHeight === height) return;
  width = newWidth, height = newHeight;
  body.resize(width, height);
}

function setSize() {
  var old = size;
  size = zooms[index] * original / 100;
  if (old === size) return;
  document.body.style.fontSize = size + "px";
}

if (!accessToken) {
  var domBuilder = require('dombuilder');
  var authButtons = domBuilder(["div", { css: {
      position: "absolute",
      top: 0,
      right: 0
    }},
    ["button", {
      onclick: startOauth,
      title: "Use this to authenticate with server-assisted oauth2"
    }, "Github Oauth"],
    ["button", {
      onclick: enterToken,
      title: "Manually create a 'Personal Access Token' and enter it here"
    }, "Enter Token"]
  ]);
  document.body.appendChild(authButtons);
}
else {
  console.log("Authenticated with github");
}

function cleanAuth() {
  console.log("Stored Access Token");
  prefs.set("accessToken", accessToken);
  document.body.removeChild(authButtons);
  authButtons = null;
}

function startOauth(evt) {
  evt.preventDefault();
  evt.stopPropagation();
  window.addEventListener("message", onMessage, false);

  function onMessage(evt) {
    window.removeEventListener("message", onMessage, false);
    var tmp = document.createElement('a');
    tmp.href = evt.origin;
    if (tmp.hostname !== window.location.hostname) return;
    accessToken = evt.data.access_token;
    if (accessToken) cleanAuth();
    else throw new Error("Problem getting oauth: " + JSON.stringify(evt.data));
  }
  window.open("https://github.com/login/oauth/authorize" +
    "?client_id=f89769973f4842fde5bc" +
    "&redirect_uri=http://localhost:8002/github-callback" +
    "&scope=repo,user:email");

}

function enterToken(evt) {
  evt.preventDefault();
  evt.stopPropagation();
  accessToken = prompt("Enter access token from https://github.com/settings/applications");
  if (!accessToken) return;
  cleanAuth();
}

};
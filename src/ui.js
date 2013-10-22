
var CodeMirror = require('./codemirror.js');

var code;
if (window.location.hash) {
  code = decodeURIComponent(window.location.hash.substr(1));
}
else {
  code = require("./sample.js#txt");
}

document.body.textContent = "";

var log = console.log = require('domlog');
log.setup({
  // top: 0,
  top: "400px",
  bottom: 0,
  height: "auto",
  background: "#000",
  overflow: "auto",
  fontFamily: 'inherit',
});




var CodeMirror = require('./codemirror.js');

var code;
if (window.location.hash) {
  code = decodeURIComponent(window.location.hash.substr(1));
}
else {
  code = require("./sample.js#txt");
}

document.body.textContent = "";
CodeMirror(document.body, {
  value: code,
  mode:  "javascript",
  theme: "ambiance",
  autofocus: true,
  lineNumbers: true,
  extraKeys: {
    "Ctrl-Enter": run
  }
});

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

var template = require('./template.js#txt');
var worker;
var offset = template.substr(0, template.indexOf("// userCode\n")).split("\n").length - 1;

function run(instance) {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  log.container.textContent = "";
  var userCode = instance.getValue();
  var total = userCode.split("\n").length;
  window.location.hash = encodeURI(userCode);

  var code = template.replace("// userCode", userCode);
  var blob = new Blob([code], {type:"application/javascript"});
  var blobURL = window.URL.createObjectURL(blob);
  worker = new Worker(blobURL);
  worker.onerror = function (evt) {
    evt.preventDefault();
    var details = {};
    var line = evt.lineno - offset;
    var column = evt.colno;
    if (column !== undefined) {
      details.column = column;
    }
    if (line < total) {
      details.line = line;
      instance.setCursor(line - 1, column);
    }
    log(evt.message, details);
  };

  worker.onmessage = function(evt) {
    var data = evt.data;
    if (Array.isArray(data)) log.apply(null, evt.data);
    if (data.error) log(data.error);
  };
  worker.postMessage("");

}

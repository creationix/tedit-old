var template = require('./template.js#txt');
var worker;
var offset = template.substr(0, template.indexOf("// userCode\n")).split("\n").length - 1;

module.exports = run;
function run(instance) {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  console.log.container.textContent = "";
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
    console.log(evt.message, details);
  };

  worker.onmessage = function(evt) {
    var data = evt.data;
    if (Array.isArray(data)) console.log.apply(console, evt.data);
    if (data.error) console.log(data.error);
  };
  worker.postMessage("");

}

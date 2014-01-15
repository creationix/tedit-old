"use strict";

var domBuilder = require('dombuilder');

module.exports = log;
log.toDom = toDom;
log.container = undefined;
log.setup = setup;
log.css =
  ".log:hover{background:rgba(0,0,0,1);height:100%;-webkit-user-select:text;}\n" +
  ".log{background:rgba(0,0,0,0.7);color:#ddd;font-family:monospace;padding:0;position:absolute;left:0;right:0;bottom:0;margin:0;height:200px;overflow:auto;transition:all 1s ease-in-out}\n" +
  ".log .array:after{content:']'}\n" +
  ".log .array:before{content:'['}\n" +
  ".log .binary{color:#88e}\n" +
  ".log .binary:after{content:'>'}\n" +
  ".log .binary:before{content:'<'}\n" +
  ".log .binary:before,.log .binary:after{font-weight:bold;color:#bcf}\n" +
  ".log .boolean{color:#f4a}\n" +
  ".log .error{color:#f33;white-space:pre-wrap}\n" +
  ".log .function{color:#fb0}\n" +
  ".log .null{color:#aaa;font-weight:bold}\n" +
  ".log .number{color:#5cf}\n" +
  ".log .hidden{opacity:0.5}\n" +
  ".log .obj-name{font-style:italic}\n" +
  ".log .object .key:after{content:':';font-weight:bold}\n" +
  ".log .object:after{content:'}'}\n" +
  ".log .object:before{content:'{'}\n" +
  ".log .string{color:#4e2}\n" +
  ".log .string:after{content:'\\201D'}\n" +
  ".log .string:before{content:'\\201C'}\n" +
  ".log .string:before,.log .string:after{color:#5f3;font-weight:bold}\n" +
  ".log .text{color:#fff}\n" +
  ".log .undefined{color:#aaa}\n" +
  ".log > li{padding:5px}\n" +
  ".log > li *{display:inline-block;margin:0 3px;padding:0}\n";

function keys(obj) {
  var data = [];
  for (var key in obj) {
    data.push(key);
  }
  return data;
}

function toDom(val) {
  if (val === null) {
    return ["span.null", "null"];
  }
  if (Array.isArray(val)) {
    return ["ul.array"].concat(
      val.map(function (item) {
        return ["li", toDom(item)];
      })
    );
  }
  if (val instanceof Error) {
    return [".error", val.stack];
  }
  if (val instanceof Uint8Array) {
    var str = val.length.toString(16) + ":";
    for (var i = 0, l = Math.min(val.length, 25); i < l; i++) {
      var c = val[i];
      if (c < 0x10) str += "0" + c.toString(16);
      else str += c.toString(16);
    }
    if (i < val.length) str += "...";
    return [".binary", str];
  }
  var type = typeof val;
  if (type === "object") {
    var name = Object.prototype.toString.call(val);
    name = name.substr(8, name.length - 9);
    var obj = ["dl.object"].concat(
      keys(val).map(function (key) {
        return [
          ["dt", {class: val.hasOwnProperty(key) ? "key" : "key hidden" }, key],
          ["dd", toDom(val[key])]
        ];
      })
    );
    if (name === "Object") return obj;
    return [["span.obj-name", name], obj];
  }
  if (type === "string") {
    val = JSON.stringify(val);
    val = val.substr(1, val.length - 2);
    return ["span.string", val];
  }
  var title = "" + val;
  val = title.split("\n");
  if (val.length > 1) {
    val = val[0] + " ... " + val[val.length - 1];
  }
  else {
    val = val[0];
  }
  return ["span", {title: title, class: type}, document.createTextNode(val)];
}

function setup(extra) {
  var style = document.createElement("style");
  style.textContent = log.css;
  document.head.appendChild(style);
  log.container = domBuilder(["ul.log"]);
  if (extra) {
    for (var key in extra) {
      log.container.style[key] = extra[key];
    }
  }
  document.body.appendChild(log.container);
}

function item(val, i) {
  if (!i && typeof val === "string") return ["span.text", val];
  return toDom(val);
}

function log() {
  if (!log.container) setup();
  var child = domBuilder(["li"].concat(Array.prototype.map.call(arguments, item)));
  log.container.appendChild(child);
  log.container.scrollTop = child.offsetTop;
}

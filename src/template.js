/*global self*/
"use strict";
self.onmessage = function (evt) {
// userCode
};

function print() {
  self.postMessage(Array.prototype.slice.call(arguments));
}

function error(err) {
  self.postMessage({error:""+err});
}

function sleep(ms) {
  var target = Date.now() + ms;
  while (Date.now() < target);
}

function range(end) {
  var i = 0;
  return function () {
    if (i < end) return i++;
  };
}

function each(target, callback) {
  if (Array.isArray(target)) {

  }
  var item;
  while ((item = gen()) !== undefined) {
    callback(item);
  }
}
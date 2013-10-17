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
  if (callback.length < 1 || callback.length > 2) {
    throw new Error("Loop function must have 1 or 2 arguments");
  }
  if (Array.isArray(target)) {
    return arrayEach(target, callback);
  }
  if (typeof target === "function") {
    return genEach(target, callback);
  }
  if (target && typeof target === "object") {
    return objEach(target, callback);
  }
  throw new Error("Can only loop over arrays, objects, or generator functions");
}

function arrayEach(array, callback) {
  var arity = callback.length;
  for (var i = 0, l = array.length; i < l; i++) {
    if (arity === 1) callback(array[i]);
    else callback(i, array[i]);
  }
}

function genEach(gen, callback) {
  var arity = callback.length;
  var item;
  var i = 0;
  while ((item = gen()) !== undefined) {
    if (arity === 1) callback(item);
    else callback(i++, item);
  }
}

function objEach(obj, callback) {
  var arity = callback.length;
  for (var key in obj) {
    var value = obj[key];
    if (arity === 1) callback(value);
    else callback(key, value);
  }
}
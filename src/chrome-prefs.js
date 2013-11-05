/*global chrome*/
var local = chrome.storage.local;

var prefs = {};
var writing = false, queued = false;

module.exports = function (callback) {
  local.get("prefs", function (evt) {
    if (chrome.runtime.lastError) throw new Error(chrome.runtime.lastError.message);
    prefs = prefs || evt.prefs;
    callback(null, { get: get, set: set });
  });
};

function get(name, def) {
  if (!(name in prefs)) return def;
  return prefs[name];
}

function set(name, value) {
  prefs[name] = value;
  if (writing) {
    queued = true;
    return;
  }
  writing = true;
  local.set({prefs:prefs}, onSet);
}

function onSet() {
  if (chrome.runtime.lastError) throw new Error(chrome.runtime.lastError.message);
  if (!queued) {
    writing = false;
    return;
  }
  queued = false;
  local.set({prefs:prefs}, onSet);
}

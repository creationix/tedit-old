var prefs = {};
var json;
try {
  json = localStorage.getItem("prefs");
  if (json) prefs = JSON.parse(json) || prefs;
}
catch (err) {
  console.warn(err.toString());
}

var timer;

module.exports = {
  get: function (name, def) {
    if (!(name in prefs)) return def;
    return prefs[name];
  },
  set: function (name, value) {
    prefs[name] = value;
    if (timer) return;
    save();
    timer = setTimeout(save, 13);
  }
};

function save() {
  timer = null;
  var newJson = JSON.stringify(prefs);
  if (newJson === json) return;
  json = newJson;
  localStorage.setItem("prefs", json);
}
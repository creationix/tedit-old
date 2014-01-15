module.exports = function deline(emit) {
  var buffer = "";
  return function (chunk) {
    var start = 0;
    for (var i = 0, l = chunk.length; i < l; ++i) {
      var c = chunk[i];
      if (c === "\r" || c === "\n") {
        buffer += chunk.substr(start, i - start + 1);
        start = i + 1;
        emit(buffer);
        buffer = "";
      }
    }
    buffer += chunk.substr(start);
  };
};

// Mini control-flow library
module.exports = function serial() {
  var i = 0, steps = arguments, callback;

  return function (cb) {
    callback = cb;
    return next();
  };

  function next(err) {
    if (err) return callback(err);
    var step = steps[i++];
    if (!step) return callback();
    return step(next);
  }
};

module.exports = less;

function less(req, callback) {
  callback(null, {etag: req.target.etag, fetch: fetch});
  
  function fetch(callback) {
    callback(null, "TODO: Implement less");
  }
}
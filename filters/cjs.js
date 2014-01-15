module.exports = cjs;

function cjs(req, callback) {
  console.log(req);
  callback(null, {etag:req.target.etag, fetch: fetch});
  
  function fetch(callback) {
    callback(null, "TODO: Implement cjs");
  }
}
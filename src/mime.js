// Tiny mime library that helps us know which files we can edit and what icons to show.
var mimes = {
  "text/javascript": /\.js$/i,
  "text/css": /\.css$/i,
  "text/x-sh": /\.sh$/i,
  "text/html": /\.html?$/i,
  "text/x-markdown": /\.(?:md|markdown)$/i,
  "text/xml": /\.xml$/i,
  "text/typescript": /\.ts$/i,
  "text/x-less": /\.less$/i,
  "text/cache-manifest": /\.appcache$/i,
  "application/json": /\.(?:json|webapp)$/i,
  "image/svg+xml": /\.svg$/i,
  "image/png": /\.png$/i,
  "image/jpeg": /\.jpe?g$/i,
  "image/gif": /\.gif$/i,
  "video/mpeg": /\.mpe?g$/i,
  "video/mp4": /\.(?:mp4|m4v)$/i,
  "video/ogg": /\.ogg$/i,
  "video/webm": /\.webm$/i,
  "application/zip": /\.zip$/i,
  "application/gzip": /\.(?:gz|tgz)$/i,
  "text/plain": /(?:^(?:README|LICENSE)|\.(?:txt|log)$)/i,
};

module.exports = function (path) {
  for (var mime in mimes) {
    if (mimes[mime].test(path)) return mime;
  }
  return "text/plain";
};

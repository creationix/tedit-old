module.exports = LogView;

// The minimal interface to work as splitview items
function LogView() {
  var log = console.log = console.error = require('domlog');
  log.setup({
    transition: "inherit",
    background: "#000",
    overflow: "auto",
  });
  this.el = log.container;
  document.body.removeChild(log.container);
}
// Must respond to resize commands and set your own width and height
// The offset (top or left) will be set by splitview
LogView.prototype.resize = function (width, height) {
  this.el.style.width = width + "px";
  this.el.style.height = height + "px";
};

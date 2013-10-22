module.exports = Cell;
// The minimal interface to work as splitview items
function Cell() {
  // Must export your root element as this.el
  this.el = document.createElement("div");
}
// Must respond to resize commands and set your own width and height
// The offset (top or left) will be set by splitview
Cell.prototype.resize = function (width, height) {
  this.el.style.width = width + "px";
  this.el.style.height = height + "px";
};

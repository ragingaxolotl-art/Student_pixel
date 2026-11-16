/**
 * Base class for all select tools that use a dragging mechanism to define the selection.
 *
 * @provide pskl.tools.drawing.selection.AbstractDragSelect
 */
(function () {
  var ns = $.namespace("pskl.tools.drawing.selection");

  ns.AbstractDragSelect = function () {
    ns.BaseSelect.call(this);
  };

  pskl.utils.inherit(ns.AbstractDragSelect, ns.BaseSelect);

  /** @override */
  ns.AbstractDragSelect.prototype.onSelectStart_ = function (
    col,
    row,
    frame,
    overlay
  ) {
    this.onDragSelectStart_(col, row);
    this.onDragSelect_(col, row, frame, overlay);
  };

  /** @override */
  ns.AbstractDragSelect.prototype.onSelect_ = function (
    col,
    row,
    frame,
    overlay
  ) {
    this.onDragSelect_(col, row, frame, overlay);
  };

  /** @override */
  ns.AbstractDragSelect.prototype.onSelectEnd_ = function (
    col,
    row,
    frame,
    overlay
  ) {
    this.onDragSelectEnd_(col, row, frame, overlay);
  };

  /** @private */
  ns.AbstractDragSelect.prototype.startDragSelection_ = function (
    col,
    row,
    overlay
  ) {
    this.hasSelection = true;
    this.onDragSelectStart_(col, row);
    overlay.setPixel(
      col,
      row,
      this.getTransparentVariant_(Constants.SELECTION_TRANSPARENT_COLOR)
    );
  };

  /** @protected */
  ns.AbstractDragSelect.prototype.onDragSelectStart_ = function (
    col,
    row,
    frame,
    overlay
  ) {};
  /** @protected */
  ns.AbstractDragSelect.prototype.onDragSelect_ = function (
    col,
    row,
    frame,
    overlay
  ) {};
  /** @protected */
  ns.AbstractDragSelect.prototype.onDragSelectEnd_ = function (
    col,
    row,
    frame,
    overlay
  ) {};
})();

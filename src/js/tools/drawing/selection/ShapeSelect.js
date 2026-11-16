/**
 * @provide pskl.tools.drawing.selection.ShapeSelect
 *
 * @require pskl.utils
 */
(function () {
  var ns = $.namespace("pskl.tools.drawing.selection");

  ns.ShapeSelect = function () {
    ns.BaseSelect.call(this);

    this.toolId = "tool-shape-select";
    this.helpText = "Shape selection";
    this.shortcut = pskl.service.keyboard.Shortcuts.TOOL.SHAPE_SELECT;
  };

  pskl.utils.inherit(ns.ShapeSelect, ns.BaseSelect);

  /**
   * For the shape select tool, you just need to click one time to create a selection.
   * So we just need to implement onSelectStart_ (no need for onSelect_ & onSelectEnd_)
   * @override
   */
  ns.ShapeSelect.prototype.onSelectStart_ = function (
    col,
    row,
    frame,
    overlay
  ) {
    // From the pixel clicked, get shape using an algorithm similar to the paintbucket one:
    var pixels = pskl.PixelUtils.getSimilarConnectedPixelsFromFrame(
      frame,
      col,
      row
    );
    this.updateSelection_(
      new pskl.selection.ShapeSelection(pixels),
      frame,
      overlay
    );
  };
})();

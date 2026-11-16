(function () {
  var ns = $.namespace("pskl.tools.transform");

  ns.Rotate = function (angle) {
    this.angle = angle || 90;
    this.toolId = this.angle === 45 ? "tool-rotate-45" : "tool-rotate";
    this.helpText =
      this.angle === 45
        ? "45° counter-clockwise rotation"
        : "Counter-clockwise rotation";
    this.tooltipDescriptors = [
      { key: "alt", description: "Clockwise rotation" },
      { key: "ctrl", description: "Apply to all layers" },
      { key: "shift", description: "Apply to all frames" }
    ];
  };

  pskl.utils.inherit(ns.Rotate, ns.AbstractTransformTool);

  ns.Rotate.prototype.applyToolOnFrame_ = function (frame, altKey) {
    var direction;

    if (altKey) {
      direction = ns.TransformUtils.CLOCKWISE;
    } else {
      direction = ns.TransformUtils.COUNTERCLOCKWISE;
    }

    if (this.angle === 45) {
      ns.TransformUtils.rotate45(frame, direction);
    } else {
      ns.TransformUtils.rotate(frame, direction);
    }
  };
})();

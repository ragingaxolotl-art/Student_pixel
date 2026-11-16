(function () {
  var ns = $.namespace("pskl.selection");

  ns.BaseSelection = function () {
    this.reset();
  };

  // A gesture always combines with its original mask, rather than accumulating
  // every intermediate rectangle/lasso. Only geometry belongs in the mask.
  ns.BaseSelection.combine = function (base, incoming, operation, frame) {
    var mask = new Map();
    function valid(p) {
      return (
        Number.isInteger(p.col) &&
        Number.isInteger(p.row) &&
        frame.containsPixel(p.col, p.row)
      );
    }
    function add(p) {
      if (valid(p)) {
        mask.set(p.col + ":" + p.row, { col: p.col, row: p.row });
      }
    }
    if (operation !== "replace") {
      base.forEach(add);
    }
    incoming.forEach(function (p) {
      if (operation === "subtract") {
        mask.delete(p.col + ":" + p.row);
      } else {
        add(p);
      }
    });
    return new ns.ShapeSelection(Array.from(mask.values()));
  };

  ns.BaseSelection.prototype.stringify = function () {
    return JSON.stringify({
      pixels: this.pixels,
      time: this.time
    });
  };

  ns.BaseSelection.prototype.parse = function (str) {
    var selectionData = JSON.parse(str);
    this.pixels = selectionData.pixels;
    this.time = selectionData.time;
  };

  ns.BaseSelection.prototype.reset = function () {
    this.pixels = [];
    this.hasPastedContent = false;
    this.time = -1;
  };

  ns.BaseSelection.prototype.move = function (colDiff, rowDiff) {
    var movedPixels = [];

    for (var i = 0, l = this.pixels.length; i < l; i++) {
      var movedPixel = this.pixels[i];
      movedPixel.col += colDiff;
      movedPixel.row += rowDiff;
      movedPixels.push(movedPixel);
    }

    this.pixels = movedPixels;
  };

  ns.BaseSelection.prototype.fillSelectionFromFrame = function (targetFrame) {
    this.pixels.forEach(function (pixel) {
      var color = targetFrame.getPixel(pixel.col, pixel.row);
      pixel.color = color || Constants.TRANSPARENT_COLOR;
    });

    this.hasPastedContent = true;
    // Keep track of the selection time to compare between local selection and
    // paste event selections.
    this.time = Date.now();
  };
})();

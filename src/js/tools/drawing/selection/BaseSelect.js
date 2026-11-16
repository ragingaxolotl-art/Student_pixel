/**
 * @provide pskl.tools.drawing.selection.BaseSelect
 *
 * @require pskl.utils
 */
(function () {
  var ns = $.namespace("pskl.tools.drawing.selection");

  ns.BaseSelect = function () {
    this.secondaryToolId = pskl.tools.drawing.Move.TOOL_ID;

    // Select's first point coordinates (set in applyToolAt)
    this.startCol = null;
    this.startRow = null;

    this.lastMoveCol = null;
    this.lastMoveRow = null;

    this.selection = null;
    this.hasSelection = false;

    this.tooltipDescriptors = [
      {
        description:
          "Drag the selection to move it. You may switch to other layers and frames."
      },
      { key: "ctrl+c", description: "Copy the selected area" },
      { key: "ctrl+v", description: "Paste the copied area" },
      { key: "shift", description: "Add to selection" },
      { description: "Control-click/drag subtracts (Command also works)" },
      { key: "alt", description: "Drag selected pixels to move them" },
      {
        get key() {
          return pskl.service.keyboard.Shortcuts.SELECTION.LIFT.getDisplayKey();
        },
        description: "Lift selected pixels to a new layer"
      }
    ];

    $.subscribe(
      Events.SELECTION_DISMISSED,
      this.onSelectionDismissed_.bind(this)
    );
    window.addEventListener(
      "blur",
      function () {
        if (this.isMovingContent_) {
          this.commitSelection();
        }
      }.bind(this)
    );
  };

  pskl.utils.inherit(ns.BaseSelect, pskl.tools.drawing.BaseTool);

  ns.BaseSelect.prototype.supportsAlt = function () {
    return true;
  };

  /**
   * @override
   */
  ns.BaseSelect.prototype.applyToolAt = function (
    col,
    row,
    frame,
    overlay,
    event
  ) {
    event = event || {};
    if (!frame.containsPixel(col, row)) {
      this.mode = null;
      return;
    }
    var current = pskl.app.selectionManager.currentSelection;
    this.selection = current;
    this.hasSelection = !!(current && current.pixels.length);
    this.selectionOperation_ =
      event.ctrlKey || event.metaKey
        ? "subtract"
        : event.shiftKey
          ? "add"
          : "replace";
    this.selectionBase_ = current
      ? current.pixels.map(function (p) {
          return { col: p.col, row: p.row };
        })
      : [];
    this.startCol = col;
    this.startRow = row;

    this.lastMoveCol = col;
    this.lastMoveRow = row;

    // The select tool can be in two different state.
    // If the initial click of the tool is not on a selection, we go in 'select'
    // mode to create a selection.
    // If the initial click is on a previous selection, we go in 'moveSelection'
    // mode to allow to move the selection by drag'n dropping it.
    if (
      this.selectionOperation_ !== "replace" ||
      !this.isInSelection(col, row)
    ) {
      if (this.selectionOperation_ === "replace") {
        this.commitSelection();
      }
      this.mode = "select";
      this.hasSelection = false;
      this.onSelectStart_(col, row, frame, overlay);
    } else {
      this.mode = "moveSelection";
      if (event.altKey && !this.isMovingContent_) {
        var c = pskl.app.piskelController,
          layer = c.getCurrentLayer(),
          g = pskl.utils.LayerGroupUtils;
        if (
          layer.isLocked() ||
          layer.rowState.hidden ||
          g.isGroup(layer) ||
          g.ancestors(c.getLayers(), layer).some(function (p) {
            return p.rowState.hidden;
          })
        ) {
          this.mode = null;
          return;
        }
        this.moveSource_ = frame;
        this.moveOriginal_ = frame.clone();
        this.selection.fillSelectionFromFrame(frame);
        this.isMovingContent_ = true;
        this.selection.pixels.forEach(function (p) {
          frame.setPixel(p.col, p.row, Constants.TRANSPARENT_COLOR);
        });
        this.drawSelectionOnOverlay_(overlay);
      }
      this.onSelectionMoveStart_(col, row, frame, overlay);
    }
  };

  /**
   * @override
   */
  ns.BaseSelect.prototype.moveToolAt = function (
    col,
    row,
    frame,
    overlay,
    event
  ) {
    if (this.mode == "select") {
      this.onSelect_(col, row, frame, overlay);
    } else if (this.mode == "moveSelection") {
      this.onSelectionMove_(col, row, frame, overlay);
    }
  };

  /**
   * @override
   */
  ns.BaseSelect.prototype.releaseToolAt = function (
    col,
    row,
    frame,
    overlay,
    event
  ) {
    if (this.mode == "select") {
      this.onSelectEnd_(col, row, frame, overlay);
    } else if (this.mode == "moveSelection") {
      this.onSelectionMoveEnd_(col, row, frame, overlay);
    }
    this.mode = null;
    this.selectionBase_ = null;
    if (!this.hasSelection) {
      $.publish(Events.SELECTION_DISMISSED);
    }
  };

  /**
   * If we mouseover the selection draw inside the overlay frame, show the 'move' cursor
   * instead of the 'select' one. It indicates that we can move the selection by dragndroping it.
   * @override
   */
  ns.BaseSelect.prototype.moveUnactiveToolAt = function (
    col,
    row,
    frame,
    overlay,
    event
  ) {
    event = event || {};
    if (overlay.containsPixel(col, row)) {
      if (
        !event.shiftKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        this.isInSelection(col, row)
      ) {
        // We're hovering the selection, show the move tool:
        document.body.classList.add(this.secondaryToolId);
        document.body.classList.remove(this.toolId);
      } else {
        // We're not hovering the selection, show create selection tool:
        document.body.classList.add(this.toolId);
        document.body.classList.remove(this.secondaryToolId);
      }
    }

    if (!this.hasSelection) {
      pskl.tools.drawing.BaseTool.prototype.moveUnactiveToolAt.apply(
        this,
        arguments
      );
    }
  };

  ns.BaseSelect.prototype.isInSelection = function (col, row) {
    return (
      this.selection &&
      this.selection.pixels.some(function (pixel) {
        return pixel.col === col && pixel.row === row;
      })
    );
  };

  /**
   * Protected method, should be called when the selection is committed,
   * typically by clicking outside of the selected area.
   */
  ns.BaseSelect.prototype.commitSelection = function () {
    // Clean previous selection:
    $.publish(Events.SELECTION_DISMISSED);
  };

  /**
   * Protected method, should be called when the selection is dismissed.
   */
  ns.BaseSelect.prototype.onSelectionDismissed_ = function () {
    // Switching projects/tools during an unfinished pixel drag cancels it.
    if (this.isMovingContent_ && this.moveSource_ && this.moveOriginal_) {
      this.moveSource_.setPixels(this.moveOriginal_.pixels);
    }
    this.isMovingContent_ = false;
    this.moveSource_ = this.moveOriginal_ = null;
    var overlay = pskl.app.drawingController.overlayFrame;
    overlay.clear();
    this.hasSelection = false;
    this.selection = null;
    this.mode = null;
  };

  ns.BaseSelect.prototype.updateSelection_ = function (
    selection,
    frame,
    overlay
  ) {
    this.selection = pskl.selection.BaseSelection.combine(
      this.selectionBase_ || [],
      selection.pixels,
      this.selectionOperation_ || "replace",
      frame
    );
    this.hasSelection = this.selection.pixels.length > 0;
    $.publish(Events.SELECTION_CREATED, [this.selection]);
    overlay.clear();
    this.drawSelectionOnOverlay_(overlay);
  };

  /**
   * For each pixel in the selection draw it in white transparent on the tool overlay
   * @protected
   */
  ns.BaseSelect.prototype.drawSelectionOnOverlay_ = function (overlay) {
    var pixels = this.selection.pixels;
    for (var i = 0, l = pixels.length; i < l; i++) {
      var pixel = pixels[i];
      var hasColor = pixel.color && pixel.color !== Constants.TRANSPARENT_COLOR;
      var color = hasColor
        ? this.getTransparentVariant_(pixel.color)
        : Constants.SELECTION_TRANSPARENT_COLOR;

      overlay.setPixel(pixels[i].col, pixels[i].row, color);
    }
  };

  ns.BaseSelect.prototype.getTransparentVariant_ =
    pskl.utils.FunctionUtils.memo(function (colorStr) {
      if (typeof colorStr === "number") {
        colorStr = pskl.utils.intToColor(colorStr);
      }
      var color = window.tinycolor(colorStr);
      color = window.tinycolor.lighten(color, 10);
      color.setAlpha(0.5);
      return color.toRgbString();
    }, {});

  // The list of callbacks to implement by specialized tools to implement the selection creation behavior.
  /** @protected */
  ns.BaseSelect.prototype.onSelectStart_ = function (
    col,
    row,
    frame,
    overlay
  ) {};
  /** @protected */
  ns.BaseSelect.prototype.onSelect_ = function (col, row, frame, overlay) {};
  /** @protected */
  ns.BaseSelect.prototype.onSelectEnd_ = function (col, row, frame, overlay) {};

  // The list of callbacks that define the drag'n drop behavior of the selection.
  /** @private */

  ns.BaseSelect.prototype.onSelectionMoveStart_ = function (
    col,
    row,
    frame,
    overlay
  ) {};

  /** @private */
  ns.BaseSelect.prototype.onSelectionMove_ = function (
    col,
    row,
    frame,
    overlay
  ) {
    var deltaCol = col - this.lastMoveCol;
    var deltaRow = row - this.lastMoveRow;

    this.selection.move(deltaCol, deltaRow);

    overlay.clear();
    this.drawSelectionOnOverlay_(overlay);

    this.lastMoveCol = col;
    this.lastMoveRow = row;
  };

  /** @private */
  ns.BaseSelect.prototype.onSelectionMoveEnd_ = function (
    col,
    row,
    frame,
    overlay
  ) {
    this.onSelectionMove_(col, row, frame, overlay);
    if (this.isMovingContent_) {
      if (frame !== this.moveSource_) {
        this.commitSelection();
        return;
      }
      this.selection.pixels.forEach(function (p) {
        if (pskl.utils.colorToInt(p.color) >>> 24) {
          frame.setPixel(p.col, p.row, p.color);
        }
      });
      var changed = frame.pixels.some(
        function (p, i) {
          return p !== this.moveOriginal_.pixels[i];
        }.bind(this)
      );
      this.isMovingContent_ = false;
      this.moveSource_ = this.moveOriginal_ = null;
      this.selection.pixels = this.selection.pixels.map(function (p) {
        return { col: p.col, row: p.row };
      });
      this.selection.hasPastedContent = false;
      overlay.clear();
      this.drawSelectionOnOverlay_(overlay);
      if (changed) {
        $.publish(Events.PISKEL_SAVE_STATE, {
          type: pskl.service.HistoryService.SNAPSHOT
        });
      }
    }
  };
})();

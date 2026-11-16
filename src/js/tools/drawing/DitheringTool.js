/**
 * @provide pskl.tools.drawing.DitheringTool
 *
 * @require pskl.utils
 */
(function () {
  var ns = $.namespace("pskl.tools.drawing");

  ns.DitheringTool = function () {
    ns.SimplePen.call(this);
    this.toolId = "tool-dithering";
    this.helpText = "Dithering tool";
    this.shortcut = pskl.service.keyboard.Shortcuts.TOOL.DITHERING;
  };

  pskl.utils.inherit(ns.DitheringTool, ns.SimplePen);

  ns.DitheringTool.prototype.supportsDynamicPenSize = function () {
    return (
      pskl.utils.DitherPaintUtils.settings(
        pskl.UserSettings.get(pskl.UserSettings.DITHER_SETTINGS)
      ).paint !== "bucket"
    );
  };

  /**
   * @override
   */
  ns.DitheringTool.prototype.applyToolAt = function (
    col,
    row,
    frame,
    overlay,
    event
  ) {
    this.previousCol = col;
    this.previousRow = row;
    this.ditherSettings_ = pskl.utils.DitherPaintUtils.settings(
      pskl.UserSettings.get(pskl.UserSettings.DITHER_SETTINGS)
    );

    if (this.ditherSettings_.paint === "bucket") {
      this.bucketGesture_ = {
        bucket: true,
        col: col,
        row: row,
        settings: JSON.parse(JSON.stringify(this.ditherSettings_)),
        primary: pskl.app.selectedColorsService.getPrimaryColor(),
        secondary: pskl.app.selectedColorsService.getSecondaryColor(),
        reverse: pskl.app.mouseStateService.isRightButtonPressed(),
        opacity: pskl.UserSettings.get(pskl.UserSettings.BRUSH_OPACITY)
      };
      var fill = this.bucketGesture_;
      pskl.utils.DitherPaintUtils.fill(
        frame,
        col,
        row,
        fill.settings,
        fill.primary,
        fill.secondary,
        fill.reverse,
        fill.opacity
      );
      return;
    }

    var penSize = pskl.app.penSizeService.getPenSize();
    var points = pskl.PixelUtils.resizePixel(col, row, penSize);
    points.forEach(
      function (point) {
        this.applyToolOnPixel(point[0], point[1], frame, overlay, event);
      }.bind(this)
    );
  };

  ns.DitheringTool.prototype.applyToolOnPixel = function (
    col,
    row,
    frame,
    overlay,
    event
  ) {
    var settings =
      this.ditherSettings_ ||
      pskl.utils.DitherPaintUtils.settings(
        pskl.UserSettings.get(pskl.UserSettings.DITHER_SETTINGS)
      );
    var usePrimaryColor = pskl.utils.DitherPatterns.sample(col, row, settings);
    if (settings.fill === "gradient") {
      this.draw(
        pskl.utils.DitherPaintUtils.opacity(
          pskl.utils.DitherPaintUtils.gradientColor(
            col,
            row,
            settings,
            {
              minX: 0,
              minY: 0,
              maxX: frame.getWidth() - 1,
              maxY: frame.getHeight() - 1
            },
            pskl.app.mouseStateService.isRightButtonPressed()
          ),
          pskl.UserSettings.get(pskl.UserSettings.BRUSH_OPACITY)
        ),
        col,
        row,
        frame,
        overlay
      );
      return;
    }
    if (!usePrimaryColor && settings.colors === "primary") {
      return;
    }

    if (pskl.app.mouseStateService.isRightButtonPressed()) {
      usePrimaryColor = !usePrimaryColor;
    }

    var ditheringColor = usePrimaryColor
      ? pskl.app.selectedColorsService.getPrimaryColor()
      : pskl.app.selectedColorsService.getSecondaryColor();

    this.draw(
      pskl.utils.DitherPaintUtils.opacity(
        ditheringColor,
        pskl.UserSettings.get(pskl.UserSettings.BRUSH_OPACITY)
      ),
      col,
      row,
      frame,
      overlay
    );
  };
  ns.DitheringTool.prototype.moveToolAt = function () {
    if (!this.bucketGesture_) {
      ns.SimplePen.prototype.moveToolAt.apply(this, arguments);
    }
  };
  ns.DitheringTool.prototype.releaseToolAt = function () {
    if (this.bucketGesture_) {
      var state = this.bucketGesture_;
      this.bucketGesture_ = null;
      this.raiseSaveStateEvent(state);
    } else {
      ns.SimplePen.prototype.releaseToolAt.apply(this, arguments);
    }
  };
  ns.DitheringTool.prototype.replay = function (frame, state) {
    if (state.bucket) {
      pskl.utils.DitherPaintUtils.fill(
        frame,
        state.col,
        state.row,
        state.settings,
        state.primary,
        state.secondary,
        state.reverse,
        state.opacity
      );
    } else {
      ns.SimplePen.prototype.replay.call(this, frame, state);
    }
  };
})();

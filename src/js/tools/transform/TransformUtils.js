(function () {
  var ns = $.namespace("pskl.tools.transform");
  var rotationStates = new WeakMap();
  var cosines = [
    1,
    Math.SQRT1_2,
    0,
    -Math.SQRT1_2,
    -1,
    -Math.SQRT1_2,
    0,
    Math.SQRT1_2
  ];

  var getRotationState = function (frame) {
    var state = rotationStates.get(frame);
    return state && state.version === frame.version ? state : null;
  };

  ns.TransformUtils = {
    VERTICAL: "VERTICAL",
    HORIZONTAL: "HORIZONTAL",
    flip: function (frame, axis) {
      var clone = frame.clone();
      var w = frame.getWidth();
      var h = frame.getHeight();

      clone.forEachPixel(function (color, x, y) {
        if (axis === ns.TransformUtils.VERTICAL) {
          x = w - x - 1;
        } else if (axis === ns.TransformUtils.HORIZONTAL) {
          y = h - y - 1;
        }
        frame.setPixel(x, y, color);
      });

      return frame;
    },

    CLOCKWISE: "clockwise",
    COUNTERCLOCKWISE: "counterclockwise",
    rotate: function (frame, direction) {
      // A quarter turn during a 45° sequence uses the same original pixels.
      if (getRotationState(frame)) {
        return ns.TransformUtils.rotate45(frame, direction, 2);
      }
      var clone = frame.clone();
      var w = frame.getWidth();
      var h = frame.getHeight();

      var max = Math.max(w, h);
      var xDelta = Math.ceil((max - w) / 2);
      var yDelta = Math.ceil((max - h) / 2);

      frame.forEachPixel(function (color, x, y) {
        var _x = x;
        var _y = y;

        // Convert to square coords
        x = x + xDelta;
        y = y + yDelta;

        // Perform the rotation
        var tmpX = x;
        var tmpY = y;
        if (direction === ns.TransformUtils.CLOCKWISE) {
          x = tmpY;
          y = max - 1 - tmpX;
        } else if (direction === ns.TransformUtils.COUNTERCLOCKWISE) {
          y = tmpX;
          x = max - 1 - tmpY;
        }

        // Convert the coordinates back to the rectangular grid
        x = x - xDelta;
        y = y - yDelta;
        if (clone.containsPixel(x, y)) {
          frame.setPixel(_x, _y, clone.getPixel(x, y));
        } else {
          frame.setPixel(_x, _y, Constants.TRANSPARENT_COLOR);
        }
      });

      return frame;
    },

    rotate45: function (frame, direction, increments) {
      var state = getRotationState(frame);
      var source = state ? state.source : frame.clone();
      var delta = direction === ns.TransformUtils.CLOCKWISE ? 1 : -1;
      var steps =
        ((state ? state.steps : 0) + delta * (increments || 1) + 8) % 8;
      var centerX = (frame.getWidth() - 1) / 2;
      var centerY = (frame.getHeight() - 1) / 2;
      // Exact 0/1 values keep quarter and half turns pixel-perfect.
      var cos = cosines[steps];
      var sin = cosines[(steps + 6) % 8];

      // Always sample the original, never the previous resampled result.
      // Editing pixels changes the frame version and starts a new sequence.
      frame.forEachPixel(function (color, x, y) {
        var dx = x - centerX;
        var dy = y - centerY;
        var sourceX = Math.round(centerX + dx * cos + dy * sin);
        var sourceY = Math.round(centerY - dx * sin + dy * cos);
        var sourceColor = source.containsPixel(sourceX, sourceY)
          ? source.getPixel(sourceX, sourceY)
          : Constants.TRANSPARENT_COLOR;
        frame.setPixel(x, y, sourceColor);
      });

      rotationStates.set(frame, {
        source: source,
        steps: steps,
        version: frame.version
      });

      return frame;
    },

    captureRotationStates: function (piskel) {
      var states = [];
      piskel.getLayers().forEach(function (layer, layerIndex) {
        layer.getFrames().forEach(function (frame, frameIndex) {
          var state = getRotationState(frame);
          if (state) {
            states.push({
              layerIndex: layerIndex,
              frameIndex: frameIndex,
              source: state.source,
              steps: state.steps
            });
          }
        });
      });
      return states;
    },

    restoreRotationStates: function (piskel, states) {
      (states || []).forEach(function (state) {
        var frame = piskel
          .getLayerAt(state.layerIndex)
          .getFrameAt(state.frameIndex);
        rotationStates.set(frame, {
          source: state.source,
          steps: state.steps,
          version: frame.version
        });
      });
    },

    getBoundaries: function (frames) {
      var minx = +Infinity;
      var miny = +Infinity;
      var maxx = 0;
      var maxy = 0;

      var transparentColorInt = pskl.utils.colorToInt(
        Constants.TRANSPARENT_COLOR
      );

      frames.forEach(function (frame) {
        frame.forEachPixel(function (color, x, y) {
          if (color !== transparentColorInt) {
            minx = Math.min(minx, x);
            maxx = Math.max(maxx, x);
            miny = Math.min(miny, y);
            maxy = Math.max(maxy, y);
          }
        });
      });

      return {
        minx: minx,
        maxx: maxx,
        miny: miny,
        maxy: maxy
      };
    },

    moveFramePixels: function (frame, dx, dy) {
      var clone = frame.clone();
      frame.forEachPixel(function (color, x, y) {
        var _x = x;
        var _y = y;

        x -= dx;
        y -= dy;

        if (clone.containsPixel(x, y)) {
          frame.setPixel(_x, _y, clone.getPixel(x, y));
        } else {
          frame.setPixel(_x, _y, Constants.TRANSPARENT_COLOR);
        }
      });
    },

    center: function (frame) {
      // Figure out the boundary
      var boundaries = ns.TransformUtils.getBoundaries([frame]);

      // Calculate how much to move the pixels
      var bw = (boundaries.maxx - boundaries.minx + 1) / 2;
      var bh = (boundaries.maxy - boundaries.miny + 1) / 2;
      var fw = frame.width / 2;
      var fh = frame.height / 2;

      var dx = Math.floor(fw - bw - boundaries.minx);
      var dy = Math.floor(fh - bh - boundaries.miny);

      // Actually move the pixels

      ns.TransformUtils.moveFramePixels(frame, dx, dy);
      return frame;
    }
  };
})();

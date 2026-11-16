(function () {
  var ns = $.namespace("pskl.utils");
  ns.NormalMapUtils = {
    create: function (frame, options) {
      var strength = Number(options.strength);
      if (!Number.isFinite(strength) || strength < 0.1 || strength > 64) {
        throw new Error("Normal-map strength must be from 0.1 to 64.");
      }
      var width = frame.getWidth(),
        height = frame.getHeight();
      var source = frame.getPixels();
      var heights = Float32Array.from(source, function (pixel) {
        return (
          ((((pixel & 255) * 0.2126 +
            ((pixel >>> 8) & 255) * 0.7152 +
            ((pixel >>> 16) & 255) * 0.0722) /
            255) *
            (pixel >>> 24)) /
          255
        );
      });
      var sample = function (x, y) {
        if (options.wrap) {
          x = (x + width) % width;
          y = (y + height) % height;
        } else {
          x = Math.max(0, Math.min(width - 1, x));
          y = Math.max(0, Math.min(height - 1, y));
        }
        return heights[y * width + x];
      };
      var pixels = new Uint32Array(width * height);
      for (var y = 0; y < height; y++) {
        for (var x = 0; x < width; x++) {
          var dx = ((sample(x + 1, y) - sample(x - 1, y)) * strength) / 2;
          var dy = ((sample(x, y + 1) - sample(x, y - 1)) * strength) / 2;
          var length = Math.hypot(dx, dy, 1);
          var red = Math.round((1 - dx / length) * 127.5);
          var green = Math.round(
            (1 + (options.flipY ? -dy : dy) / length) * 127.5
          );
          var blue = Math.round((1 + 1 / length) * 127.5);
          var alpha = options.keepAlpha ? source[y * width + x] >>> 24 : 255;
          pixels[y * width + x] = alpha
            ? (((alpha << 24) >>> 0) | (blue << 16) | (green << 8) | red) >>> 0
            : 0;
        }
      }
      return pskl.model.Frame.fromPixelGrid(pixels, width, height);
    },
    light: function (normal, x, y) {
      var length = Math.hypot(x, y, 1);
      var lightX = x / length,
        lightY = y / length,
        lightZ = 1 / length;
      var pixels = normal.getPixels().map(function (pixel) {
        var alpha = pixel >>> 24;
        if (!alpha) {
          return 0;
        }
        var nx = (pixel & 255) / 127.5 - 1;
        var ny = ((pixel >>> 8) & 255) / 127.5 - 1;
        var nz = ((pixel >>> 16) & 255) / 127.5 - 1;
        var dot =
          (nx * lightX + ny * lightY + nz * lightZ) / Math.hypot(nx, ny, nz);
        var shade = Math.round((0.2 + 0.8 * Math.max(0, dot)) * 255);
        return (
          (((alpha << 24) >>> 0) | (shade << 16) | (shade << 8) | shade) >>> 0
        );
      });
      return pskl.model.Frame.fromPixelGrid(
        pixels,
        normal.getWidth(),
        normal.getHeight()
      );
    }
  };
})();

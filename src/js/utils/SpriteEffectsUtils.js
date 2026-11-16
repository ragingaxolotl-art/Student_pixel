(function () {
  var ns = $.namespace("pskl.utils");
  ns.SpriteEffectsUtils = {
    integer: function (value, min, max, label) {
      if (!Number.isInteger(value) || value < min || value > max) {
        throw new Error(
          label + " must be a whole number from " + min + " to " + max + "."
        );
      }
      return value;
    },
    lcd: function (frame, options) {
      var size = this.integer(options.size, 4, 12, "LCD cell size");
      var gap = this.integer(options.gap, 1, 3, "Grid width");
      var scanline =
        this.integer(options.scanline, 0, 100, "Scanline darkness") / 100;
      var grid = ns.colorToInt(options.color);
      var width = frame.getWidth() * size;
      var height = frame.getHeight() * size;
      var interior = size - gap;
      if (options.rgb && interior < 3) {
        throw new Error(
          "RGB stripes need at least three columns inside each cell. Increase cell size or reduce grid width."
        );
      }
      var output = new pskl.model.Frame(width, height);
      var pixels = new Uint32Array(width * height);
      frame.forEachPixel(function (pixel, x, y) {
        var alpha = pixel >>> 24;
        if (!alpha) {
          return;
        }
        var red = pixel & 255;
        var green = (pixel >>> 8) & 255;
        var blue = (pixel >>> 16) & 255;
        var gridAlpha = Math.round((alpha * (grid >>> 24)) / 255);
        var gridPixel = gridAlpha
          ? (((gridAlpha << 24) >>> 0) | (grid & 0xffffff)) >>> 0
          : 0;
        for (var dy = 0; dy < size; dy++) {
          for (var dx = 0; dx < size; dx++) {
            var color;
            if (dx >= interior || dy >= interior) {
              color = gridPixel;
            } else {
              var phase = Math.floor((dx * 3) / interior);
              var shade = dy === interior - 1 ? 1 - scanline : 1;
              var r = Math.round(
                red * shade * (options.rgb && phase !== 0 ? 0.15 : 1)
              );
              var g = Math.round(
                green * shade * (options.rgb && phase !== 1 ? 0.15 : 1)
              );
              var b = Math.round(
                blue * shade * (options.rgb && phase !== 2 ? 0.15 : 1)
              );
              color = (((alpha << 24) >>> 0) | (b << 16) | (g << 8) | r) >>> 0;
            }
            pixels[(y * size + dy) * width + x * size + dx] = color;
          }
        }
      });
      output.setPixels(pixels);
      return output;
    },
    scale: function (frame, size) {
      var width = frame.getWidth() * size;
      var height = frame.getHeight() * size;
      var pixels = new Uint32Array(width * height);
      for (var y = 0; y < height; y++) {
        for (var x = 0; x < width; x++) {
          pixels[y * width + x] = frame.getPixel(
            Math.floor(x / size),
            Math.floor(y / size)
          );
        }
      }
      return pskl.model.Frame.fromPixelGrid(pixels, width, height);
    },
    neon: function (frame, options) {
      var radius = this.integer(options.radius, 1, 32, "Glow radius");
      var opacity =
        this.integer(options.opacity, 1, 100, "Glow strength") / 100;
      var color = ns.colorToInt(options.color);
      if (!(color >>> 24)) {
        throw new Error("Choose a visible glow color.");
      }
      var width = frame.getWidth();
      var height = frame.getHeight();
      var kernel = [];
      var sigma = Math.max(0.5, radius / 2);
      var total = 0;
      for (var offset = -radius; offset <= radius; offset++) {
        var weight = Math.exp((-offset * offset) / (2 * sigma * sigma));
        kernel.push(weight);
        total += weight;
      }
      kernel = kernel.map(function (weight) {
        return weight / total;
      });
      var pixels = frame.getPixels();
      var horizontal = new Float32Array(width * height);
      for (var y = 0; y < height; y++) {
        for (var x = 0; x < width; x++) {
          var alpha = 0;
          for (var k = -radius; k <= radius; k++) {
            if (x + k >= 0 && x + k < width) {
              alpha += (pixels[y * width + x + k] >>> 24) * kernel[k + radius];
            }
          }
          horizontal[y * width + x] = alpha;
        }
      }
      var output = pskl.model.Frame.createEmptyFromFrame(frame);
      for (var row = 0; row < height; row++) {
        for (var col = 0; col < width; col++) {
          var blurred = 0;
          for (var j = -radius; j <= radius; j++) {
            if (row + j >= 0 && row + j < height) {
              blurred +=
                horizontal[(row + j) * width + col] * kernel[j + radius];
            }
          }
          var result = Math.min(
            255,
            Math.round((blurred * opacity * 4 * (color >>> 24)) / 255)
          );
          if (result) {
            output.setPixel(
              col,
              row,
              (((result << 24) >>> 0) | (color & 0xffffff)) >>> 0
            );
          }
        }
      }
      return output;
    },
    shadow: function (frame, options) {
      var dx = this.integer(options.x, -2048, 2048, "Horizontal offset");
      var dy = this.integer(options.y, -2048, 2048, "Vertical offset");
      var opacity = this.integer(options.opacity, 1, 100, "Opacity") / 100;
      var color = ns.colorToInt(options.color);
      if (!(color >>> 24)) {
        throw new Error("Choose a visible shadow color.");
      }
      var output = pskl.model.Frame.createEmptyFromFrame(frame);
      frame.forEachPixel(function (pixel, x, y) {
        var alpha = Math.round(
          ((pixel >>> 24) * opacity * (color >>> 24)) / 255
        );
        if (alpha) {
          output.setPixel(
            x + dx,
            y + dy,
            (((alpha << 24) >>> 0) | (color & 0xffffff)) >>> 0
          );
        }
      });
      return output;
    }
  };
})();

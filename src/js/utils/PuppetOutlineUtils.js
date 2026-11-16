(function () {
  var ns = $.namespace("pskl.utils");
  ns.OutlineUtils = {
    create: function (source, color, thickness, diagonal) {
      if (!Number.isInteger(thickness) || thickness < 1 || thickness > 16) {
        throw new Error(
          "Outline thickness must be a whole number from 1 to 16."
        );
      }
      var outlineColor = ns.colorToInt(color);
      if (outlineColor >>> 24 === 0) {
        throw new Error("Choose a visible outline color.");
      }
      var width = source.getWidth();
      var height = source.getHeight();
      var pixels = source.getPixels();
      var distances = new Uint16Array(pixels.length);
      var maximum = thickness + 1;
      var x;
      var y;
      var index;
      for (index = 0; index < pixels.length; index++) {
        distances[index] = pixels[index] >>> 24 ? 0 : maximum;
      }
      // Two distance-transform passes make thick outlines linear in image size.
      for (y = 0; y < height; y++) {
        for (x = 0; x < width; x++) {
          index = y * width + x;
          if (x > 0) {
            distances[index] = Math.min(
              distances[index],
              distances[index - 1] + 1
            );
          }
          if (y > 0) {
            distances[index] = Math.min(
              distances[index],
              distances[index - width] + 1
            );
            if (diagonal && x > 0) {
              distances[index] = Math.min(
                distances[index],
                distances[index - width - 1] + 1
              );
            }
            if (diagonal && x + 1 < width) {
              distances[index] = Math.min(
                distances[index],
                distances[index - width + 1] + 1
              );
            }
          }
        }
      }
      for (y = height - 1; y >= 0; y--) {
        for (x = width - 1; x >= 0; x--) {
          index = y * width + x;
          if (x + 1 < width) {
            distances[index] = Math.min(
              distances[index],
              distances[index + 1] + 1
            );
          }
          if (y + 1 < height) {
            distances[index] = Math.min(
              distances[index],
              distances[index + width] + 1
            );
            if (diagonal && x > 0) {
              distances[index] = Math.min(
                distances[index],
                distances[index + width - 1] + 1
              );
            }
            if (diagonal && x + 1 < width) {
              distances[index] = Math.min(
                distances[index],
                distances[index + width + 1] + 1
              );
            }
          }
        }
      }
      var result = new pskl.model.Frame(width, height);
      var output = new Uint32Array(pixels.length);
      for (index = 0; index < pixels.length; index++) {
        if (distances[index] > 0 && distances[index] <= thickness) {
          output[index] = outlineColor;
        }
      }
      result.setPixels(output);
      return result;
    }
  };
})();

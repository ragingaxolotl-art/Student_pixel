(function () {
  var ns = $.namespace("pskl.utils");
  ns.LayerPixelOps = {
    manipulate: function (frame, other, operation) {
      var canvas = ns.FrameUtils.toImage(frame),
        ctx = canvas.getContext("2d");
      var modes = {
        subtract: "destination-out",
        add: "destination-over",
        intersect: "destination-in",
        xor: "xor",
        lift: "destination-in",
        inverseMask: "source-out"
      };
      if (operation === "invertOverlap") {
        var pixels = new Uint32Array(frame.pixels);
        other.forEachPixel(function (p, x, y) {
          var i = y * frame.getWidth() + x;
          if (p >>> 24 && pixels[i] >>> 24) {
            pixels[i] = (pixels[i] ^ 0xffffff) >>> 0;
          }
        });
        return pskl.model.Frame.fromPixelGrid(
          pixels,
          frame.getWidth(),
          frame.getHeight()
        );
      }
      ctx.globalCompositeOperation = modes[operation];
      ctx.drawImage(ns.FrameUtils.toImage(other), 0, 0);
      return ns.FrameUtils.createFromCanvas(
        canvas,
        0,
        0,
        frame.getWidth(),
        frame.getHeight(),
        true
      );
    },
    effect: function (frame, other, effect, amount, color, settings) {
      var options = Object.assign({}, settings || {}),
        definitions = ns.LayerEffectDefinitions;
      definitions.parameters(effect).forEach(function (p) {
        if (options[p.key] === undefined) {
          options[p.key] = p.value;
        }
      });
      if (amount !== undefined) {
        options.amount = amount;
      }
      definitions.validate(effect, options);
      amount = Number(options.amount);
      if (effect === "none") {
        return frame.clone();
      }
      var w = frame.getWidth(),
        h = frame.getHeight(),
        source = frame.pixels,
        pixels = new Uint32Array(source),
        ink = ns.colorToInt(color || definitions.color(effect));
      function byte(v) {
        return Math.max(0, Math.min(255, Math.round(v)));
      }
      function pack(r, g, b, a) {
        return (
          ((byte(a) << 24) | (byte(b) << 16) | (byte(g) << 8) | byte(r)) >>> 0
        );
      }
      function rgb(p) {
        return [p & 255, (p >>> 8) & 255, (p >>> 16) & 255];
      }
      function hsl(c) {
        var r = c[0] / 255,
          g = c[1] / 255,
          b = c[2] / 255,
          max = Math.max(r, g, b),
          min = Math.min(r, g, b),
          d = max - min,
          l = (max + min) / 2,
          h = 0,
          s = 0;
        if (d) {
          s = d / (1 - Math.abs(2 * l - 1));
          h =
            max === r
              ? ((g - b) / d) % 6
              : max === g
                ? (b - r) / d + 2
                : (r - g) / d + 4;
          h = (((h / 6) % 1) + 1) % 1;
        }
        return [h, s, l];
      }
      function fromHsl(c) {
        var h = (((c[0] % 1) + 1) % 1) * 6,
          ch = (1 - Math.abs(2 * c[2] - 1)) * c[1],
          x = ch * (1 - Math.abs((h % 2) - 1)),
          m = c[2] - ch / 2;
        var v =
          h < 1
            ? [ch, x, 0]
            : h < 2
              ? [x, ch, 0]
              : h < 3
                ? [0, ch, x]
                : h < 4
                  ? [0, x, ch]
                  : h < 5
                    ? [x, 0, ch]
                    : [ch, 0, x];
        return v.map(function (n) {
          return (n + m) * 255;
        });
      }
      function over(back, front) {
        return ns.LayerBlendUtils.pixel(back, front, "normal", 1, 1);
      }
      if (effect === "neon" || effect === "shadow") {
        if (amount === 0) {
          return frame.clone();
        }
        var under =
          effect === "neon"
            ? ns.SpriteEffectsUtils.neon(frame, {
                radius: Number(options.radius),
                opacity: amount,
                color: color || "#ffffff"
              })
            : ns.SpriteEffectsUtils.shadow(frame, {
                x: Number(options.shadowX),
                y: Number(options.shadowY),
                opacity: amount,
                color: color || "#000000"
              });
        for (var k = 0; k < pixels.length; k++) {
          pixels[k] = over(under.pixels[k], source[k]);
        }
        return pskl.model.Frame.fromPixelGrid(pixels, w, h);
      }
      if (effect === "normalMap") {
        return ns.NormalMapUtils.create(frame, {
          strength: amount,
          keepAlpha: true,
          wrap: false,
          flipY: false
        });
      }
      if (effect === "lcd") {
        var size = Number(options.lcdSize || 4),
          gap = Number(options.lcdGap || 1);
        if (w * h * size * size > 16000000) {
          throw new Error(
            "LCD output exceeds 16 million pixels. Reduce the source size."
          );
        }
        return ns.SpriteEffectsUtils.lcd(frame, {
          size: size,
          gap: gap,
          scanline: amount,
          color: color || "#151515",
          rgb: options.lcdRGB !== false
        });
      }
      var blend = ns.LayerBlendUtils.isBlend(effect),
        bayer = [
          [0, 8, 2, 10],
          [12, 4, 14, 6],
          [3, 11, 1, 9],
          [15, 7, 13, 5]
        ],
        strength = amount / 100;
      if (blend && !other) {
        throw new Error("A reference layer is required for this blend.");
      }
      for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
          var i = y * w + x,
            p = source[i],
            a = p >>> 24,
            c = rgb(p),
            result = c.slice();
          if (effect === "outline" || effect === "innerOutline") {
            var radius = amount,
              coverage = 0,
              edge = false;
            for (var dy = -radius; dy <= radius; dy++) {
              for (var dx = -radius; dx <= radius; dx++) {
                if (!dx && !dy) {
                  continue;
                }
                var nx = x + dx,
                  ny = y + dy,
                  alpha =
                    nx < 0 || ny < 0 || nx >= w || ny >= h
                      ? 0
                      : source[ny * w + nx] >>> 24;
                coverage = Math.max(coverage, alpha);
                if (!alpha) {
                  edge = true;
                }
              }
            }
            if (effect === "outline" && !a && coverage) {
              pixels[i] = pack(
                ink & 255,
                (ink >>> 8) & 255,
                (ink >>> 16) & 255,
                (coverage * (ink >>> 24)) / 255
              );
            }
            if (effect === "innerOutline" && a && edge) {
              var ia = (ink >>> 24) / 255;
              pixels[i] = pack(
                c[0] * (1 - ia) + (ink & 255) * ia,
                c[1] * (1 - ia) + ((ink >>> 8) & 255) * ia,
                c[2] * (1 - ia) + ((ink >>> 16) & 255) * ia,
                a
              );
            }
            continue;
          }
          if (!a) {
            pixels[i] = 0;
            continue;
          }
          if (blend) {
            var q = other.getPixel(x, y),
              b = rgb(q).map(function (v) {
                return v / 255;
              }),
              s = c.map(function (v) {
                return v / 255;
              }),
              mixed = ns.LayerBlendUtils.color(b, s, effect),
              weight =
                ((q >>> 24) / 255) *
                strength *
                (options.referenceOpacity === undefined
                  ? 1
                  : options.referenceOpacity);
            result = c.map(function (v, j) {
              return v + weight * (mixed[j] * 255 - v);
            });
          } else if (effect === "grayscale") {
            var gray = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
            result = c.map(function (v) {
              return v + (gray - v) * strength;
            });
          } else if (effect === "invert") {
            result = c.map(function (v) {
              return v + (255 - v - v) * strength;
            });
          } else if (effect === "brightness") {
            result = c.map(function (v) {
              return v + amount * 2.55;
            });
          } else if (effect === "hueShift") {
            var hsv = hsl(c);
            hsv[0] += amount / 360;
            result = fromHsl(hsv);
          } else if (effect === "saturation") {
            var sat = hsl(c);
            sat[1] =
              amount < 0
                ? sat[1] * (1 + strength)
                : sat[1] + (1 - sat[1]) * strength;
            result = fromHsl(sat);
          } else if (effect === "tint") {
            var tint = rgb(ink);
            result = c.map(function (v, j) {
              return v + (tint[j] - v) * strength;
            });
          } else if (effect === "posterize") {
            result = c.map(function (v) {
              return (
                (Math.round((v * (amount - 1)) / 255) * 255) / (amount - 1)
              );
            });
          } else if (effect === "threshold" || effect === "dither") {
            var threshold =
                amount +
                (effect === "dither"
                  ? ((bayer[y % 4][x % 4] + 0.5) / 16 - 0.5) * 255
                  : 0),
              luma = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
            result = [
              luma >= threshold ? 255 : 0,
              luma >= threshold ? 255 : 0,
              luma >= threshold ? 255 : 0
            ];
          }
          pixels[i] = pack(result[0], result[1], result[2], a);
        }
      }
      return pskl.model.Frame.fromPixelGrid(pixels, w, h);
    }
  };
})();

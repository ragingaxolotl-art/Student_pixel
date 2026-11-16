(function () {
  var ns = $.namespace("pskl.utils");
  var modes = [
    "multiply",
    "screen",
    "overlay",
    "darken",
    "lighten",
    "difference",
    "exclusion",
    "addColor",
    "subtractColor",
    "color-dodge",
    "color-burn",
    "hard-light",
    "soft-light",
    "hue",
    "saturationBlend",
    "color",
    "luminosity"
  ];
  function clamp(v) {
    return Math.max(0, Math.min(1, v));
  }
  function lum(c) {
    return 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
  }
  function sat(c) {
    return Math.max.apply(null, c) - Math.min.apply(null, c);
  }
  function setLum(c, l) {
    var d = l - lum(c),
      r = c.map(function (v) {
        return v + d;
      }),
      n = Math.min.apply(null, r),
      x = Math.max.apply(null, r);
    if (n < 0) {
      r = r.map(function (v) {
        return l + ((v - l) * l) / (l - n);
      });
    }
    if (x > 1) {
      r = r.map(function (v) {
        return l + ((v - l) * (1 - l)) / (x - l);
      });
    }
    return r;
  }
  function setSat(c, s) {
    var order = [0, 1, 2].sort(function (a, b) {
        return c[a] - c[b];
      }),
      lo = order[0],
      mid = order[1],
      hi = order[2],
      r = [0, 0, 0];
    if (c[hi] > c[lo]) {
      r[mid] = ((c[mid] - c[lo]) * s) / (c[hi] - c[lo]);
      r[hi] = s;
    }
    return r;
  }
  function channel(b, s, mode) {
    switch (mode) {
      case "multiply":
        return b * s;
      case "screen":
        return b + s - b * s;
      case "overlay":
        return b <= 0.5 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s);
      case "darken":
        return Math.min(b, s);
      case "lighten":
        return Math.max(b, s);
      case "difference":
        return Math.abs(b - s);
      case "exclusion":
        return b + s - 2 * b * s;
      case "addColor":
        return Math.min(1, b + s);
      case "subtractColor":
        return Math.max(0, b - s);
      case "color-dodge":
        return b === 0 ? 0 : s === 1 ? 1 : Math.min(1, b / (1 - s));
      case "color-burn":
        return b === 1 ? 1 : s === 0 ? 0 : 1 - Math.min(1, (1 - b) / s);
      case "hard-light":
        return s <= 0.5 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s);
      case "soft-light":
        return s <= 0.5
          ? b - (1 - 2 * s) * b * (1 - b)
          : b +
              (2 * s - 1) *
                ((b <= 0.25 ? ((16 * b - 12) * b + 4) * b : Math.sqrt(b)) - b);
      default:
        return s;
    }
  }
  ns.LayerBlendUtils = {
    modes: modes,
    isBlend: function (mode) {
      return modes.indexOf(mode) !== -1;
    },
    color: function (b, s, mode) {
      if (mode === "hue") {
        return setLum(setSat(s, sat(b)), lum(b));
      }
      if (mode === "saturationBlend") {
        return setLum(setSat(b, sat(s)), lum(b));
      }
      if (mode === "color") {
        return setLum(s, lum(b));
      }
      if (mode === "luminosity") {
        return setLum(b, lum(s));
      }
      return b.map(function (v, i) {
        return channel(v, s[i], mode);
      });
    },
    pixel: function (backdrop, source, mode, strength, opacity) {
      var a = ((source >>> 24) / 255) * opacity,
        ba = (backdrop >>> 24) / 255,
        alpha = a + ba * (1 - a);
      if (!alpha) {
        return 0;
      }
      var s = [source & 255, (source >>> 8) & 255, (source >>> 16) & 255].map(
          function (v) {
            return v / 255;
          }
        ),
        b = [
          backdrop & 255,
          (backdrop >>> 8) & 255,
          (backdrop >>> 16) & 255
        ].map(function (v) {
          return v / 255;
        });
      var blend = this.color(b, s, mode),
        out = b.map(function (v, i) {
          var mixed = s[i] + ba * strength * (blend[i] - s[i]);
          return Math.round(
            clamp((a * mixed + ba * (1 - a) * v) / alpha) * 255
          );
        });
      return (
        ((Math.round(alpha * 255) << 24) |
          (out[2] << 16) |
          (out[1] << 8) |
          out[0]) >>>
        0
      );
    },
    draw: function (canvas, frame, opacity, mode, strength) {
      var ctx = canvas.getContext("2d"),
        data = ctx.getImageData(0, 0, canvas.width, canvas.height),
        out = new Uint32Array(data.data.buffer);
      for (var i = 0; i < out.length; i++) {
        out[i] = this.pixel(out[i], frame.pixels[i], mode, strength, opacity);
      }
      ctx.putImageData(data, 0, 0);
    }
  };
})();

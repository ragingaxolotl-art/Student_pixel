(function () {
  var u = pskl.utils;
  var matrices = {
    2: [
      [0, 2],
      [3, 1]
    ]
  };
  [4, 8].forEach(function (n) {
    var previous = matrices[n / 2];
    matrices[n] = Array.from({ length: n }, function (_, y) {
      return Array.from({ length: n }, function (_, x) {
        return (
          4 * previous[y % (n / 2)][x % (n / 2)] +
          matrices[2][Math.floor(y / (n / 2))][Math.floor(x / (n / 2))]
        );
      });
    });
  });
  function gradient(value) {
    value = value && typeof value === "object" ? value : {};
    var stops = Array.isArray(value.stops)
      ? value.stops
          .slice(0, 8)
          .filter(function (s) {
            return (
              s &&
              /^#[0-9a-f]{6}$/i.test(s.color) &&
              Number.isFinite(Number(s.at))
            );
          })
          .map(function (s) {
            return {
              at: Math.max(0, Math.min(100, Number(s.at))),
              color: s.color,
              opacity: Number.isFinite(Number(s.opacity))
                ? Math.max(0, Math.min(100, Number(s.opacity)))
                : 100
            };
          })
      : [];
    if (stops.length < 2) {
      stops = [
        { at: 0, color: "#000000", opacity: 100 },
        { at: 100, color: "#ffffff", opacity: 100 }
      ];
    }
    stops.sort(function (a, b) {
      return a.at - b.at;
    });
    stops[0].at = 0;
    stops[stops.length - 1].at = 100;
    return {
      angle: Number.isFinite(Number(value.angle))
        ? ((Number(value.angle) % 360) + 360) % 360
        : 0,
      matrix:
        [2, 4, 8].indexOf(Number(value.matrix)) !== -1
          ? Number(value.matrix)
          : 4,
      stops: stops
    };
  }
  function color(stop) {
    var rgb = parseInt(stop.color.slice(1), 16);
    return (
      ((Math.round((stop.opacity * 255) / 100) << 24) |
        ((rgb & 255) << 16) |
        (rgb & 0xff00) |
        ((rgb >>> 16) & 255)) >>>
      0
    );
  }
  u.DitherPaintUtils = {
    gradient: gradient,
    settings: function (value) {
      value = value || {};
      return Object.assign(u.DitherPatterns.normalize(value), {
        paint: value.paint === "bucket" ? "bucket" : "pen",
        fill: value.fill === "gradient" ? "gradient" : "pattern",
        gradient: gradient(value.gradient)
      });
    },
    gradientColor: function (x, y, settings, bounds, reverse) {
      var grad = settings.gradient,
        angle = (grad.angle * Math.PI) / 180,
        c = Math.cos(angle),
        s = Math.sin(angle),
        w = bounds.maxX - bounds.minX,
        h = bounds.maxY - bounds.minY,
        lo = Math.min(0, w * c) + Math.min(0, h * s),
        hi = Math.max(0, w * c) + Math.max(0, h * s),
        t =
          hi - lo < 1e-8
            ? 0
            : Math.max(
                0,
                Math.min(
                  1,
                  ((x - bounds.minX) * c + (y - bounds.minY) * s - lo) /
                    (hi - lo)
                )
              );
      if (reverse) {
        t = 1 - t;
      }
      t *= 100;
      var stops = grad.stops,
        a = stops[0],
        b = stops[stops.length - 1];
      for (var i = 1; i < stops.length; i++) {
        if (t <= stops[i].at) {
          a = stops[i - 1];
          b = stops[i];
          break;
        }
      }
      var f = b.at === a.at ? 1 : (t - a.at) / (b.at - a.at),
        n = grad.matrix,
        scale = Number(settings.scale),
        mx = ((Math.floor(x / scale) % n) + n) % n,
        my = ((Math.floor(y / scale) % n) + n) % n,
        threshold = (matrices[n][my][mx] + 0.5) / (n * n);
      return color(f >= 1 || f > threshold ? b : a);
    },
    region: function (frame, x, y) {
      if (!frame.containsPixel(x, y)) {
        return null;
      }
      var width = frame.getWidth(),
        height = frame.getHeight(),
        target = frame.getPixel(x, y),
        visited = new Uint8Array(width * height),
        queue = new Int32Array(width * height),
        head = 0,
        tail = 0,
        bounds = { minX: x, maxX: x, minY: y, maxY: y };
      function add(nx, ny) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
          return;
        }
        var at = ny * width + nx;
        if (!visited[at] && frame.getPixel(nx, ny) === target) {
          visited[at] = 1;
          queue[tail++] = at;
        }
      }
      add(x, y);
      while (head < tail) {
        var at = queue[head++],
          px = at % width,
          py = Math.floor(at / width);
        bounds.minX = Math.min(bounds.minX, px);
        bounds.maxX = Math.max(bounds.maxX, px);
        bounds.minY = Math.min(bounds.minY, py);
        bounds.maxY = Math.max(bounds.maxY, py);
        add(px - 1, py);
        add(px + 1, py);
        add(px, py - 1);
        add(px, py + 1);
      }
      return { pixels: queue.subarray(0, tail), bounds: bounds };
    },
    fill: function (
      frame,
      x,
      y,
      settings,
      primary,
      secondary,
      reverse,
      opacity
    ) {
      var region = this.region(frame, x, y);
      if (!region) {
        return;
      }
      region.pixels.forEach(function (at) {
        var px = at % frame.getWidth(),
          py = Math.floor(at / frame.getWidth()),
          ink;
        if (settings.fill === "gradient") {
          ink = u.DitherPaintUtils.gradientColor(
            px,
            py,
            settings,
            region.bounds,
            reverse
          );
        } else {
          var bit = u.DitherPatterns.sample(px, py, settings);
          if (!bit && settings.colors === "primary") {
            return;
          }
          ink = (reverse ? !bit : bit) ? primary : secondary;
        }
        frame.setPixel(px, py, u.DitherPaintUtils.opacity(ink, opacity));
      });
    },
    opacity: function (ink, amount) {
      amount = Number.isFinite(Number(amount))
        ? Math.max(0, Math.min(100, Number(amount)))
        : 100;
      if (amount === 100) {
        return ink;
      }
      var p = typeof ink === "number" ? ink : u.colorToInt(ink);
      return (
        ((Math.round(((p >>> 24) * amount) / 100) << 24) | (p & 0xffffff)) >>> 0
      );
    }
  };
})();

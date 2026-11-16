(function () {
  var u = pskl.utils;
  u.ParticleSpriteUtils = {
    random: function (seed) {
      var n = seed >>> 0;
      return function () {
        n = (n + 0x6d2b79f5) >>> 0;
        var t = Math.imul(n ^ (n >>> 15), 1 | n);
        t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    over: u.PuppetColorUtils.over,
    mix: function (a, b, t) {
      var out = 0;
      [0, 8, 16, 24].forEach(function (shift) {
        out |=
          Math.round(
            ((a >>> shift) & 255) * (1 - t) + ((b >>> shift) & 255) * t
          ) << shift;
      });
      return out >>> 0;
    },
    bounds: function (frame) {
      var x0 = frame.getWidth(),
        y0 = frame.getHeight(),
        x1 = -1,
        y1 = -1;
      frame.forEachPixel(function (c, x, y) {
        if (c >>> 24) {
          x0 = Math.min(x0, x);
          y0 = Math.min(y0, y);
          x1 = Math.max(x1, x);
          y1 = Math.max(y1, y);
        }
      });
      return x1 < 0
        ? null
        : { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
    },
    crop: function (frame, bounds) {
      var out = new pskl.model.Frame(bounds.width, bounds.height);
      for (var y = 0; y < bounds.height; y++) {
        for (var x = 0; x < bounds.width; x++) {
          out.setPixel(x, y, frame.getPixel(bounds.x + x, bounds.y + y));
        }
      }
      return out;
    },
    threshold: function (x, y) {
      var matrix = [
        [0, 8, 2, 10],
        [12, 4, 14, 6],
        [3, 11, 1, 9],
        [15, 7, 13, 5]
      ];
      return (matrix[((y % 4) + 4) % 4][((x % 4) + 4) % 4] + 0.5) / 16;
    },
    stamp: function (frame, options) {
      var scale = Math.max(1 / 65536, options.size / 100),
        angle = (options.angle * Math.PI) / 180,
        cos = Math.cos(angle),
        sin = Math.sin(angle),
        width = Math.max(
          1,
          Math.min(
            512,
            Math.ceil(
              scale *
                (Math.abs(cos) * frame.getWidth() +
                  Math.abs(sin) * frame.getHeight()) -
                1e-8
            )
          )
        ),
        height = Math.max(
          1,
          Math.min(
            512,
            Math.ceil(
              scale *
                (Math.abs(sin) * frame.getWidth() +
                  Math.abs(cos) * frame.getHeight()) -
                1e-8
            )
          )
        ),
        out = new pskl.model.Frame(width, height);
      for (var y = 0; y < height; y++) {
        for (var x = 0; x < width; x++) {
          var dx = x - (width - 1) / 2,
            dy = y - (height - 1) / 2;
          out.setPixel(
            x,
            y,
            frame.getPixel(
              Math.round(
                (cos * dx + sin * dy) / scale + (frame.getWidth() - 1) / 2
              ),
              Math.round(
                (-sin * dx + cos * dy) / scale + (frame.getHeight() - 1) / 2
              )
            ) || 0
          );
        }
      }
      return out;
    }
  };
  u.ParticleTimelineUtils = {
    position: function (emitter, frame) {
      var keys = (emitter.keys || []).slice().sort(function (a, b) {
        return a.at - b.at;
      });
      if (!keys.length) {
        return { x: emitter.x, y: emitter.y };
      }
      var a = keys[0],
        b = keys[keys.length - 1];
      for (var i = 0; i < keys.length; i++) {
        if (keys[i].at <= frame) {
          a = keys[i];
        }
        if (keys[i].at >= frame) {
          b = keys[i];
          break;
        }
      }
      var t =
        a.at === b.at
          ? 0
          : u.PuppetAnimationUtils.ease(
              Math.max(0, Math.min(1, (frame - a.at) / (b.at - a.at))),
              a.easing || "linear"
            );
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    },
    route: function (emitter, t) {
      return u.JointMotionPathUtils.sample(
        emitter.path,
        Math.max(0, Math.min(1, t))
      );
    },
    translate: function (emitter, dx, dy) {
      emitter.x += dx;
      emitter.y += dy;
      (emitter.path || []).forEach(function (p) {
        p.x += dx;
        p.y += dy;
      });
      (emitter.keys || []).forEach(function (p) {
        p.x += dx;
        p.y += dy;
      });
    },
    key: function (emitter, at, point) {
      emitter.keys = (emitter.keys || []).filter(function (k) {
        return k.at !== at;
      });
      emitter.keys.push({ at: at, x: point.x, y: point.y, easing: "linear" });
      emitter.keys.sort(function (a, b) {
        return a.at - b.at;
      });
    }
  };
})();

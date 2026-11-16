(function () {
  var u = pskl.utils,
    r = u.RigStudioUtils;
  // A split joint bends one source image. Attachments have no deformSource and
  // therefore leave their parent's pixels rigid. Source images are never cut.
  u.RigSegmentDeform = {
    parts: function (renderer, bone, world) {
      var rest = renderer.rest;
      return renderer.rig.bones
        .filter(function (b) {
          return b.deformSource === bone.id;
        })
        .map(function (b) {
          var parent = renderer.rig.bones.find(function (p) {
              return p.id === b.parent;
            }),
            pivot = rest[b.id].start,
            axis = {
              x: rest[b.id].end.x - pivot.x,
              y: rest[b.id].end.y - pivot.y
            },
            length = Math.hypot(axis.x, axis.y);
          return {
            bone: b,
            origin: pivot,
            axis: { x: axis.x / length, y: axis.y / length },
            band: Math.max(1, Math.min(parent.length, b.length) * 0.5),
            before: r.multiply(
              world[parent.id].matrix,
              r.inverse(rest[parent.id].matrix)
            ),
            after: r.multiply(world[b.id].matrix, r.inverse(rest[b.id].matrix))
          };
        });
    },
    warp: function (point, base, parts) {
      var result = r.point(base, point.x, point.y);
      parts.forEach(function (part) {
        var d =
            (point.x - part.origin.x) * part.axis.x +
            (point.y - part.origin.y) * part.axis.y,
          t =
            part.bone.articulation === "hinge"
              ? d >= 0
                ? 1
                : 0
              : Math.max(0, Math.min(1, (d + part.band) / (2 * part.band))),
          w = part.bone.articulation === "hinge" ? t : t * t * (3 - 2 * t),
          a = r.point(part.before, point.x, point.y),
          b = r.point(part.after, point.x, point.y);
        result.x += w * (b.x - a.x);
        result.y += w * (b.y - a.y);
      });
      return result;
    },
    render: function (renderer, frame, bone, world, opacity) {
      var base = r.multiply(
          world[bone.id].matrix,
          r.inverse(renderer.rest[bone.id].matrix)
        ),
        parts = this.parts(renderer, bone, world);
      if (!parts.length) {
        return renderer.affine(frame, base, opacity);
      }
      var seeds = [r.inverse(base)].concat(
          parts.map(function (p) {
            return r.inverse(p.after);
          })
        ),
        out = new pskl.model.Frame(renderer.width, renderer.height);
      if (
        renderer.width * renderer.height * Math.pow(parts.length + 1, 2) >
        2097152
      ) {
        throw new Error(
          "Use a smaller canvas or fewer split joints for bending."
        );
      }
      for (var y = 0; y < renderer.height; y++) {
        for (var x = 0; x < renderer.width; x++) {
          var color = 0,
            best = 0.65;
          for (var s = 0; s < seeds.length; s++) {
            var p = r.point(seeds[s], x, y);
            for (var iteration = 0; iteration < 10; iteration++) {
              var q = this.warp(p, base, parts),
                ex = q.x - x,
                ey = q.y - y;
              if (Math.hypot(ex, ey) < 0.01) {
                break;
              }
              var a = this.warp({ x: p.x + 0.01, y: p.y }, base, parts),
                b = this.warp({ x: p.x, y: p.y + 0.01 }, base, parts),
                j00 = (a.x - q.x) * 100,
                j10 = (a.y - q.y) * 100,
                j01 = (b.x - q.x) * 100,
                j11 = (b.y - q.y) * 100,
                det = j00 * j11 - j10 * j01;
              if (!Number.isFinite(det) || Math.abs(det) < 1e-6) {
                break;
              }
              p.x -= Math.max(-64, Math.min(64, (j11 * ex - j01 * ey) / det));
              p.y -= Math.max(-64, Math.min(64, (-j10 * ex + j00 * ey) / det));
            }
            var mapped = this.warp(p, base, parts),
              error = Math.hypot(mapped.x - x, mapped.y - y),
              sample = frame.getPixel(Math.round(p.x), Math.round(p.y)) || 0;
            if (error <= best && sample >>> 24) {
              best = error;
              color = sample;
            }
          }
          if (color >>> 24) {
            out.setPixel(
              x,
              y,
              ((Math.round((color >>> 24) * opacity) << 24) |
                (color & 0xffffff)) >>>
                0
            );
          }
        }
      }
      return out;
    }
  };
})();

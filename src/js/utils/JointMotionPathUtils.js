(function () {
  var u = pskl.utils,
    r = u.RigStudioUtils,
    clone = u.ToolStateUtils.clone;
  var m = (u.JointMotionPathUtils = {
    time: function (clip, index) {
      var t = index;
      if (clip.pingpong) {
        var period = clip.frames * 2 - 2;
        t = ((t % period) + period) % period;
        return t >= clip.frames ? period - t : t;
      }
      return ((t % clip.frames) + clip.frames) % clip.frames;
    },
    bone: function (rig, id) {
      return rig.bones.find(function (b) {
        return b.id === id;
      });
    },
    depth: function (rig, id) {
      var depth = 0,
        b = this.bone(rig, id);
      while (b && b.parent) {
        depth++;
        b = this.bone(rig, b.parent);
      }
      return depth;
    },
    key: function (clip, at) {
      return clip.keys.find(function (k) {
        return k.at === at;
      });
    },
    sample: function (points, t) {
      t = Math.max(0, Math.min(1, t));
      var lengths = [0];
      for (var i = 1; i < points.length; i++) {
        lengths.push(
          lengths[i - 1] +
            Math.hypot(
              points[i].x - points[i - 1].x,
              points[i].y - points[i - 1].y
            )
        );
      }
      var total = lengths[lengths.length - 1],
        target = total * t;
      if (!total) {
        return { x: points[0].x, y: points[0].y };
      }
      for (var j = 1; j < points.length; j++) {
        if (lengths[j] >= target) {
          var fraction =
            (target - lengths[j - 1]) / (lengths[j] - lengths[j - 1] || 1);
          return {
            x: points[j - 1].x + (points[j].x - points[j - 1].x) * fraction,
            y: points[j - 1].y + (points[j].y - points[j - 1].y) * fraction
          };
        }
      }
      return Object.assign({}, points[points.length - 1]);
    },
    compact: function (points) {
      function simplify(list) {
        if (list.length <= 2) {
          return list;
        }
        var a = list[0],
          b = list[list.length - 1],
          dx = b.x - a.x,
          dy = b.y - a.y,
          den = dx * dx + dy * dy,
          max = 0,
          index = 0;
        for (var i = 1; i < list.length - 1; i++) {
          var t = den
              ? Math.max(
                  0,
                  Math.min(
                    1,
                    ((list[i].x - a.x) * dx + (list[i].y - a.y) * dy) / den
                  )
                )
              : 0,
            distance = Math.hypot(
              list[i].x - a.x - dx * t,
              list[i].y - a.y - dy * t
            );
          if (distance > max) {
            max = distance;
            index = i;
          }
        }
        if (max <= 0.25) {
          return [a, b];
        }
        return simplify(list.slice(0, index + 1))
          .slice(0, -1)
          .concat(simplify(list.slice(index)));
      }
      var out = simplify(points);
      if (out.length > 256) {
        var original = out;
        out = Array.from({ length: 256 }, function (_, i) {
          return m.sample(original, i / 255);
        });
      }
      return out;
    },
    anchor: function (rig, clip, path, at) {
      return r.world(rig, r.poseAtBase(rig, clip, at))[path.bone][path.kind];
    },
    points: function (rig, clip, path) {
      var a = this.anchor(rig, clip, path, path.from),
        b = this.anchor(rig, clip, path, path.to),
        first = path.points[0],
        last = path.points[path.points.length - 1];
      return path.points.map(function (p, i) {
        var t = i / (path.points.length - 1);
        return {
          x: p.x + (a.x - first.x) * (1 - t) + (b.x - last.x) * t,
          y: p.y + (a.y - first.y) * (1 - t) + (b.y - last.y) * t
        };
      });
    },
    mode: function (rig, pose, id, kind, unlocked) {
      if (unlocked) {
        pose = clone(pose);
        pose[id] = Object.assign({}, pose[id], { pin: null });
      }
      var b = this.bone(rig, id),
        world = r.world(rig, pose),
        w = world[id];
      if (kind === "start") {
        return "translate";
      }
      var interior = rig.bones.some(function (child) {
        return (
          child.parent === id &&
          Math.hypot(
            world[child.id].start.x - w.end.x,
            world[child.id].start.y - w.end.y
          ) < 1e-5
        );
      });
      // A terminal limb needs a separate ancestor above its two-bone chain.
      // Never borrow the character/root bone to bend a one-piece limb.
      return b.parent &&
        this.bone(rig, b.parent).parent &&
        !r.jointPin(b, pose) &&
        !interior &&
        Math.hypot(
          w.start.x - world[b.parent].end.x,
          w.start.y - world[b.parent].end.y
        ) < 1e-5
        ? "ik"
        : "rotate";
    },
    affected: function (rig, path) {
      var b = this.bone(rig, path.bone);
      return path.mode === "ik" ||
        (path.kind === "end" && b.parent && this.bone(rig, b.parent).parent)
        ? [b.id, b.parent]
        : [b.id];
    },
    follow: function (rig, pose, path, target) {
      var mode = this.mode(rig, pose, path.bone, path.kind);
      if (mode === "ik") {
        return r.solveIK(rig, pose, path.bone, target, path.bend);
      }
      if (mode === "translate") {
        return r.dragJoint(rig, pose, path.bone, "start", target, path.bend);
      }
      var b = this.bone(rig, path.bone),
        world = r.world(rig, pose),
        base = b.parent ? world[b.parent].endMatrix : r.identity(),
        inverse = r.inverse(base),
        local = r.point(inverse, target.x, target.y),
        pivot = r.point(inverse, world[b.id].start.x, world[b.id].start.y),
        out = clone(pose),
        p = r.pose(out[b.id]);
      p.rotation =
        (Math.atan2(local.y - pivot.y, local.x - pivot.x) * 180) / Math.PI -
        b.angle -
        (p.scaleX < 0 ? 180 : 0);
      p.rotation = ((((p.rotation + 180) % 360) + 360) % 360) - 180;
      out[b.id] = p;
      return out;
    },
    create: function (rig, clip, bone, kind, from, to) {
      var a = this.key(clip, from),
        b = this.key(clip, to),
        pose = r.poseAtBase(rig, clip, from),
        part = this.bone(rig, bone),
        mode = this.mode(rig, pose, bone, kind),
        bend = 1;
      if (this.mode(rig, pose, bone, kind, true) === "ik") {
        // A straight limb has no bend sign. Use the first authored/interpolated
        // non-straight pose so a straight-to-bent path keeps the user's bend.
        [from, to, (from + to) / 2].some(function (at) {
          var samplePose = r.poseAtBase(rig, clip, at);
          samplePose[bone] = Object.assign({}, samplePose[bone], { pin: null });
          var sample = r.world(rig, samplePose),
            upper = sample[part.parent],
            lower = sample[bone],
            cross =
              (upper.end.x - upper.start.x) * (lower.end.y - lower.start.y) -
              (upper.end.y - upper.start.y) * (lower.end.x - lower.start.x);
          if (Math.abs(cross) <= 1e-6) {
            return false;
          }
          bend = cross < 0 ? -1 : 1;
          return true;
        });
      }
      var path = {
        id: u.Uuid.generate(),
        bone: bone,
        kind: kind,
        mode: mode,
        from: from,
        to: to,
        fromPose: a && a.pose,
        toPose: b && b.pose,
        bend: bend,
        points: []
      };
      path.points = [
        this.anchor(rig, clip, path, from),
        this.anchor(rig, clip, path, to)
      ];
      return path;
    },
    syncLock: function (rig, boneId) {
      rig.clips.forEach(function (clip) {
        (clip.paths || []).forEach(function (path) {
          if (path.bone === boneId && path.kind === "end") {
            var updated = m.create(
              rig,
              clip,
              path.bone,
              path.kind,
              path.from,
              path.to
            );
            path.mode = updated.mode;
            path.bend = updated.bend;
          }
        });
      });
    },
    validateInterval: function (clip, path) {
      var a = this.key(clip, path.from),
        b = this.key(clip, path.to);
      if (
        !a ||
        !b ||
        a.pose !== path.fromPose ||
        b.pose !== path.toPose ||
        path.from >= path.to ||
        clip.keys.some(function (k) {
          return k.at > path.from && k.at < path.to;
        })
      ) {
        throw new Error(
          "A joint path needs two adjacent saved poses. Remove the path before inserting or crossing another pose in its interval."
        );
      }
    },
    validateClip: function (rig, clip) {
      if (clip.paths === undefined) {
        return;
      }
      if (!Array.isArray(clip.paths) || clip.paths.length > 32) {
        throw new Error("Use up to 32 joint paths per clip.");
      }
      var ids = new Set();
      clip.paths.forEach(function (path) {
        if (
          !path ||
          typeof path.id !== "string" ||
          !path.id.length ||
          path.id.length > 100 ||
          ids.has(path.id) ||
          !m.bone(rig, path.bone) ||
          ["start", "end"].indexOf(path.kind) === -1 ||
          ["translate", "rotate", "ik"].indexOf(path.mode) === -1 ||
          !Number.isInteger(path.from) ||
          !Number.isInteger(path.to) ||
          !Array.isArray(path.points) ||
          path.points.length < 2 ||
          path.points.length > 256 ||
          ![1, -1].includes(path.bend) ||
          path.points.some(function (p) {
            return (
              !p ||
              !Number.isFinite(p.x) ||
              !Number.isFinite(p.y) ||
              Math.abs(p.x) > 8192 ||
              Math.abs(p.y) > 8192
            );
          })
        ) {
          throw new Error("Invalid joint path data.");
        }
        ids.add(path.id);
        m.validateInterval(clip, path);
        var b = m.bone(rig, path.bone);
        if (
          path.kind === "start" &&
          (b.parent ||
            r.jointPin(b, rig.workingPose) ||
            [path.from, (path.from + path.to) / 2, path.to].some(function (at) {
              return r.jointPin(b, r.poseAtBase(rig, clip, at));
            }))
        ) {
          throw new Error(
            "Pivot paths need an unlocked root. For an elbow or knee, guide the upper bone's tip instead."
          );
        }
        var signs = [],
          structural;
        [path.from, (path.from + path.to) / 2, path.to].forEach(function (at) {
          var pose = r.poseAtBase(rig, clip, at);
          var mode = m.mode(rig, pose, path.bone, path.kind),
            unpinned = m.mode(rig, pose, path.bone, path.kind, true);
          if (
            (structural && structural !== unpinned) ||
            (path.kind === "start"
              ? path.mode !== "translate"
              : !["ik", "rotate"].includes(path.mode))
          ) {
            throw new Error(
              "Keep the joint connected and its path constraints consistent in both poses."
            );
          }
          structural = unpinned;
          if (mode === "ik") {
            var w = r.world(rig, pose),
              upper = w[b.parent],
              lower = w[b.id];
            r.solveIK(rig, pose, b.id, lower.end, path.bend);
            var cross =
              (upper.end.x - upper.start.x) * (lower.end.y - lower.start.y) -
              (upper.end.y - upper.start.y) * (lower.end.x - lower.start.x);
            if (Math.abs(cross) > 1e-6) {
              signs.push(cross < 0 ? -1 : 1);
            }
          }
        });
        if (
          signs.some(function (sign) {
            return sign !== path.bend;
          })
        ) {
          throw new Error(
            "The endpoint poses bend this limb in different directions. Use matching bends or add a breakdown before drawing its paths."
          );
        }
      });
      clip.paths.forEach(function (a, i) {
        clip.paths.slice(i + 1).forEach(function (b) {
          if (
            Math.max(a.from, b.from) < Math.min(a.to, b.to) &&
            m.affected(rig, a).some(function (id) {
              return m.affected(rig, b).includes(id);
            })
          ) {
            throw new Error(
              "These paths control the same joint chain at the same time. Edit or remove the existing path first."
            );
          }
        });
      });
    },
    apply: function (rig, clip, index, base) {
      var time = this.time(clip, index),
        paths = (clip.paths || [])
          .filter(function (p) {
            return time > p.from && time < p.to;
          })
          .sort(function (a, b) {
            return m.depth(rig, a.bone) - m.depth(rig, b.bone);
          }),
        out = base;
      paths.forEach(function (path) {
        var key = m.key(clip, path.from);
        if (key.hold) {
          return;
        }
        var t = u.PuppetAnimationUtils.ease(
            (time - path.from) / (path.to - path.from),
            key.easing
          ),
          target = m.sample(m.points(rig, clip, path), t);
        out = m.follow(rig, out, path, target);
      });
      return out;
    },
    put: function (clip, path) {
      clip.paths = (clip.paths || [])
        .filter(function (p) {
          return p.id !== path.id;
        })
        .concat([clone(path)]);
    },
    prune: function (rig) {
      rig.clips.forEach(function (clip) {
        clip.paths = (clip.paths || []).filter(function (p) {
          var a = m.key(clip, p.from),
            b = m.key(clip, p.to);
          return (
            m.bone(rig, p.bone) &&
            a &&
            b &&
            a.pose === p.fromPose &&
            b.pose === p.toPose
          );
        });
      });
    },
    diagnostics: function (rig, clip, path) {
      var points = this.points(rig, clip, path),
        actual = [],
        maxError = 0,
        preview = Object.assign({}, clip, {
          paths: (clip.paths || [])
            .filter(function (p) {
              return p.id !== path.id;
            })
            .concat([path])
        }),
        key = this.key(clip, path.from);
      for (var i = 0; i <= 24; i++) {
        var at = path.from + ((path.to - path.from) * i) / 24,
          t =
            key.hold && i < 24
              ? 0
              : u.PuppetAnimationUtils.ease(i / 24, key.easing),
          target = this.sample(points, t),
          pose = r.poseAt(rig, preview, at),
          point = r.world(rig, pose)[path.bone][path.kind];
        actual.push(point);
        maxError = Math.max(
          maxError,
          Math.hypot(point.x - target.x, point.y - target.y)
        );
      }
      return { points: points, actual: actual, maxError: maxError };
    }
  });
  var validate = r.validate,
    move = r.moveKey;
  r.poseAtBase = r.poseAt;
  r.poseAt = function (rig, clip, index) {
    var pose = r.poseAtBase(rig, clip, index);
    return clip && clip.paths && clip.paths.length
      ? m.apply(rig, clip, index, pose)
      : pose;
  };

  r.validate = function (rig) {
    validate(rig);
    rig.clips.forEach(function (c) {
      m.validateClip(rig, c);
    });
    return rig;
  };
  r.moveKey = function (clip, from, to) {
    var draft = clone(clip);
    move(draft, from, to);
    (draft.paths || []).forEach(function (p) {
      if (p.from === from) {
        p.from = to;
      }
      if (p.to === from) {
        p.to = to;
      }
      m.validateInterval(draft, p);
    });
    clip.keys = draft.keys;
    if (draft.paths) {
      clip.paths = draft.paths;
    }
  };
})();

(function () {
  var ns = $.namespace("pskl.utils");
  ns.RigStudioUtils = {
    identity: function () {
      return [1, 0, 0, 1, 0, 0];
    },
    multiply: function (a, b) {
      return [
        a[0] * b[0] + a[2] * b[1],
        a[1] * b[0] + a[3] * b[1],
        a[0] * b[2] + a[2] * b[3],
        a[1] * b[2] + a[3] * b[3],
        a[0] * b[4] + a[2] * b[5] + a[4],
        a[1] * b[4] + a[3] * b[5] + a[5]
      ];
    },
    inverse: function (m) {
      var d = m[0] * m[3] - m[1] * m[2];
      if (Math.abs(d) < 1e-8) {
        throw new Error("A rig transform has zero scale.");
      }
      return [
        m[3] / d,
        -m[1] / d,
        -m[2] / d,
        m[0] / d,
        (m[2] * m[5] - m[3] * m[4]) / d,
        (m[1] * m[4] - m[0] * m[5]) / d
      ];
    },
    point: function (m, x, y) {
      return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
    },
    pose: function (value) {
      return Object.assign(
        {
          rotation: 0,
          x: 0,
          y: 0,
          scaleX: 1,
          scaleY: 1,
          shear: 0,
          visible: true,
          order: 0
        },
        value || {}
      );
    },
    jointPin: function (bone, pose) {
      if (!pose) {
        return null;
      }
      var value = pose[bone.id];
      return value && Object.prototype.hasOwnProperty.call(value, "pin")
        ? value.pin || null
        : bone.pin || null;
    },
    migratePins: function (rig) {
      rig.bones.forEach(function (bone) {
        if (!bone.pin) {
          return;
        }
        [rig.workingPose]
          .concat(
            rig.poses.map(function (p) {
              return p.values;
            })
          )
          .forEach(function (pose) {
            pose[bone.id] = Object.assign({}, pose[bone.id]);
            if (!Object.prototype.hasOwnProperty.call(pose[bone.id], "pin")) {
              pose[bone.id].pin = Object.assign({}, bone.pin);
            }
          });
        delete bone.pin;
      });
      return rig;
    },
    releasePins: function (rig, pose) {
      var out = ns.ToolStateUtils.clone(pose),
        world = this.world(rig, pose);
      rig.bones.forEach(function (bone) {
        if (!ns.RigStudioUtils.jointPin(bone, pose)) {
          return;
        }
        var base = bone.parent
            ? world[bone.parent].endMatrix
            : ns.RigStudioUtils.identity(),
          local = ns.RigStudioUtils.point(
            ns.RigStudioUtils.inverse(base),
            world[bone.id].start.x,
            world[bone.id].start.y
          );
        out[bone.id] = Object.assign({}, out[bone.id], {
          pin: null,
          x: local.x - bone.x,
          y: local.y - bone.y
        });
      });
      return out;
    },
    recordPose: function (rig, clip, at, values, settings) {
      var key = clip.keys.find(function (k) {
          return k.at === at;
        }),
        pose =
          key &&
          rig.poses.find(function (p) {
            return p.id === key.pose;
          }),
        uses = pose
          ? rig.clips.reduce(function (n, c) {
              return (
                n +
                c.keys.filter(function (k) {
                  return k.pose === pose.id;
                }).length
              );
            }, 0)
          : 0;
      if (!pose || uses > 1) {
        pose = {
          id: ns.Uuid.generate(),
          name: pose ? pose.name + " · Frame " + (at + 1) : "Pose " + (at + 1),
          values: {}
        };
        rig.poses.push(pose);
      }
      pose.values = ns.ToolStateUtils.clone(values);
      clip.keys = clip.keys.filter(function (k) {
        return k.at !== at;
      });
      clip.keys.push(
        Object.assign(
          { at: at, easing: "linear", hold: false, type: "key" },
          key,
          settings,
          { pose: pose.id }
        )
      );
      (clip.paths || []).forEach(function (path) {
        if (path.from === at) {
          path.fromPose = pose.id;
        }
        if (path.to === at) {
          path.toPose = pose.id;
        }
      });
      return pose;
    },
    local: function (b, p) {
      p = this.pose(p);
      var angle = ((b.angle + p.rotation) * Math.PI) / 180,
        c = Math.cos(angle),
        s = Math.sin(angle);
      if (Math.abs(c) < 1e-10) {
        c = 0;
      }
      if (Math.abs(s) < 1e-10) {
        s = 0;
      }
      return [
        c * p.scaleX,
        s * p.scaleX,
        (c * p.shear - s) * p.scaleY,
        (s * p.shear + c) * p.scaleY,
        b.x + p.x,
        b.y + p.y
      ];
    },
    world: function (rig, pose) {
      var result = Object.create(null),
        byId = Object.create(null);
      rig.bones.forEach(function (b) {
        byId[b.id] = b;
      });
      var visit = function (b) {
        if (result[b.id]) {
          return result[b.id];
        }
        var parent = b.parent ? visit(byId[b.parent]) : null,
          m = this.multiply(
            parent ? parent.endMatrix : this.identity(),
            this.local(b, pose && pose[b.id])
          );
        // A pinned joint holds its world position while the limb can rotate.
        // Null pose requests the unpinned binding geometry for skin sampling.
        var pin = this.jointPin(b, pose);
        if (pin) {
          m[4] = pin.x;
          m[5] = pin.y;
        }
        var endMatrix = this.multiply(m, [1, 0, 0, 1, b.length, 0]);
        result[b.id] = {
          matrix: m,
          endMatrix: endMatrix,
          start: this.point(m, 0, 0),
          end: this.point(endMatrix, 0, 0),
          visible:
            (!parent || parent.visible) && this.pose(pose && pose[b.id]).visible
        };
        return result[b.id];
      }.bind(this);
      rig.bones.forEach(visit);
      return result;
    },
    validate: function (rig) {
      if (
        !rig ||
        rig.version !== 1 ||
        !Array.isArray(rig.bones) ||
        !rig.bones.length ||
        rig.bones.length > 64 ||
        !Array.isArray(rig.poses) ||
        rig.poses.length > 128 ||
        !Array.isArray(rig.clips) ||
        rig.clips.length > 32
      ) {
        throw new Error(
          "Use a version-1 rig with 1–64 bones, up to 128 poses and 32 clips."
        );
      }
      if (
        !Number.isInteger(rig.referenceFrame) ||
        rig.referenceFrame < 1 ||
        rig.referenceFrame > 6000 ||
        !/^#[0-9a-f]{6}$/i.test(rig.outlineColor)
      ) {
        throw new Error("Choose a valid reference frame and outline color.");
      }
      var checkPin = function (pin) {
        if (
          pin !== undefined &&
          pin !== null &&
          (!pin ||
            typeof pin !== "object" ||
            Array.isArray(pin) ||
            !Number.isFinite(pin.x) ||
            !Number.isFinite(pin.y) ||
            Math.abs(pin.x) > 4096 ||
            Math.abs(pin.y) > 4096)
        ) {
          throw new Error("Invalid locked joint position.");
        }
      };
      var ids = new Set(),
        bound = new Set(),
        byId = {};
      rig.bones.forEach(function (b) {
        if (
          !b ||
          typeof b.id !== "string" ||
          !/^[a-zA-Z0-9_-]{1,100}$/.test(b.id) ||
          ["__proto__", "constructor", "prototype", "toString"].indexOf(
            b.id
          ) !== -1 ||
          ids.has(b.id) ||
          typeof b.name !== "string" ||
          typeof b.group !== "string"
        ) {
          throw new Error("Each bone needs a unique ID, name and group.");
        }
        ids.add(b.id);
        byId[b.id] = b;
        checkPin(b.pin);
        ["x", "y", "angle", "length", "radius", "radiusEnd", "bulge"].forEach(
          function (k) {
            if (!Number.isFinite(b[k]) || Math.abs(b[k]) > 4096) {
              throw new Error("Invalid bone " + k + ".");
            }
          }
        );
        if (
          b.length < 1 ||
          b.radius < 0 ||
          b.radius > 64 ||
          b.radiusEnd < 0 ||
          b.radiusEnd > 64 ||
          Math.abs(b.bulge) > 64 ||
          !/^#[0-9a-f]{6}$/i.test(b.color)
        ) {
          throw new Error(
            "Choose positive bone lengths, radii up to 64 and valid skin colors."
          );
        }
        if (b.layerId) {
          if (bound.has(b.layerId)) {
            throw new Error(
              "Bind each layer to one bone; parent transforms move its children."
            );
          }
          bound.add(b.layerId);
        }
      });
      rig.bones.forEach(function (b) {
        var chain = new Set([b.id]),
          parent = b.parent;
        while (parent) {
          if (chain.has(parent)) {
            throw new Error("A bone cannot be its own ancestor.");
          }
          if (!byId[parent]) {
            throw new Error("Choose an existing parent bone.");
          }
          chain.add(parent);
          parent = byId[parent].parent;
        }
      });
      var checkPose = function (map) {
        if (!map || typeof map !== "object" || Array.isArray(map)) {
          throw new Error("Invalid pose.");
        }
        Object.keys(map).forEach(function (id) {
          var p = ns.RigStudioUtils.pose(map[id]);
          checkPin(p.pin);
          ["rotation", "x", "y", "scaleX", "scaleY", "shear", "order"].forEach(
            function (k) {
              if (!Number.isFinite(p[k]) || Math.abs(p[k]) > 4096) {
                throw new Error("Invalid pose " + k + ".");
              }
            }
          );
          if (
            Math.abs(p.scaleX) < 0.05 ||
            Math.abs(p.scaleY) < 0.05 ||
            Math.abs(p.scaleX) > 4 ||
            Math.abs(p.scaleY) > 4 ||
            Math.abs(p.shear) > 2
          ) {
            throw new Error("Pose scale must be 5–400% and shear −2…2.");
          }
        });
      };
      checkPose(rig.workingPose);
      var poseIds = new Set();
      rig.poses.forEach(function (p) {
        if (
          !p ||
          typeof p.id !== "string" ||
          poseIds.has(p.id) ||
          typeof p.name !== "string"
        ) {
          throw new Error("Invalid saved pose.");
        }
        poseIds.add(p.id);
        checkPose(p.values);
      });
      var clipIds = new Set();
      if (
        rig.guides &&
        (!Array.isArray(rig.guides) ||
          rig.guides.length > 32 ||
          rig.guides.some(function (g) {
            return (
              !g ||
              typeof g.name !== "string" ||
              !Number.isFinite(g.position) ||
              Math.abs(g.position) > 4096 ||
              ["horizontal", "vertical"].indexOf(g.axis) === -1 ||
              !/^#[0-9a-f]{6}$/i.test(g.color)
            );
          }))
      ) {
        throw new Error("Use up to 32 valid horizontal or vertical guides.");
      }
      rig.clips.forEach(function (c) {
        if (
          !c ||
          typeof c.id !== "string" ||
          clipIds.has(c.id) ||
          typeof c.name !== "string" ||
          !Number.isInteger(c.frames) ||
          c.frames < 2 ||
          c.frames > 120 ||
          !Array.isArray(c.keys) ||
          c.keys.length > 120
        ) {
          throw new Error("Clips need 2–120 frames and valid keys.");
        }
        clipIds.add(c.id);
        var times = new Set();
        c.keys.forEach(function (k) {
          if (
            !Number.isInteger(k.at) ||
            k.at < 0 ||
            k.at >= c.frames ||
            !poseIds.has(k.pose) ||
            times.has(k.at) ||
            ["linear", "in", "out", "in-out"].indexOf(k.easing) === -1
          ) {
            throw new Error(
              "Clip keys must reference saved poses at distinct valid frames."
            );
          }
          times.add(k.at);
        });
      });
      return rig;
    },
    template: function (name, width, height) {
      var bones = [],
        specs = [],
        w = width - 1,
        h = height - 1,
        add = function (id, parent, a, b, r, group, color) {
          specs.push({
            id: id,
            parent: parent,
            start: { x: a[0] * w, y: a[1] * h },
            end: { x: b[0] * w, y: b[1] * h },
            radius: Math.max(0.6, r * Math.min(width, height)),
            group: group,
            color: color
          });
        };
      if (name === "serpent") {
        for (var i = 0; i < 9; i++) {
          add(
            "Segment " + i,
            i ? "Segment " + (i - 1) : null,
            [0.1 + i * 0.085, 0.5 + Math.sin(i * 0.8) * 0.12],
            [0.1 + (i + 1) * 0.085, 0.5 + Math.sin((i + 1) * 0.8) * 0.12],
            0.05 - i * 0.003,
            "Body",
            i === 8 ? "#a7d86e" : "#63965c"
          );
        }
      } else if (name === "quadruped") {
        add("Body", null, [0.25, 0.43], [0.65, 0.43], 0.09, "Body", "#b58964");
        add(
          "Neck",
          "Body",
          [0.65, 0.43],
          [0.74, 0.3],
          0.065,
          "Head",
          "#c9a57c"
        );
        add(
          "Head",
          "Neck",
          [0.74, 0.3],
          [0.88, 0.34],
          0.075,
          "Head",
          "#d8ba92"
        );
        [0.28, 0.6].forEach(function (x, i) {
          [0, 1].forEach(function (side) {
            var id = (i ? "Front" : "Back") + (side ? " Right" : " Left"),
              offset = side ? 0.04 : -0.04;
            add(
              id + " upper",
              "Body",
              [x + offset, 0.48],
              [x + offset - 0.02, 0.66],
              0.038,
              "Legs",
              "#806449"
            );
            add(
              id + " lower",
              id + " upper",
              [x + offset - 0.02, 0.66],
              [x + offset + 0.02, 0.84],
              0.03,
              "Legs",
              "#977553"
            );
          });
        });
        add("Tail", "Body", [0.25, 0.43], [0.1, 0.3], 0.025, "Tail", "#b58964");
      } else {
        var chibi = name === "chibi";
        add(
          "Body",
          null,
          [0.5, 0.64],
          [0.5, chibi ? 0.43 : 0.34],
          chibi ? 0.09 : 0.075,
          "Body",
          "#6c9fbd"
        );
        add(
          "Neck",
          "Body",
          [0.5, chibi ? 0.43 : 0.34],
          [0.5, chibi ? 0.33 : 0.25],
          0.035,
          "Head",
          "#e4bd96"
        );
        add(
          "Head",
          "Neck",
          [0.5, chibi ? 0.33 : 0.25],
          [0.5, chibi ? 0.17 : 0.15],
          chibi ? 0.12 : 0.085,
          "Head",
          "#efcda8"
        );
        [-1, 1].forEach(function (side) {
          var prefix = side < 0 ? "Left" : "Right",
            shoulder = chibi ? 0.44 : 0.36;
          add(
            prefix + " upper arm",
            "Body",
            [0.5 + side * 0.07, shoulder],
            [0.5 + side * 0.22, 0.51],
            0.035,
            "Arms",
            "#e4bd96"
          );
          add(
            prefix + " forearm",
            prefix + " upper arm",
            [0.5 + side * 0.22, 0.51],
            [0.5 + side * 0.27, 0.66],
            0.03,
            "Arms",
            "#efcda8"
          );
          add(
            prefix + " thigh",
            "Body",
            [0.5 + side * 0.065, 0.65],
            [0.5 + side * 0.09, 0.79],
            0.045,
            "Legs",
            "#536786"
          );
          add(
            prefix + " shin",
            prefix + " thigh",
            [0.5 + side * 0.09, 0.79],
            [0.5 + side * 0.11, 0.93],
            0.035,
            "Legs",
            "#687fa0"
          );
          if (name === "winged") {
            add(
              prefix + " wing",
              "Body",
              [0.5 + side * 0.04, 0.38],
              [0.5 + side * 0.35, 0.17],
              0.065,
              "Wings",
              "#b9a1db"
            );
            add(
              prefix + " wing tip",
              prefix + " wing",
              [0.5 + side * 0.35, 0.17],
              [0.5 + side * 0.42, 0.42],
              0.04,
              "Wings",
              "#9178bd"
            );
          }
        });
      }
      var globals = {};
      specs.forEach(function (s) {
        var angle =
            (Math.atan2(s.end.y - s.start.y, s.end.x - s.start.x) * 180) /
            Math.PI,
          parent = s.parent && globals[s.parent],
          local = parent
            ? ns.RigStudioUtils.point(
                ns.RigStudioUtils.inverse(parent.endMatrix),
                s.start.x,
                s.start.y
              )
            : s.start;
        var bone = {
          id: "bone-" + s.id.replace(/\s+/g, "-"),
          name: s.id,
          parent: parent ? parent.id : null,
          x: local.x,
          y: local.y,
          angle: angle - (parent ? parent.angle : 0),
          length: Math.max(
            1,
            Math.hypot(s.end.x - s.start.x, s.end.y - s.start.y)
          ),
          radius: s.radius,
          radiusEnd: s.radius * 0.8,
          bulge: 0,
          color: s.color,
          group: s.group,
          layerId: null
        };
        bones.push(bone);
        var radians = (angle * Math.PI) / 180;
        globals[s.id] = {
          id: bone.id,
          angle: angle,
          endMatrix: [
            Math.cos(radians),
            Math.sin(radians),
            -Math.sin(radians),
            Math.cos(radians),
            s.end.x,
            s.end.y
          ]
        };
      });
      return {
        version: 1,
        name: name,
        bones: bones,
        workingPose: {},
        poses: [],
        clips: [
          {
            id: "default",
            name: "Loop",
            frames: 24,
            pingpong: false,
            loop: true,
            keys: []
          }
        ],
        activeClip: "default",
        skin: true,
        outline: false,
        outlineColor: "#222222",
        referenceFrame: 1
      };
    },
    config: function (p, o) {
      var rig = ns.ToolStateUtils.clone(
        p.toolState.rigStudio ||
          this.template("humanoid", p.getWidth(), p.getHeight())
      );
      this.migratePins(rig);
      if (o) {
        var bone = rig.bones.find(function (b) {
          return b.id === o.bone;
        });
        if (bone) {
          Object.assign(bone, {
            name: o.boneName,
            parent: o.parent || null,
            x: o.restX,
            y: o.restY,
            angle: o.restAngle,
            length: o.length,
            radius: o.radius,
            radiusEnd: o.radiusEnd,
            bulge: o.bulge,
            color: o.skinColor,
            group: o.group
          });
          if (o.binding !== undefined) {
            var layer = p.getLayerAt(o.binding);
            bone.layerId = layer
              ? layer.toolState.id || "index:" + o.binding
              : null;
            bone.layerName = layer ? layer.getName() : null;
          }
          rig.workingPose[bone.id] = Object.assign(
            {},
            rig.workingPose[bone.id],
            {
              rotation: o.rotation,
              x: o.poseX,
              y: o.poseY,
              scaleX: o.scaleX / 100,
              scaleY: o.scaleY / 100,
              shear: o.shear / 100,
              visible: o.visible,
              order: o.order
            }
          );
        }
        rig.skin = o.skin;
        rig.outline = o.outline;
        rig.outlineColor = o.outlineColor;
        rig.referenceFrame = o.referenceFrame;
        rig.activeClip = o.clip || rig.activeClip;
        var clip = rig.clips.find(function (c) {
          return c.id === rig.activeClip;
        });
        if (clip) {
          clip.frames = o.frames;
          clip.pingpong = o.pingpong;
          clip.loop = o.loop;
        }
      }
      return rig;
    },
    poseAt: function (rig, clip, index) {
      if (!clip || !clip.keys.length) {
        return ns.ToolStateUtils.clone(rig.workingPose);
      }
      var keys = clip.keys.slice().sort(function (a, b) {
          return a.at - b.at;
        }),
        time = index;
      if (clip.pingpong) {
        var period = clip.frames * 2 - 2;
        time = ((time % period) + period) % period;
        if (time >= clip.frames) {
          time = period - time;
        }
      } else {
        time = ((time % clip.frames) + clip.frames) % clip.frames;
      }
      var before = keys
          .slice()
          .reverse()
          .find(function (k) {
            return k.at <= time;
          }),
        after = keys.find(function (k) {
          return k.at > time;
        });
      if (!before) {
        if (clip.loop && !clip.pingpong) {
          before = Object.assign({}, keys[keys.length - 1], {
            at: keys[keys.length - 1].at - clip.frames
          });
        } else {
          before = keys[0];
        }
      }
      if (!after) {
        if (clip.loop && !clip.pingpong) {
          after = Object.assign({}, keys[0], { at: keys[0].at + clip.frames });
        } else {
          after = before;
        }
      }
      var a = rig.poses.find(function (p) {
          return p.id === before.pose;
        }).values,
        b = rig.poses.find(function (p) {
          return p.id === after.pose;
        }).values,
        t =
          after.at === before.at || before.hold
            ? 0
            : ns.PuppetAnimationUtils.ease(
                Math.max(
                  0,
                  Math.min(1, (time - before.at) / (after.at - before.at))
                ),
                before.easing
              ),
        out = {};
      rig.bones.forEach(function (bone) {
        var pa = ns.RigStudioUtils.pose(a[bone.id]),
          pb = ns.RigStudioUtils.pose(b[bone.id]),
          p = {};
        Object.keys(pa).forEach(function (k) {
          if (k === "pin") {
            return;
          } else if (k === "visible") {
            p[k] = t < 1 ? pa[k] : pb[k];
          } else if (k === "rotation") {
            var delta = ((((pb[k] - pa[k] + 180) % 360) + 360) % 360) - 180;
            p[k] = pa[k] + delta * t;
          } else if ((k === "scaleX" || k === "scaleY") && pa[k] * pb[k] < 0) {
            p[k] = t < 0.5 ? pa[k] : pb[k];
          } else {
            p[k] = pa[k] + (pb[k] - pa[k]) * t;
          }
        });
        if (
          (a[bone.id] &&
            Object.prototype.hasOwnProperty.call(a[bone.id], "pin")) ||
          (b[bone.id] &&
            Object.prototype.hasOwnProperty.call(b[bone.id], "pin"))
        ) {
          var pin = ns.RigStudioUtils.jointPin(bone, t >= 1 ? b : a);
          p.pin = pin ? { x: pin.x, y: pin.y } : null;
        }
        out[bone.id] = p;
      });
      return out;
    },
    pinTarget: function (rig, pose, id, kind) {
      var bone = rig.bones.find(function (b) {
        return b.id === id;
      });
      if (!bone || kind !== "end") {
        return bone || null;
      }
      var world = this.world(rig, pose),
        end = world[id].end,
        children = rig.bones.filter(function (b) {
          return (
            b.parent === id &&
            Math.hypot(
              world[b.id].start.x - end.x,
              world[b.id].start.y - end.y
            ) < 1e-5
          );
        });
      // Dragging a knee uses the thigh tip; locking that same point must pin
      // the shin pivot, rather than silently pinning the hip.
      return children.length === 1 ? children[0] : null;
    },
    pickJoint: function (rig, world, point) {
      var best = null;
      rig.bones.forEach(function (b) {
        ["end", "start"].forEach(function (kind) {
          var distance = Math.hypot(
            world[b.id][kind].x - point.x,
            world[b.id][kind].y - point.y
          );
          if (
            !best ||
            distance < best.distance - 1e-6 ||
            (Math.abs(distance - best.distance) <= 1e-6 &&
              kind === "end" &&
              best.kind === "start")
          ) {
            best = { id: b.id, kind: kind, distance: distance };
          }
        });
      });
      return best;
    },
    addJoint: function (rig, parentId, target) {
      if (rig.bones.length >= 64) {
        throw new Error("A rig supports up to 64 bones.");
      }
      var parent = rig.bones.find(function (b) {
          return b.id === parentId;
        }),
        world = this.world(rig, null),
        local = this.point(
          parent ? this.inverse(world[parent.id].endMatrix) : this.identity(),
          target.x,
          target.y
        ),
        bone = {
          id: ns.Uuid.generate(),
          name: "Joint " + (rig.bones.length + 1),
          parent: parent ? parent.id : null,
          x: parent ? 0 : target.x,
          y: parent ? 0 : target.y,
          angle: parent ? (Math.atan2(local.y, local.x) * 180) / Math.PI : -90,
          length: parent ? Math.max(1, Math.hypot(local.x, local.y)) : 1,
          radius: 0,
          radiusEnd: 0,
          bulge: 0,
          color: "#55e1df",
          group: parent ? parent.group : "Character",
          layerId: null
        };
      rig.bones.push(bone);
      return bone;
    },
    moveKey: function (clip, from, to) {
      if (!Number.isInteger(to) || to < 0 || to >= clip.frames) {
        throw new Error("Choose a frame within this clip.");
      }
      if (
        clip.keys.some(function (k) {
          return k.at === to && k.at !== from;
        })
      ) {
        throw new Error(
          "That frame already has a pose. Move it to an empty frame."
        );
      }
      var key = clip.keys.find(function (k) {
        return k.at === from;
      });
      if (key) {
        key.at = to;
      }
    },
    dragJoint: function (rig, pose, id, kind, target, bend) {
      var bone = rig.bones.find(function (b) {
          return b.id === id;
        }),
        world = this.world(rig, pose),
        w = world[id],
        parent = bone.parent ? world[bone.parent] : null;
      var pin = this.jointPin(bone, pose);
      if (kind === "start" && pin) {
        return ns.ToolStateUtils.clone(pose);
      }
      var touching = function (a, b) {
        return Math.hypot(a.x - b.x, a.y - b.y) < 1e-5;
      };
      var interior = rig.bones.some(function (b) {
        return b.parent === id && touching(world[b.id].start, w.end);
      });
      if (
        kind === "end" &&
        rig.bones.some(function (b) {
          return (
            b.parent === id &&
            ns.RigStudioUtils.jointPin(b, pose) &&
            touching(world[b.id].start, w.end)
          );
        })
      ) {
        return ns.ToolStateUtils.clone(pose);
      }
      if (
        kind === "end" &&
        !pin &&
        !interior &&
        parent &&
        touching(w.start, parent.end)
      ) {
        return this.solveIK(rig, pose, id, target, bend);
      }
      var out = ns.ToolStateUtils.clone(pose),
        p = this.pose(out[id]),
        local = this.point(
          this.inverse(parent ? parent.endMatrix : this.identity()),
          target.x,
          target.y
        );
      if (kind === "start") {
        p.x = local.x - bone.x;
        p.y = local.y - bone.y;
      } else {
        var pivot = pin
          ? this.point(
              this.inverse(parent ? parent.endMatrix : this.identity()),
              pin.x,
              pin.y
            )
          : { x: bone.x + p.x, y: bone.y + p.y };
        p.rotation =
          (Math.atan2(local.y - pivot.y, local.x - pivot.x) * 180) / Math.PI -
          bone.angle -
          (p.scaleX < 0 ? 180 : 0);
        p.rotation = ((((p.rotation + 180) % 360) + 360) % 360) - 180;
      }
      out[id] = p;
      return out;
    },
    solveIK: function (rig, pose, id, target, bend) {
      var lower = rig.bones.find(function (b) {
          return b.id === id;
        }),
        upper =
          lower &&
          rig.bones.find(function (b) {
            return b.id === lower.parent;
          });
      if (!upper) {
        throw new Error(
          "Select a child bone with a parent to solve two-bone IK."
        );
      }
      if (this.jointPin(lower, pose)) {
        throw new Error(
          "This joint is locked. Rotate around it or unlock it before using IK."
        );
      }
      var chain = lower;
      while (chain) {
        var local = this.pose(pose[chain.id]);
        if (
          Math.abs(local.scaleX - 1) > 1e-6 ||
          Math.abs(local.scaleY - 1) > 1e-6 ||
          Math.abs(local.shear) > 1e-6
        ) {
          throw new Error(
            "IK needs unit scale and zero shear along this chain."
          );
        }
        chain = rig.bones.find(function (b) {
          return b.id === chain.parent;
        });
      }
      var world = this.world(rig, pose);
      if (
        Math.hypot(
          world[lower.id].start.x - world[upper.id].end.x,
          world[lower.id].start.y - world[upper.id].end.y
        ) > 1e-5
      ) {
        throw new Error(
          "Choose the end of a connected two-bone chain, such as a wrist or ankle."
        );
      }
      var a = world[upper.id].start,
        l1 = upper.length,
        l2 = lower.length,
        dx = target.x - a.x,
        dy = target.y - a.y,
        distance = Math.max(
          0.0001,
          Math.min(
            l1 + l2 - 1e-6,
            Math.max(Math.abs(l1 - l2) + 1e-6, Math.hypot(dx, dy))
          )
        ),
        theta2 =
          Math.acos(
            Math.max(
              -1,
              Math.min(
                1,
                (distance * distance - l1 * l1 - l2 * l2) / (2 * l1 * l2)
              )
            )
          ) * (bend < 0 ? -1 : 1),
        theta1 =
          Math.atan2(dy, dx) -
          Math.atan2(l2 * Math.sin(theta2), l1 + l2 * Math.cos(theta2)),
        parent = upper.parent ? world[upper.parent] : null,
        parentAngle = parent
          ? Math.atan2(parent.matrix[1], parent.matrix[0])
          : 0,
        out = ns.ToolStateUtils.clone(pose);
      out[upper.id] = Object.assign(this.pose(out[upper.id]), {
        rotation:
          (theta1 * 180) / Math.PI - (parentAngle * 180) / Math.PI - upper.angle
      });
      out[lower.id] = Object.assign(this.pose(out[lower.id]), {
        rotation: (theta2 * 180) / Math.PI - lower.angle,
        x: 0,
        y: 0
      });
      return out;
    },
    mirrorPose: function (rig, pose) {
      var out = {},
        root = rig.bones.find(function (b) {
          return !b.parent;
        }),
        center = this.world(rig, pose)[root.id].start.x;
      rig.bones.forEach(function (bone) {
        var paired =
            bone.name.indexOf("Left") !== -1
              ? bone.name.replace("Left", "Right")
              : bone.name.indexOf("Right") !== -1
                ? bone.name.replace("Right", "Left")
                : bone.name,
          source =
            rig.bones.find(function (b) {
              return b.name === paired;
            }) || bone,
          p = ns.RigStudioUtils.pose(pose[source.id]);
        out[bone.id] = Object.assign({}, p, {
          rotation: -p.rotation,
          x: -p.x,
          shear: -p.shear
        });
        if (p.pin) {
          out[bone.id].pin = { x: 2 * center - p.pin.x, y: p.pin.y };
        }
      });
      return out;
    }
  };
})();

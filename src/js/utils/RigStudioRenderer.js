(function () {
  var ns = $.namespace("pskl.utils"),
    r = ns.RigStudioUtils,
    u = ns.PuppetColorUtils;
  ns.RigStudioRenderer = function (project, rig) {
    this.project = project;
    this.rig = r.validate(rig);
    this.rest = r.world(rig, null);
    this.width = project.getWidth();
    this.height = project.getHeight();
    this.partCache = new Map();
    var groups = this.stack({}).filter(function (entry) {
      return entry.kind === "group";
    });
    if (this.width * this.height * Math.max(1, groups.length) > 4194304) {
      throw new Error(
        "Rig preview exceeds four million group pixels; use a smaller canvas or fewer groups."
      );
    }
  };
  ns.RigStudioRenderer.prototype.source = function (bone) {
    if (!bone.layerId) {
      return null;
    }
    var layer =
      bone.layerId.indexOf("index:") === 0
        ? this.project.getLayerAt(Number(bone.layerId.substring(6)))
        : this.project.getLayers().find(function (l) {
            return l.toolState.id === bone.layerId;
          });
    if (!layer) {
      throw new Error("Rebind the missing layer for " + bone.name + ".");
    }
    if (
      layer.toolState.communityOwned &&
      layer.toolState.kind === "community-rig"
    ) {
      throw new Error("Bind source art rather than rig output.");
    }
    return layer;
  };
  ns.RigStudioRenderer.prototype.sources = function (bone) {
    var source = this.source(bone),
      g = ns.LayerGroupUtils;
    if (!source) {
      return [];
    }
    if (!g.isGroup(source)) {
      return [source];
    }
    var layers = this.project.getLayers(),
      members = g.descendants(layers, source),
      excluded = new Set();
    this.rig.bones.forEach(
      function (other) {
        if (other.id === bone.id) {
          return;
        }
        var target = this.source(other);
        if (target && members.indexOf(target) !== -1) {
          excluded.add(target);
          g.descendants(layers, target).forEach(function (l) {
            excluded.add(l);
          });
        }
      }.bind(this)
    );
    return members.filter(function (l) {
      return !g.isGroup(l) && !excluded.has(l);
    });
  };
  // Sample the reference artwork with its existing layer effects. Keep raw
  // source pixels and editable effect attachments on the original layers.
  ns.RigStudioRenderer.prototype.partFrame = function (layer, index) {
    if (this.partCache.has(layer)) {
      return this.partCache.get(layer);
    }
    var layers = this.project.getLayers(),
      frame = ns.LayerEffects.frame(layer, index, layers),
      blend = ns.LayerEffects.blend(layer, index);
    if (blend) {
      var visibility = this.project.toolState.rigVisibility || [],
        views = layers.map(function (source) {
          var copy = Object.create(source),
            saved = visibility.find(function (v) {
              return v.id === source.toolState.id;
            });
          copy.rowState = ns.ToolStateUtils.clone(source.rowState);
          copy.opacity =
            saved && source.getOpacity() === 0
              ? saved.opacity
              : source.getOpacity();
          return copy;
        }),
        at = layers.indexOf(layer),
        backdrop = ns.LayerUtils.flattenFrameAt(
          views.slice(0, at),
          index,
          true,
          views,
          frame
        ),
        data = backdrop
          .getContext("2d")
          .getImageData(0, 0, backdrop.width, backdrop.height),
        back = new Uint32Array(data.data.buffer),
        pixels = frame.pixels.slice(),
        strength = Number(blend.params.amount) / 100;
      for (var i = 0; i < pixels.length; i++) {
        var source = pixels[i],
          ab = (back[i] >>> 24) / 255;
        if (!(source >>> 24) || !ab) {
          continue;
        }
        var rgb = [
            source & 255,
            (source >>> 8) & 255,
            (source >>> 16) & 255
          ].map(function (c) {
            return c / 255;
          }),
          bg = [
            back[i] & 255,
            (back[i] >>> 8) & 255,
            (back[i] >>> 16) & 255
          ].map(function (c) {
            return c / 255;
          }),
          mixed = ns.LayerBlendUtils.color(bg, rgb, blend.operation),
          color = source & 0xff000000;
        [0, 8, 16].forEach(function (shift, c) {
          color |=
            Math.round(
              Math.max(
                0,
                Math.min(1, rgb[c] + ab * strength * (mixed[c] - rgb[c]))
              ) * 255
            ) << shift;
        });
        pixels[i] = color >>> 0;
      }
      frame = pskl.model.Frame.fromPixelGrid(
        pixels,
        frame.getWidth(),
        frame.getHeight()
      );
    }
    this.partCache.set(layer, frame);
    return frame;
  };
  ns.RigStudioRenderer.prototype.opacity = function (layer, local) {
    var saved = this.project.toolState.rigVisibility || [],
      chain = [layer].concat(
        local
          ? []
          : ns.LayerGroupUtils.ancestors(this.project.getLayers(), layer)
      );
    return chain.reduce(function (value, part) {
      if (part.rowState.hidden) {
        return 0;
      }
      var original = saved.find(function (s) {
        return s.id === part.toolState.id;
      });
      return (
        value *
        (part.getOpacity() === 0 && original
          ? original.opacity
          : part.getOpacity())
      );
    }, 1);
  };
  ns.RigStudioRenderer.prototype.affine = function (frame, matrix, opacity) {
    var inverse = r.inverse(matrix),
      out = new pskl.model.Frame(this.width, this.height);
    for (var y = 0; y < this.height; y++) {
      for (var x = 0; x < this.width; x++) {
        var p = r.point(inverse, x, y),
          color = frame.getPixel(Math.round(p.x), Math.round(p.y)) || 0;
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
  };
  ns.RigStudioRenderer.prototype.merge = function (target, source) {
    var pixels = target.getPixels(),
      other = source.getPixels();
    for (var i = 0; i < pixels.length; i++) {
      if (other[i] >>> 24) {
        pixels[i] = u.over(pixels[i], other[i]);
      }
    }
    target.setPixels(pixels);
  };
  ns.RigStudioRenderer.prototype.capsule = function (
    frame,
    a,
    b,
    r0,
    r1,
    bulge,
    color
  ) {
    if (!r0 && !r1 && !bulge) {
      return;
    }
    var max = Math.max(r0, r1) + Math.abs(bulge),
      x0 = Math.max(0, Math.floor(Math.min(a.x, b.x) - max)),
      x1 = Math.min(this.width - 1, Math.ceil(Math.max(a.x, b.x) + max)),
      y0 = Math.max(0, Math.floor(Math.min(a.y, b.y) - max)),
      y1 = Math.min(this.height - 1, Math.ceil(Math.max(a.y, b.y) + max)),
      dx = b.x - a.x,
      dy = b.y - a.y,
      length2 = dx * dx + dy * dy;
    for (var y = y0; y <= y1; y++) {
      for (var x = x0; x <= x1; x++) {
        var t = length2
            ? Math.max(
                0,
                Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / length2)
              )
            : 0,
          radius = Math.max(
            0,
            r0 + (r1 - r0) * t + bulge * Math.sin(Math.PI * t)
          );
        if (Math.hypot(x - a.x - dx * t, y - a.y - dy * t) <= radius) {
          frame.setPixel(x, y, color);
        }
      }
    }
  };
  ns.RigStudioRenderer.prototype.outputKey = function (bone, part) {
    return part
      ? "source:" +
          (part.toolState.groupNodeId ||
            part.toolState.id ||
            this.project.getLayers().indexOf(part))
      : "skin:" + bone.group;
  };
  ns.RigStudioRenderer.prototype.groups = function (pose, local) {
    var cacheKey = JSON.stringify(pose) + "|" + !!local;
    this.groupCache = this.groupCache || new Map();
    if (this.groupCache.has(cacheKey)) {
      return this.groupCache.get(cacheKey);
    }
    var world = r.world(this.rig, pose),
      groups = new Map(),
      bones = this.rig.bones.slice().sort(function (a, b) {
        return r.pose(pose[a.id]).order - r.pose(pose[b.id]).order;
      });
    bones.forEach(
      function (bone) {
        var source = this.source(bone);
        if (bone.connector || (!source && !this.rig.skin)) {
          return;
        }
        var w = world[bone.id];
        if (source) {
          var index = this.rig.referenceFrame - 1;
          this.sources(bone).forEach(
            function (part) {
              var key = this.outputKey(bone, part);
              if (!groups.has(key)) {
                groups.set(key, new pskl.model.Frame(this.width, this.height));
              }
              if (!w.visible) {
                return;
              }
              if (!part.getFrameAt(index)) {
                throw new Error("Choose an existing reference frame.");
              }
              this.merge(
                groups.get(key),
                ns.RigSegmentDeform.render(
                  this,
                  this.partFrame(part, index),
                  bone,
                  world,
                  this.opacity(part, local)
                )
              );
            }.bind(this)
          );
        } else {
          var key = this.outputKey(bone, null);
          if (!groups.has(key)) {
            groups.set(key, new pskl.model.Frame(this.width, this.height));
          }
          if (!w.visible) {
            return;
          }
          var scale = Math.sqrt(
            Math.abs(w.matrix[0] * w.matrix[3] - w.matrix[1] * w.matrix[2])
          );
          this.capsule(
            groups.get(key),
            w.start,
            w.end,
            bone.radius * scale,
            bone.radiusEnd * scale,
            bone.bulge * scale,
            bone.color
          );
        }
      }.bind(this)
    );
    if (this.rig.outline) {
      groups.forEach(
        function (frame, key) {
          var outline = ns.OutlineUtils.create(
            frame,
            this.rig.outlineColor,
            1,
            true
          );
          this.merge(outline, frame);
          groups.set(key, outline);
        }.bind(this)
      );
    }
    if (this.groupCache.size >= 3) {
      this.groupCache.clear();
    }
    this.groupCache.set(cacheKey, groups);
    return groups;
  };
  ns.RigStudioRenderer.prototype.frame = function (pose) {
    var out = new pskl.model.Frame(this.width, this.height),
      groups = this.groups(pose);
    this.stack(pose).forEach(
      function (entry) {
        if (entry.kind === "group" && groups.has(entry.name)) {
          this.merge(out, groups.get(entry.name));
        }
      }.bind(this)
    );
    return out;
  };
  // Keep transformed art in its original layer stack, including unbound
  // foregrounds (for example a floor in front of a character's feet).
  ns.RigStudioRenderer.prototype.stack = function (pose) {
    pose = pose || {};
    var layers = this.project.getLayers().filter(function (l) {
        return !(
          l.toolState.communityOwned && l.toolState.kind === "community-rig"
        );
      }),
      bound = new Set(),
      groups = new Map();
    this.rig.bones.forEach(
      function (b) {
        var source = this.source(b);
        if (b.connector || (!source && !this.rig.skin)) {
          return;
        }
        if (source) {
          bound.add(source);
          this.sources(b).forEach(function (part) {
            bound.add(part);
          });
        }
        (source ? this.sources(b) : [null]).forEach(
          function (part) {
            var key = this.outputKey(b, part),
              index = part ? layers.indexOf(part) : layers.length;
            var group = groups.get(key) || {
              kind: "group",
              name: key,
              label: part ? part.getName() : b.group,
              source: part,
              index: index,
              anchor: index,
              order: 0
            };
            var order = part ? 0 : r.pose(pose[b.id]).order;
            if (Math.abs(order) > Math.abs(group.order)) {
              group.order = order;
            }
            groups.set(key, group);
          }.bind(this)
        );
      }.bind(this)
    );
    var entries = layers.map(function (layer, index) {
      return {
        kind: "layer",
        layer: layer,
        index: index,
        bound: bound.has(layer),
        slot: index
      };
    });
    groups.forEach(function (group) {
      group.slot =
        group.order > 0
          ? layers.length + group.order + 1
          : group.order < 0
            ? group.order - 1
            : group.anchor + 0.5;
      entries.push(group);
    });
    return entries.sort(function (a, b) {
      return a.slot - b.slot;
    });
  };
  ns.RigStudioRenderer.prototype.scene = function (
    pose,
    current,
    ghosts,
    view
  ) {
    if (!this.rig.bones.length) {
      return ns.LayerUtils.flattenFrameAt(
        this.project.getLayers(),
        current,
        true
      );
    }
    var canvas = ns.CanvasUtils.createCanvas(this.width, this.height),
      ctx = canvas.getContext("2d"),
      groups = this.groups(pose);
    var onions = (ghosts || []).map(
      function (ghost) {
        return { groups: this.groups(ghost.pose), color: ghost.color };
      }.bind(this)
    );
    this.stack(pose).forEach(
      function (entry) {
        var focus = ns.RigEditorUtils
          ? ns.RigEditorUtils.weight(this, entry, view)
          : 1;
        if (!focus) {
          return;
        }
        if (entry.kind === "layer") {
          if (
            !entry.bound &&
            !ns.LayerGroupUtils.isGroup(entry.layer) &&
            !ns.LayerGroupUtils.hidden(this.project.getLayers(), entry.layer)
          ) {
            var opacity = ns.LayerGroupUtils.opacity(
                this.project.getLayers(),
                entry.layer,
                true
              ),
              source = ns.LayerEffects.frame(
                entry.layer,
                current,
                this.project.getLayers()
              ),
              blend = ns.LayerEffects.blend(entry.layer, current);
            if (blend) {
              ns.LayerBlendUtils.draw(
                canvas,
                source,
                opacity * focus,
                blend.operation,
                Number(blend.params.amount) / 100
              );
            } else {
              ctx.globalAlpha = opacity * focus;
              ctx.drawImage(ns.FrameUtils.toImage(source), 0, 0);
              ctx.globalAlpha = 1;
            }
          }
        } else {
          onions.forEach(function (onion) {
            var frame = onion.groups.get(entry.name);
            if (!frame) {
              return;
            }
            var image = ns.FrameUtils.toImage(frame),
              gc = image.getContext("2d");
            gc.globalCompositeOperation = "source-in";
            gc.fillStyle = onion.color;
            gc.fillRect(0, 0, image.width, image.height);
            ctx.globalAlpha = 0.25 * focus;
            ctx.drawImage(image, 0, 0);
            ctx.globalAlpha = 1;
          });
          var frame = groups.get(entry.name);
          if (frame) {
            ctx.globalAlpha = focus;
            ctx.drawImage(ns.FrameUtils.toImage(frame), 0, 0);
            ctx.globalAlpha = 1;
          }
        }
      }.bind(this)
    );
    return canvas;
  };
  ns.RigStudioRenderer.prototype.background = function (current) {
    var bound = new Set(
        this.rig.bones.map(function (b) {
          return b.layerId;
        })
      ),
      layers = this.project.getLayers().filter(function (l, index) {
        return (
          !(
            l.toolState.communityOwned && l.toolState.kind === "community-rig"
          ) &&
          !bound.has(l.toolState.id) &&
          !bound.has("index:" + index)
        );
      });
    return layers.length
      ? ns.LayerUtils.flattenFrameAt(layers, current, true)
      : ns.CanvasUtils.createCanvas(this.width, this.height);
  };
})();

(function () {
  var proto = pskl.service.PuppetStudioService.prototype,
    r = pskl.utils.RigStudioUtils,
    px = pskl.utils.PuppetProjectUtils,
    clone = pskl.utils.ToolStateUtils.clone;
  proto.rigIds = function (project, rig) {
    project.getLayers().forEach(function (l) {
      l.toolState.id = l.toolState.id || pskl.utils.Uuid.generate();
    });
    rig.bones.forEach(function (b) {
      if (b.layerId && b.layerId.indexOf("index:") === 0) {
        var layer = project.getLayerAt(Number(b.layerId.substring(6)));
        b.layerId = layer ? layer.toolState.id : null;
        b.layerName = layer ? layer.getName() : null;
      }
    });
  };
  proto.rigRestoreVisibility = function (project) {
    var saved = project.toolState.rigVisibility || [];
    project.getLayers().forEach(function (layer) {
      var state = saved.find(function (s) {
        return s.id === layer.toolState.id;
      });
      if (state && layer.getOpacity() === 0) {
        layer.setOpacity(state.opacity);
      }
    });
    delete project.toolState.rigVisibility;
  };
  proto.bakeRig = function (p, rig, animation) {
    var clip = rig.clips.find(function (c) {
      return c.id === rig.activeClip;
    });
    if (animation && (!clip || !clip.keys.length)) {
      throw new Error("Save poses and add clip keys before baking animation.");
    }
    var count = animation
        ? clip.pingpong
          ? clip.frames * 2 - 2
          : clip.frames
        : p.getFrameCount(),
      renderer = new pskl.utils.RigStudioRenderer(p, rig),
      placement = renderer.stack(
        animation ? r.poseAt(rig, clip, 0) : rig.workingPose
      ),
      framesByGroup = new Map();
    var groupCount = placement.filter(function (entry) {
        return entry.kind === "group";
      }).length,
      baseCount = p.getLayers().filter(function (l) {
        return !(
          l.toolState.communityOwned && l.toolState.kind === "community-rig"
        );
      }).length;
    this.checkOutput(
      p.getWidth(),
      p.getHeight(),
      Math.max(p.getFrameCount(), count),
      baseCount + groupCount
    );
    for (var i = 0; i < count; i++) {
      var pose = animation ? r.poseAt(rig, clip, i) : rig.workingPose;
      renderer.groups(pose, true).forEach(function (frame, name) {
        if (!framesByGroup.has(name)) {
          framesByGroup.set(name, []);
        }
        framesByGroup.get(name).push(frame);
      });
    }
    if (!framesByGroup.size) {
      throw new Error("Bind a source layer or group to a joint first.");
    }
    var out = px.cloneProject(p);
    this.rigIds(out, rig);
    this.rigRestoreVisibility(out);
    var layers = out.getLayers(),
      kept = layers.filter(function (l) {
        return !(
          l.toolState.communityOwned && l.toolState.kind === "community-rig"
        );
      });
    var finalCount = Math.max(p.getFrameCount(), count);
    this.checkOutput(
      p.getWidth(),
      p.getHeight(),
      finalCount,
      kept.length + framesByGroup.size
    );
    layers.splice.apply(layers, [0, layers.length].concat(kept));
    kept.forEach(function (layer) {
      while (layer.getFrames().length < finalCount) {
        layer.addFrame(layer.getFrameAt(layer.getFrames().length - 1).clone());
      }
    });
    out.toolState.rigVisibility = [];
    var bound = new Set();
    rig.bones.forEach(function (b) {
      var binding = renderer.source(b);
      if (binding && !pskl.utils.LayerGroupUtils.isGroup(binding)) {
        bound.add(binding.toolState.id);
      }
      renderer.sources(b).forEach(function (l) {
        bound.add(l.toolState.id);
      });
    });
    kept.forEach(function (layer) {
      if (bound.has(layer.toolState.id)) {
        out.toolState.rigVisibility.push({
          id: layer.toolState.id,
          opacity: layer.getOpacity()
        });
        layer.setOpacity(0);
      }
    });
    var generated = new Map();
    framesByGroup.forEach(function (frames, name) {
      while (frames.length < finalCount) {
        frames.push(new pskl.model.Frame(p.getWidth(), p.getHeight()));
      }
      var previous = p.getLayers().find(function (l) {
        return (
          l.toolState.communityOwned &&
          l.toolState.kind === "community-rig" &&
          l.toolState.group === name
        );
      });
      var entry = placement.find(function (item) {
        return item.kind === "group" && item.name === name;
      });
      var layer = pskl.model.Layer.fromFrames("Rig: " + entry.label, frames);
      layer.toolState = {
        id: previous ? previous.toolState.id : pskl.utils.Uuid.generate(),
        communityOwned: true,
        kind: "community-rig",
        group: name,
        locked: true,
        parentGroup: entry.source
          ? entry.source.rowState.parentGroup || null
          : null
      };
      generated.set(name, layer);
    });
    var ordered = placement
      .map(function (entry) {
        return entry.kind === "layer"
          ? kept[entry.index]
          : generated.get(entry.name);
      })
      .filter(Boolean);
    layers.splice.apply(layers, [0, layers.length].concat(ordered));
    out.toolState.rigStudio = rig;
    var timeline = pskl.utils.PuppetTimelineUtils.edit(out);
    var previousTag = timeline.clips.find(function (c) {
      return c.owner === "community-rig";
    });
    timeline.clips = timeline.clips.filter(function (c) {
      return c.owner !== "community-rig";
    });
    var tag = {
      id: previousTag ? previousTag.id : pskl.utils.Uuid.generate(),
      owner: "community-rig",
      name: animation ? "Rig: " + clip.name : "Rig pose",
      frames: Array.from({ length: count }, function (_v, i) {
        return i;
      }),
      pingpong: false
    };
    timeline.clips.push(tag);
    timeline.activeClip = tag.id;
    this.replaceProject(out, 0);
  };
  proto.performRig = async function (action, o, context) {
    var p = this.controller.getPiskel(),
      rig = r.config(p, o),
      bone = rig.bones.find(function (b) {
        return b.id === o.bone;
      }),
      selected = bone && bone.id;
    if (action === "template") {
      var previous = rig;
      rig = r.template(o.template, p.getWidth(), p.getHeight());
      rig.skin = false;
      rig.referenceFrame = previous.referenceFrame;
      rig.guides = previous.guides;
      selected = rig.bones[0] ? rig.bones[0].id : null;
    } else if (action === "save-draft") {
      rig = clone(context.rigDragDraft);
      if (!rig) {
        throw new Error("No joint edit is pending.");
      }
    } else if (action === "add" || action === "root") {
      var parent = action === "add" ? bone : null;
      if (action === "add" && !parent) {
        throw new Error("Choose a parent bone first.");
      }
      var b = {
        id: pskl.utils.Uuid.generate(),
        name: "New " + (parent ? "bone" : "pivot"),
        parent: parent ? parent.id : null,
        x: parent ? 0 : p.getWidth() / 2,
        y: parent ? 0 : p.getHeight() / 2,
        angle: 0,
        length: Math.max(1, p.getWidth() / 5),
        radius: parent ? 1 : 0,
        radiusEnd: parent ? 1 : 0,
        bulge: 0,
        color: o.skinColor,
        group: parent ? parent.group : "Body",
        layerId: null
      };
      rig.bones.push(b);
      rig.empty = false;
      selected = b.id;
    } else if (action === "delete") {
      if (!bone || rig.bones.length <= 1) {
        throw new Error("Keep at least one bone.");
      }
      var world = r.world(rig, {}),
        parent = bone.parent ? world[bone.parent] : null,
        base = parent ? parent.endMatrix : r.identity();
      if (bone.deformSource && bone.parent) {
        var joined = rig.bones.find(function (b) {
          return b.id === bone.parent;
        });
        joined.length += bone.length;
        joined.radiusEnd = bone.radiusEnd;
        base = r.multiply(world[joined.id].matrix, [
          1,
          0,
          0,
          1,
          joined.length,
          0
        ]);
      }
      rig.bones.forEach(function (b) {
        if (b.parent === bone.id) {
          var start = r.point(
              r.inverse(base),
              world[b.id].start.x,
              world[b.id].start.y
            ),
            angle =
              Math.atan2(world[b.id].matrix[1], world[b.id].matrix[0]) -
              Math.atan2(base[1], base[0]);
          Object.assign(b, {
            parent: bone.parent,
            x: start.x,
            y: start.y,
            angle: (angle * 180) / Math.PI
          });
        }
      });
      rig.bones = rig.bones.filter(function (b) {
        return b.id !== bone.id;
      });
      rig.bones.forEach(function (b) {
        if (b.deformSource === bone.id) {
          delete b.deformSource;
          delete b.articulation;
        }
      });
      delete rig.workingPose[bone.id];
      rig.poses.forEach(function (pose) {
        delete pose.values[bone.id];
      });
      selected = rig.bones[0] ? rig.bones[0].id : null;
    } else if (action === "disconnect") {
      if (!bone) {
        throw new Error("Choose a bone.");
      }
      var world = r.world(rig, {}),
        w = world[bone.id];
      bone.parent = null;
      bone.x = w.start.x;
      bone.y = w.start.y;
      bone.angle = (Math.atan2(w.matrix[1], w.matrix[0]) * 180) / Math.PI;
    } else if (action === "ik") {
      rig.workingPose = r.solveIK(
        rig,
        rig.workingPose,
        o.bone,
        { x: o.targetX, y: o.targetY },
        Number(o.bend)
      );
    } else if (action === "mirror") {
      rig.workingPose = r.mirrorPose(rig, rig.workingPose);
    } else if (action === "reset") {
      rig.workingPose = {};
    } else if (action === "save-pose") {
      var name = o.poseName.trim().slice(0, 80);
      if (!name) {
        throw new Error("Enter a pose name.");
      }
      var pose = rig.poses.find(function (p) {
        return p.id === o.pose;
      });
      if (!pose) {
        pose = { id: pskl.utils.Uuid.generate() };
        rig.poses.push(pose);
      }
      Object.assign(pose, { name: name, values: clone(rig.workingPose) });
    } else if (action === "load-pose") {
      var pose = rig.poses.find(function (p) {
        return p.id === o.pose;
      });
      if (!pose) {
        throw new Error("Choose a saved pose.");
      }
      rig.workingPose = clone(pose.values);
    } else if (action === "delete-pose") {
      rig.poses = rig.poses.filter(function (p) {
        return p.id !== o.pose;
      });
      rig.clips.forEach(function (c) {
        c.keys = c.keys.filter(function (k) {
          return k.pose !== o.pose;
        });
      });
    } else if (action === "clip" || action === "key") {
      var clip = rig.clips.find(function (c) {
        return c.id === o.clip;
      });
      if (action === "clip" || !clip) {
        clip = {
          id: pskl.utils.Uuid.generate(),
          name: o.clipName.trim().slice(0, 80) || "Clip",
          frames: o.frames,
          pingpong: o.pingpong,
          loop: o.loop,
          keys: []
        };
        rig.clips.push(clip);
      } else {
        clip.name = o.clipName.trim().slice(0, 80) || clip.name;
      }
      rig.activeClip = clip.id;
      if (action === "key") {
        if (
          !rig.poses.some(function (p) {
            return p.id === o.pose;
          })
        ) {
          throw new Error("Save and choose a pose first.");
        }
        var key = {
          at: o.keyFrame - 1,
          pose: o.pose,
          easing: o.easing,
          hold: o.hold
        };
        clip.keys = clip.keys
          .filter(function (k) {
            return k.at !== key.at;
          })
          .concat([key]);
      }
    } else if (action === "delete-key") {
      var clip = rig.clips.find(function (c) {
        return c.id === o.clip;
      });
      if (clip) {
        clip.keys = clip.keys.filter(function (k) {
          return k.at !== o.keyFrame - 1;
        });
      }
    } else if (action === "delete-clip") {
      rig.clips = rig.clips.filter(function (c) {
        return c.id !== o.clip;
      });
      rig.activeClip = rig.clips[0] ? rig.clips[0].id : null;
    } else if (action === "export") {
      pskl.utils.PuppetExportUtils.json(
        r.validate(rig),
        "Piskel-rig-and-poses"
      );
      return "Rig, poses and clips exported as JSON.";
    } else if (action === "import") {
      if (!o.files.length || o.files[0].size > 4194304) {
        throw new Error("Choose a rig JSON under 4 MB.");
      }
      rig = r.migratePins(r.validate(JSON.parse(await o.files[0].text())));
      if (this.controller.getPiskel() !== p) {
        throw new Error("The project changed during import.");
      }
      rig.bones.forEach(function (b) {
        if (b.layerId) {
          var layer = p.getLayers().find(function (l) {
            return l.toolState.id === b.layerId || l.getName() === b.layerName;
          });
          b.layerId = layer
            ? layer.toolState.id || "index:" + p.getLayers().indexOf(layer)
            : null;
        }
      });
      selected = rig.bones[0] ? rig.bones[0].id : null;
    } else if (action === "bake" || action === "bake-pose") {
      r.validate(rig);
      this.bakeRig(p, rig, action === "bake");
      context.refreshRig(true, selected);
      return "Rig baked in source layer order. Source pixels are kept; Remove rig output restores their visibility.";
    } else if (action === "remove-output") {
      var out = px.cloneProject(p),
        layers = out.getLayers(),
        kept = layers.filter(function (l) {
          return !(
            l.toolState.communityOwned && l.toolState.kind === "community-rig"
          );
        });
      if (kept.length === layers.length) {
        throw new Error("No rig output exists.");
      }
      this.rigRestoreVisibility(out);
      layers.splice.apply(layers, [0, layers.length].concat(kept));
      var timeline = pskl.utils.PuppetTimelineUtils.edit(out);
      timeline.clips = timeline.clips.filter(function (c) {
        return c.owner !== "community-rig";
      });
      if (
        !timeline.clips.some(function (c) {
          return c.id === timeline.activeClip;
        })
      ) {
        timeline.activeClip = null;
      }
      this.replaceProject(out);
      context.refreshRig(true, selected);
      return "Rig output removed and bound source visibility restored.";
    } else if (action !== "save") {
      throw new Error("Choose a rig action.");
    }
    if (["delete", "delete-pose", "delete-key"].includes(action)) {
      pskl.utils.JointMotionPathUtils.prune(rig);
    }
    r.validate(rig);
    var out = px.cloneProject(p);
    this.rigIds(out, rig);
    out.toolState.rigStudio = rig;
    this.replaceProject(out);
    context.rigDragDraft = null;
    context.refreshRig(true, selected);
    return "Rig settings saved. One undo restores the prior setup.";
  };
})();

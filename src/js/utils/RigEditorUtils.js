(function () {
  const u = pskl.utils,
    r = u.RigStudioUtils,
    clone = u.ToolStateUtils.clone;
  const key = (l) => l.toolState.groupNodeId || l.toolState.id;
  function root(renderer, id) {
    const b = renderer.rig.bones.find((b) => b.id === id);
    return (
      b &&
      (b.deformSource
        ? renderer.rig.bones.find((p) => p.id === b.deformSource)
        : b)
    );
  }
  function owner(renderer, layer) {
    return renderer.rig.bones.find(
      (b) => !b.connector && renderer.sources(b).includes(layer)
    );
  }
  function distance(w, p) {
    const dx = w.end.x - w.start.x,
      dy = w.end.y - w.start.y,
      t = Math.max(
        0,
        Math.min(
          1,
          ((p.x - w.start.x) * dx + (p.y - w.start.y) * dy) /
            (dx * dx + dy * dy || 1)
        )
      );
    return Math.hypot(p.x - w.start.x - t * dx, p.y - w.start.y - t * dy);
  }
  function segmentOwner(renderer, pose, bone, point) {
    const world = r.world(renderer.rig, pose);
    return renderer.rig.bones
      .filter((b) => b.id === bone.id || b.deformSource === bone.id)
      .sort(
        (a, b) => distance(world[a.id], point) - distance(world[b.id], point)
      )[0];
  }
  u.RigEditorUtils = {
    key,
    owner,
    bounds(frame) {
      let x0 = frame.width,
        y0 = frame.height,
        x1 = -1,
        y1 = -1;
      for (let y = 0; y < frame.height; y++) {
        for (let x = 0; x < frame.width; x++) {
          if (frame.pixels[y * frame.width + x] >>> 24) {
            x0 = Math.min(x0, x);
            y0 = Math.min(y0, y);
            x1 = Math.max(x1, x);
            y1 = Math.max(y1, y);
          }
        }
      }
      return x1 < 0
        ? null
        : { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
    },
    sources(renderer, id) {
      const b = root(renderer, id);
      if (!b) {
        return [];
      }
      if (!b.connector) {
        return renderer.sources(b);
      }
      return renderer.rig.bones
        .filter((c) => {
          for (
            let p = c;
            p;
            p = renderer.rig.bones.find((v) => v.id === p.parent)
          ) {
            if (p.id === id) {
              return true;
            }
          }
          return false;
        })
        .flatMap((c) => renderer.sources(c));
    },
    weight(renderer, entry, view) {
      if (!view || view.focus === "all" || (!view.bone && !view.layer)) {
        return 1;
      }
      const sources = this.sources(renderer, view.bone);
      if (!view.layer && !sources.length) {
        return 1;
      }
      const layer = entry.kind === "layer" ? entry.layer : entry.source,
        selected = view.layer
          ? layer && key(layer) === view.layer
          : sources.includes(layer);
      return selected ? 1 : view.focus === "solo" ? 0 : 0.18;
    },
    hit(renderer, pose, frameIndex, point, view) {
      const groups = renderer.groups(pose),
        x = Math.floor(point.x),
        y = Math.floor(point.y);
      if (x < 0 || y < 0 || x >= renderer.width || y >= renderer.height) {
        return null;
      }
      for (const entry of renderer.stack(pose).reverse()) {
        if (!this.weight(renderer, entry, view)) {
          continue;
        }
        const layer = entry.kind === "layer" ? entry.layer : entry.source;
        if (!layer || u.LayerGroupUtils.isGroup(layer)) {
          continue;
        }
        let frame;
        if (entry.kind === "group") {
          frame = groups.get(entry.name);
        } else if (
          !entry.bound &&
          !u.LayerGroupUtils.hidden(renderer.project.getLayers(), layer) &&
          renderer.opacity(layer) > 0
        ) {
          frame = u.LayerEffects.frame(
            layer,
            frameIndex,
            renderer.project.getLayers()
          );
        }
        if (frame && frame.getPixel(x, y) >>> 24) {
          const b = owner(renderer, layer);
          return {
            layer,
            bone: b ? segmentOwner(renderer, pose, b, point) : null
          };
        }
      }
      return null;
    },
    part(renderer, pose, id, layerId) {
      const groups = renderer.groups(pose),
        out = new pskl.model.Frame(renderer.width, renderer.height),
        layers = layerId
          ? renderer.project.getLayers().filter((l) => key(l) === layerId)
          : this.sources(renderer, id);
      for (const e of renderer.stack(pose)) {
        if (
          e.kind === "group" &&
          layers.includes(e.source) &&
          groups.has(e.name)
        ) {
          renderer.merge(out, groups.get(e.name));
        } else if (e.kind === "layer" && !e.bound && layers.includes(e.layer)) {
          renderer.merge(
            out,
            u.LayerEffects.frame(
              e.layer,
              renderer.rig.referenceFrame - 1,
              renderer.project.getLayers()
            )
          );
        }
      }
      const b = root(renderer, id);
      if (
        b &&
        !layerId &&
        renderer.rig.bones.some((v) => v.deformSource === b.id)
      ) {
        const family = renderer.rig.bones.filter(
            (v) => v.id === b.id || v.deformSource === b.id
          ),
          world = r.world(renderer.rig, pose);
        for (let y = 0; y < out.height; y++) {
          for (let x = 0; x < out.width; x++) {
            if (out.getPixel(x, y) >>> 24) {
              const closest = family
                .slice()
                .sort(
                  (a, c) =>
                    distance(world[a.id], { x, y }) -
                    distance(world[c.id], { x, y })
                )[0];
              if (closest.id !== id) {
                out.setPixel(x, y, 0);
              }
            }
          }
        }
      }
      return out;
    },
    transform(rig, pose, id, kind, from, to, box) {
      const bone = rig.bones.find((b) => b.id === id),
        world = r.world(rig, pose),
        w = world[id],
        pivot = w.start;
      if (kind === "move" && r.jointPin(bone, pose)) {
        throw new Error(
          "This pivot is locked in this pose. Unlock it to move the part."
        );
      }
      let delta = r.identity();
      const safe = (v) => (Math.abs(v) < 1 ? (v < 0 ? -1 : 1) : v);
      if (kind === "move") {
        delta = [1, 0, 0, 1, to.x - from.x, to.y - from.y];
      } else if (kind === "rotate") {
        const a =
          Math.atan2(to.y - pivot.y, to.x - pivot.x) -
          Math.atan2(from.y - pivot.y, from.x - pivot.x);
        delta = [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0];
      } else if (kind === "shear") {
        delta = [1, 0, (to.x - from.x) / Math.max(1, box.height), 1, 0, 0];
      } else {
        let sx = 1,
          sy = 1;
        if (kind === "scale") {
          sx = sy = Math.max(
            0.05,
            Math.hypot(to.x - pivot.x, to.y - pivot.y) /
              Math.max(1e-6, Math.hypot(from.x - pivot.x, from.y - pivot.y))
          );
        }
        if (kind === "scale-x") {
          sx = 1 + (to.x - from.x) / safe(from.x - pivot.x);
        }
        if (kind === "scale-y") {
          sy = 1 + (to.y - from.y) / safe(from.y - pivot.y);
        }
        const limit = (v) =>
          Math.sign(v || 1) * Math.max(0.05, Math.min(4, Math.abs(v)));
        delta = [limit(sx), 0, 0, limit(sy), 0, 0];
      }
      if (kind !== "move") {
        delta = r.multiply(r.multiply([1, 0, 0, 1, pivot.x, pivot.y], delta), [
          1,
          0,
          0,
          1,
          -pivot.x,
          -pivot.y
        ]);
      }
      const matrix = r.multiply(delta, w.matrix),
        parent = bone.parent ? world[bone.parent].endMatrix : r.identity(),
        local = r.multiply(r.inverse(parent), matrix),
        sx = Math.hypot(local[0], local[1]),
        sy = (local[0] * local[3] - local[1] * local[2]) / sx;
      if (!Number.isFinite(sy) || Math.abs(sy) < 1e-7) {
        throw new Error("A part cannot have zero scale.");
      }
      const out = clone(pose),
        p = r.pose(out[id]),
        limit = (v) =>
          Math.sign(v || 1) * Math.max(0.05, Math.min(4, Math.abs(v)));
      Object.assign(p, {
        x: local[4] - bone.x,
        y: local[5] - bone.y,
        rotation: (Math.atan2(local[1], local[0]) * 180) / Math.PI - bone.angle,
        scaleX: limit(sx),
        scaleY: limit(sy),
        shear: Math.max(
          -2,
          Math.min(2, (local[0] * local[2] + local[1] * local[3]) / (sx * sy))
        )
      });
      out[id] = p;
      return out;
    }
  };
})();

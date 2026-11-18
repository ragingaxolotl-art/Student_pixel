(function () {
  const ns = $.namespace("pskl.utils");
  const U = (ns.AssetUtils = {});
  U.MAX_PIXELS = 16000000;
  U.MAX_BYTES = 64 * 1024 * 1024;
  U.clone = (value) => JSON.parse(JSON.stringify(value));
  U.key = (a) => a.asset.id + "@" + a.asset.revision;
  U.deserialize = (data) =>
    new Promise((resolve, reject) =>
      ns.serialization.Deserializer.deserialize(data, resolve, reject)
    );
  U.document = (p) => JSON.parse(ns.serialization.Serializer.serialize(p));
  U.uuid = () => ns.Uuid.generate();
  U.capture = function (controller, options) {
    const p = controller.getPiskel(),
      g = ns.LayerGroupUtils;
    const chosen = controller.getCurrentLayer(),
      all = p.getLayers();
    let layers =
      options.source === "group" || g.isGroup(chosen)
        ? [chosen].concat(g.descendants(all, chosen))
        : [chosen];
    if (options.source === "group" && !g.isGroup(chosen)) {
      const parent = g.parent(all, chosen);
      if (!parent) {
        throw new Error("Select a group or a layer inside a group first.");
      }
      layers = [parent].concat(g.descendants(all, parent));
    }
    layers =
      options.source === "project"
        ? all
        : all.filter((l) => layers.includes(l));
    const selection = pskl.app.selectionManager.currentSelection;
    let mask;
    if (options.source === "selection") {
      if (!selection?.pixels.length) {
        throw new Error("Select some artwork before saving a selection.");
      }
      mask = new Set(selection.pixels.map((v) => v.col + ":" + v.row));
    }
    let indexes = options.allFrames
      ? Array.from({ length: p.getFrameCount() }, (_, i) => i)
      : [controller.getCurrentFrameIndex()];
    if (!options.editable) {
      // Render in the original project context before cropping, so masks and
      // ancestor opacity also survive a flattened capture.
      const frames = indexes.map((i) => {
        const canvas = ns.LayerUtils.flattenFrameAt(
          layers,
          i,
          true,
          all,
          layers[0].getFrameAt(i)
        );
        return ns.FrameUtils.createFromCanvas(
          canvas,
          0,
          0,
          p.getWidth(),
          p.getHeight(),
          true
        );
      });
      layers = [
        pskl.model.Layer.fromFrames(options.name || chosen.getName(), frames)
      ];
      indexes = frames.map((_, i) => i);
    } else {
      layers.forEach((l) =>
        indexes.forEach((i) =>
          ns.LayerEffects.enabled(l, i).forEach((effect) => {
            if (
              effect.params?.maskId ||
              ["mask", "maskInverse"].includes(effect.operation)
            ) {
              const reference = ns.LayerEffects.referenceLayer(
                l,
                effect.params || {},
                all
              );
              if (reference && !layers.includes(reference)) {
                throw new Error(
                  "Include the mask layer in this group, or turn off Keep layers editable to capture its appearance."
                );
              }
            }
          })
        )
      );
    }
    let x0 = p.getWidth(),
      y0 = p.getHeight(),
      x1 = -1,
      y1 = -1;
    layers.forEach((l) => {
      if (g.isGroup(l)) {
        return;
      }
      indexes.forEach((i) => {
        l.getFrameAt(i).pixels.forEach((color, index) => {
          const x = index % p.getWidth(),
            y = Math.floor(index / p.getWidth());
          if (color >>> 24 && (!mask || mask.has(x + ":" + y))) {
            x0 = Math.min(x0, x);
            y0 = Math.min(y0, y);
            x1 = Math.max(x1, x);
            y1 = Math.max(y1, y);
          }
        });
      });
    });
    if (x1 < x0) {
      throw new Error(
        "This source contains no painted pixels in the chosen frames."
      );
    }
    const w = x1 - x0 + 1,
      h = y1 - y0 + 1;
    U.budget(w, h, indexes.length, layers.length);
    const ids = new Map(
      layers
        .filter((l) => l.rowState.groupNodeId)
        .map((l) => [l.rowState.groupNodeId, U.uuid()])
    );
    const copied = layers.map((l) => {
      const frames = indexes.map((i) => {
        const f = new pskl.model.Frame(w, h),
          source = l.getFrameAt(i);
        if (!g.isGroup(l)) {
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              if (!mask || mask.has(x + x0 + ":" + (y + y0))) {
                f.setPixel(x, y, source.getPixel(x + x0, y + y0));
              }
            }
          }
        }
        return f;
      });
      const out = pskl.model.Layer.fromFrames(l.getName(), frames);
      out.setOpacity(l.getOpacity());
      out.rowState = U.layerState(l.rowState, ids);
      if (!options.allFrames && out.rowState.effects) {
        out.rowState.effects = out.rowState.effects
          .filter(
            (e) =>
              e.frame == null || e.frame === controller.getCurrentFrameIndex()
          )
          .map((e) => ({ ...e, frame: e.frame == null ? null : 0 }));
      }
      return out;
    });
    return pskl.model.Piskel.fromLayers(copied, p.getFPS(), {
      name: options.name || chosen.getName(),
      description: ""
    });
  };
  U.layerState = function (state, ids) {
    const out = {};
    [
      "isGroup",
      "collapsed",
      "hidden",
      "effectOnly",
      "effects",
      "blendMode"
    ].forEach((k) => {
      if (state[k] !== undefined) {
        out[k] = U.clone(state[k]);
      }
    });
    out.groupNodeId = ids.get(state.groupNodeId) || U.uuid();
    out.parentGroup = ids.get(state.parentGroup) || null;
    // Remap internal FX layer references; external source bindings are not copied.
    function remap(value) {
      if (Array.isArray(value)) {
        return value.map(remap);
      }
      if (value && typeof value === "object") {
        Object.keys(value).forEach((k) => {
          value[k] = remap(value[k]);
        });
      }
      return typeof value === "string" && ids.has(value)
        ? ids.get(value)
        : value;
    }
    return remap(out);
  };
  U.envelope = function (p, name, anchor, collection, previous) {
    name = String(name || "").trim();
    if (!name || name.length > 80) {
      throw new Error("Enter an asset name of 1–80 characters.");
    }
    const document = U.document(p);
    document.piskel.toolState = {};
    document.piskel.name = name;
    return {
      format: "piskel-asset",
      version: 1,
      asset: {
        id: previous ? previous.asset.id : U.uuid(),
        revision: previous ? previous.asset.revision + 1 : 1,
        name,
        anchor: { x: anchor.x, y: anchor.y },
        collection: String(collection || "My assets").slice(0, 80),
        tags: []
      },
      document
    };
  };
  U.budget = function (w, h, frames, layers) {
    if (
      ![w, h, frames, layers].every((v) => Number.isInteger(v) && v > 0) ||
      w > 4096 ||
      h > 4096 ||
      frames > 256 ||
      layers > 64 ||
      w * h * frames * layers > U.MAX_PIXELS
    ) {
      throw new Error(
        "Asset limit: 4096px per side, 256 frames, 64 layers and 16 million total pixels."
      );
    }
  };
  U.validate = function (input) {
    if (!input || input.format !== "piskel-asset" || input.version !== 1) {
      throw new Error("Unsupported asset format or version.");
    }
    const a = input.asset,
      d = input.document,
      p = d?.piskel;
    if (
      !a ||
      typeof a.id !== "string" ||
      !/^[a-zA-Z0-9-]{1,80}$/.test(a.id) ||
      !Number.isSafeInteger(a.revision) ||
      a.revision < 1 ||
      typeof a.name !== "string" ||
      !a.name.trim() ||
      a.name.length > 80 ||
      !p ||
      d.modelVersion !== 2 ||
      !Array.isArray(p.layers) ||
      !Number.isFinite(p.fps) ||
      p.fps <= 0 ||
      p.fps > 240
    ) {
      throw new Error("Invalid asset metadata.");
    }
    if (
      !a.anchor ||
      !Number.isInteger(a.anchor.x) ||
      !Number.isInteger(a.anchor.y) ||
      a.anchor.x < 0 ||
      a.anchor.y < 0 ||
      a.anchor.x > p.width ||
      a.anchor.y > p.height
    ) {
      throw new Error("Asset anchor is outside its artwork.");
    }
    if (JSON.stringify(input).length > U.MAX_BYTES) {
      throw new Error("Asset file exceeds 64 MiB.");
    }
    let count,
      pixels = 0;
    const parsed = p.layers.map((text) => {
      if (typeof text !== "string") {
        throw new Error("Invalid asset layer.");
      }
      const l = JSON.parse(text);
      U.budget(p.width, p.height, l.frameCount, p.layers.length);
      count = count || l.frameCount;
      if (
        count !== l.frameCount ||
        !Array.isArray(l.chunks) ||
        !l.chunks.length ||
        l.chunks.length > count ||
        !Number.isFinite(l.opacity) ||
        l.opacity < 0 ||
        l.opacity > 1
      ) {
        throw new Error("Asset frames or layers do not match.");
      }
      const seen = new Set();
      l.chunks.forEach((chunk) => {
        if (
          typeof chunk.base64PNG !== "string" ||
          !chunk.base64PNG.startsWith("data:image/png;base64,") ||
          !Array.isArray(chunk.layout) ||
          !chunk.layout.length ||
          chunk.layout.length > count
        ) {
          throw new Error("Only embedded PNG asset data is supported.");
        }
        const rows = chunk.layout[0]?.length;
        if (!rows || rows > count) {
          throw new Error("Invalid frame layout.");
        }
        chunk.layout.forEach((column) => {
          if (!Array.isArray(column) || column.length !== rows) {
            throw new Error("Invalid frame layout.");
          }
          column.forEach((i) => {
            if (!Number.isInteger(i) || i < 0 || i >= count || seen.has(i)) {
              throw new Error("Invalid frame index.");
            }
            seen.add(i);
          });
        });
        let header;
        try {
          header = atob(chunk.base64PNG.split(",")[1].slice(0, 48));
        } catch (_) {
          throw new Error("Invalid PNG data.");
        }
        const bytes = Uint8Array.from(header, (v) => v.charCodeAt(0));
        const view = new DataView(bytes.buffer);
        if (
          bytes.length < 24 ||
          view.getUint32(0) !== 0x89504e47 ||
          view.getUint32(4) !== 0x0d0a1a0a ||
          view.getUint32(16) !== p.width * chunk.layout.length ||
          view.getUint32(20) !== p.height * rows
        ) {
          throw new Error("PNG dimensions do not match the asset.");
        }
      });
      if (seen.size !== count) {
        throw new Error("Asset is missing animation frames.");
      }
      pixels += p.width * p.height * count;
      return l;
    });
    return { parsed, frames: count, pixels };
  };
  U.decode = async function (input) {
    const info = U.validate(input),
      p = input.document.piskel;
    const layers = await Promise.all(
      info.parsed.map(async (data) => {
        const frames = [];
        for (const chunk of data.chunks) {
          const image = await new Promise((resolve, reject) => {
            const img = new Image();
            const timeout = setTimeout(
              () => reject(new Error("Asset image could not be decoded.")),
              10000
            );
            img.onload = () => {
              clearTimeout(timeout);
              resolve(img);
            };
            img.onerror = () => {
              clearTimeout(timeout);
              reject(new Error("Damaged PNG in asset."));
            };
            img.src = chunk.base64PNG;
          });
          ns.FrameUtils.createFramesFromChunk(
            image,
            chunk.layout,
            true
          ).forEach((f) => {
            frames[f.index] = f.frame;
          });
        }
        frames.forEach((f, i) =>
          ns.FrameUtils.restoreRgba(f, data.rgbaCorrections?.[i])
        );
        const l = pskl.model.Layer.fromFrames(
          String(data.name || "Asset layer"),
          frames
        );
        l.setOpacity(data.opacity);
        l.rowState = U.clone(data.rowState || {});
        return l;
      })
    );
    return pskl.model.Piskel.fromLayers(layers, p.fps, {
      name: input.asset.name,
      description: ""
    });
  };
  U.layerFingerprint = function (layer) {
    let a = 2166136261,
      b = 5381;
    layer.getFrames().forEach((f) =>
      f.pixels.forEach((pixel) => {
        a = Math.imul(a ^ pixel, 16777619);
        b = Math.imul(b, 33) ^ pixel;
      })
    );
    return [
      layer.getName(),
      layer.getOpacity(),
      layer.size(),
      layer.getFrameAt(0).getWidth(),
      layer.getFrameAt(0).getHeight(),
      a >>> 0,
      b >>> 0,
      JSON.stringify(layer.rowState)
    ];
  };
  U.raster = function (frame) {
    if (frame.pixels) {
      return frame;
    }
    const cv = ns.FrameUtils.toImage(frame);
    return ns.FrameUtils.createFromCanvas(
      cv,
      0,
      0,
      frame.getWidth(),
      frame.getHeight(),
      true
    );
  };
  U.preview = (p, frame) =>
    U.raster(
      ns.LayerUtils.mergeFrameAt(p.getLayers(), frame % p.getFrameCount())
    );
  U.transform = function (frame, anchor, options, visit) {
    const scale = options.scale,
      turn = options.turn,
      flip = options.flip;
    if (
      !Number.isInteger(scale) ||
      scale < 1 ||
      scale > 4 ||
      !Number.isInteger(turn) ||
      turn < 0 ||
      turn > 3 ||
      frame.getWidth() * frame.getHeight() * scale * scale > U.MAX_PIXELS
    ) {
      throw new Error("Choose a smaller asset or scale before placing.");
    }
    frame.pixels.forEach((color, i) => {
      if (!(color >>> 24)) {
        return;
      }
      const x = i % frame.getWidth(),
        y = Math.floor(i / frame.getWidth());
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          let dx = (x - anchor.x) * scale + sx,
            dy = (y - anchor.y) * scale + sy;
          if (flip) {
            dx = -dx - 1;
          }
          for (let t = 0; t < turn; t++) {
            const temp = dx;
            dx = -dy - 1;
            dy = temp;
          }
          visit(dx, dy, color);
        }
      }
    });
  };
})();

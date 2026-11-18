(function () {
  const ns = $.namespace("pskl.service"),
    U = pskl.utils.AssetUtils;
  ns.AssetLibraryService = function (controller) {
    this.controller = controller.getWrappedPiskelController();
    this.cache = new Map();
    this.ready = this.open();
    // Keep a rejected storage initialization from preventing the editor starting.
    this.ready.catch(() => {});
  };
  const p = ns.AssetLibraryService.prototype;
  p.open = function () {
    return new Promise((resolve, reject) => {
      let req;
      try {
        req = indexedDB.open("PiskelAssetLibrary", 1);
      } catch (e) {
        reject(e);
        return;
      }
      req.onupgradeneeded = () => {
        req.result.createObjectStore("assets", { keyPath: "id" });
        req.result.createObjectStore("revisions", { keyPath: "key" });
      };
      req.onerror = () =>
        reject(
          new Error(
            "Device asset storage is unavailable. Download your asset instead."
          )
        );
      req.onblocked = () =>
        reject(
          new Error("Close another editor tab to open the asset library.")
        );
      req.onsuccess = () => {
        this.db = req.result;
        this.db.onversionchange = () => this.db.close();
        resolve();
      };
    });
  };
  p.transaction = async function (stores, mode, work) {
    await this.ready;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(stores, mode);
      let result;
      tx.oncomplete = () =>
        resolve(typeof result === "function" ? result() : result);
      tx.onabort = tx.onerror = () =>
        reject(
          new Error(
            tx.error?.name === "QuotaExceededError"
              ? "Device storage is full. Download an asset pack to keep your work."
              : "Asset save failed. Download your asset to keep it."
          )
        );
      try {
        result = work(tx);
      } catch (e) {
        tx.abort();
        reject(e);
      }
    });
  };
  p.thumbnail = function (decoded) {
    const frame = U.preview(decoded, 0),
      cv = document.createElement("canvas");
    cv.width = cv.height = 64;
    const ctx = cv.getContext("2d"),
      scale = Math.min(60 / frame.getWidth(), 60 / frame.getHeight());
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      pskl.utils.FrameUtils.toImage(frame),
      (64 - frame.getWidth() * scale) / 2,
      (64 - frame.getHeight() * scale) / 2,
      frame.getWidth() * scale,
      frame.getHeight() * scale
    );
    return cv.toDataURL();
  };
  p.list = function () {
    return this.transaction(["assets"], "readonly", (tx) => {
      const req = tx.objectStore("assets").getAll();
      return () =>
        req.result.sort(
          (a, b) => b.updated - a.updated || a.name.localeCompare(b.name)
        );
    });
  };
  p.get = function (key) {
    return this.transaction(["revisions"], "readonly", (tx) => {
      const req = tx.objectStore("revisions").get(key);
      return () => req.result?.envelope;
    });
  };
  p.save = async function (envelope, replacing) {
    const decoded = await U.decode(envelope);
    const thumbnail = this.thumbnail(decoded);
    return this.transaction(["assets", "revisions"], "readwrite", (tx) => {
      const assets = tx.objectStore("assets"),
        revisions = tx.objectStore("revisions");
      const req = assets.get(envelope.asset.id);
      req.onsuccess = () => {
        try {
          const previous = req.result;
          if (
            previous &&
            (!replacing || previous.revision !== envelope.asset.revision - 1)
          ) {
            tx.abort();
            return;
          }
          if (!previous && !replacing && envelope.asset.revision !== 1) {
            tx.abort();
            return;
          }
          revisions.add({ key: U.key(envelope), envelope: U.clone(envelope) });
          assets.put({
            ...U.clone(envelope.asset),
            key: U.key(envelope),
            thumbnail,
            updated: Date.now()
          });
        } catch (_) {
          tx.abort();
        }
      };
      return () => envelope;
    });
  };
  p.importPack = async function (data) {
    if (JSON.stringify(data).length > U.MAX_BYTES) {
      throw new Error("Asset pack exceeds 64 MiB.");
    }
    const list =
      data.format === "piskel-asset"
        ? [data]
        : data.format === "piskel-asset-pack" &&
            data.version === 1 &&
            Array.isArray(data.assets)
          ? data.assets
          : null;
    if (!list?.length || list.length > 256) {
      throw new Error("Choose an asset or a pack containing 1–256 assets.");
    }
    let pixels = 0;
    const records = list.map((a) => {
      pixels += U.validate(a).pixels;
      return U.clone(a);
    });
    if (pixels > U.MAX_PIXELS) {
      throw new Error("Asset pack exceeds 16 million decoded pixels.");
    }
    const thumbnails = new Map();
    for (const a of records) {
      thumbnails.set(a, this.thumbnail(await U.decode(a)));
    }
    return this.transaction(["assets", "revisions"], "readwrite", (tx) => {
      const revisions = tx.objectStore("revisions"),
        assets = tx.objectStore("assets"),
        imported = [];
      records.forEach((a) => {
        const req = revisions.get(U.key(a));
        req.onsuccess = () => {
          if (
            req.result &&
            JSON.stringify(req.result.envelope) === JSON.stringify(a)
          ) {
            imported.push(req.result.envelope);
            return;
          }
          // Imported artwork never overwrites another revision, including conflicts.
          a.asset.id = U.uuid();
          a.asset.revision = 1;
          revisions.add({ key: U.key(a), envelope: a });
          assets.add({
            ...a.asset,
            key: U.key(a),
            thumbnail: thumbnails.get(a),
            updated: Date.now()
          });
          imported.push(a);
        };
      });
      return () => imported;
    });
  };
  p.remove = function (id) {
    return this.transaction(["assets", "revisions"], "readwrite", (tx) => {
      tx.objectStore("assets").delete(id);
      const req = tx.objectStore("revisions").openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          if (cursor.value.envelope.asset.id === id) {
            cursor.delete();
          }
          cursor.continue();
        }
      };
    });
  };
  p.projectAssets = function () {
    return Object.values(
      this.controller.getPiskel().toolState.assetLibrary?.assets || {}
    );
  };
  p.decoded = async function (a) {
    const key = U.key(a);
    if (!this.cache.has(key)) {
      if (this.cache.size >= 8) {
        this.cache.delete(this.cache.keys().next().value);
      }
      this.cache.set(key, U.decode(a));
    }
    return this.cache.get(key);
  };
  p.download = function (data, filename) {
    pskl.utils.FileUtils.downloadAsFile(
      new Blob([JSON.stringify(data)], { type: "application/json" }),
      filename
    );
  };
  p.snapshot = function () {
    if (this.batch) {
      return;
    }
    $.publish(Events.PISKEL_SAVE_STATE, {
      type: pskl.service.HistoryService.SNAPSHOT
    });
    $.publish(Events.PISKEL_RESET);
  };
  p.place = function (a, decoded, positions, options) {
    const c = this.controller,
      project = c.getPiskel();
    if (!positions.length || positions.length > 64) {
      throw new Error("Place up to 64 stamps in one gesture.");
    }
    const count = Math.max(
      project.getFrameCount(),
      c.getCurrentFrameIndex() +
        Math.ceil(
          (decoded.getFrameCount() * project.getFPS()) / decoded.getFPS()
        )
    );
    const added = positions.length * (decoded.getLayers().length + 1);
    if (
      count > 256 ||
      project.getWidth() *
        project.getHeight() *
        count *
        (project.getLayers().length + added) >
        U.MAX_PIXELS
    ) {
      throw new Error(
        "This placement would exceed the 16 million pixel project budget. Use fewer or smaller stamps."
      );
    }
    const clones = [],
      start = c.getCurrentFrameIndex(),
      w = project.getWidth(),
      h = project.getHeight();
    positions.forEach((position) => {
      const groupId = U.uuid(),
        instanceId = U.uuid();
      const ids = new Map(
        decoded
          .getLayers()
          .map((l) => [pskl.utils.LayerGroupUtils.id(l), U.uuid()])
      );
      decoded.getLayers().forEach((l) => {
        const frames = Array.from({ length: count }, (_, index) => {
          const f = new pskl.model.Frame(w, h);
          if (index < start) {
            return f;
          }
          const sourceIndex =
            decoded.getFrameCount() === 1
              ? 0
              : Math.floor(
                  ((index - start) * decoded.getFPS()) / project.getFPS()
                ) % decoded.getFrameCount();
          U.transform(
            l.getFrameAt(sourceIndex),
            a.asset.anchor,
            options,
            (dx, dy, color) => {
              const x = position.x + dx,
                y = position.y + dy;
              if (f.containsPixel(x, y)) {
                f.setPixel(x, y, color);
              }
            }
          );
          return f;
        });
        const out = pskl.model.Layer.fromFrames(l.getName(), frames);
        out.setOpacity(l.getOpacity());
        out.rowState = U.layerState(l.rowState, ids);
        out.rowState.parentGroup = out.rowState.parentGroup || groupId;
        out.rowState.assetPartOf = instanceId;
        clones.push(out);
      });
      const group = pskl.model.Layer.fromFrames(
        a.asset.name,
        Array.from({ length: count }, () => new pskl.model.Frame(w, h))
      );
      group.rowState = {
        isGroup: true,
        groupNodeId: groupId,
        collapsed: false,
        assetInstance: {
          id: instanceId,
          key: U.key(a),
          x: position.x,
          y: position.y,
          ...options,
          cycleFrames: Math.max(
            1,
            Math.ceil(
              (decoded.getFrameCount() * project.getFPS()) / decoded.getFPS()
            )
          ),
          startFrame: start
        }
      };
      group.rowState.assetInstance.originalHashes = clones
        .filter((l) => l.rowState.assetPartOf === instanceId)
        .map((l) => U.layerFingerprint(l));
      clones.push(group);
    });
    // Extend existing artwork before mutating anything. Previously placed assets
    // keep their animation cycle, and ordinary artwork holds its last frame.
    const g = pskl.utils.LayerGroupUtils,
      instances = new Map(),
      untouched = [];
    project.getLayers().forEach((l) => {
      const info = l.rowState.assetInstance;
      if (!info) {
        return;
      }
      instances.set(info.id, info);
      const parts = g.descendants(project.getLayers(), l);
      if (
        JSON.stringify(parts.map(U.layerFingerprint)) ===
        JSON.stringify(info.originalHashes)
      ) {
        untouched.push({ info, parts });
      }
    });
    const extensions = project.getLayers().map((l) => {
      const info = instances.get(l.rowState.assetPartOf),
        frames = [];
      for (let i = l.size(); i < count; i++) {
        const source = info
          ? Math.min(
              l.size() - 1,
              info.startFrame +
                ((i - info.startFrame) % (info.cycleFrames || 1))
            )
          : l.size() - 1;
        frames.push(l.getFrameAt(Math.max(0, source)).clone());
      }
      return { l, frames };
    });
    // All allocations complete before changing the project; failed placement is atomic.
    extensions.forEach(({ l, frames }) => frames.forEach((f) => l.addFrame(f)));
    untouched.forEach(({ info, parts }) => {
      info.originalHashes = parts.map(U.layerFingerprint);
    });
    project.toolState.assetLibrary = project.toolState.assetLibrary || {
      version: 1,
      assets: {}
    };
    project.toolState.assetLibrary.assets[U.key(a)] = U.clone(a);
    project.getLayers().push(...clones);
    pskl.utils.LayerGroupUtils.normalize(project.getLayers());
    c.currentLayerIndex = project
      .getLayers()
      .indexOf(clones[clones.length - 1]);
    this.snapshot();
  };
  p.updateCopies = async function (a) {
    const c = this.controller,
      project = c.getPiskel(),
      g = pskl.utils.LayerGroupUtils;
    const targets = project.getLayers().filter((l) => {
      const instance = l.rowState.assetInstance;
      if (
        !instance ||
        !instance.key.startsWith(a.asset.id + "@") ||
        instance.key === U.key(a)
      ) {
        return false;
      }
      const hashes = g
        .descendants(project.getLayers(), l)
        .map((part) => U.layerFingerprint(part));
      return JSON.stringify(hashes) === JSON.stringify(instance.originalHashes);
    });
    if (!targets.length) {
      return 0;
    }
    const decoded = await this.decoded(a),
      backup = U.document(project),
      frame = c.getCurrentFrameIndex(),
      index = c.getCurrentLayerIndex();
    this.batch = true;
    try {
      for (const target of targets) {
        const old = target.rowState.assetInstance,
          branch = new Set(
            [target].concat(g.descendants(project.getLayers(), target))
          );
        c.currentFrameIndex = old.startFrame;
        this.place(a, decoded, [{ x: old.x, y: old.y }], {
          scale: old.scale,
          turn: old.turn,
          flip: old.flip
        });
        const selected = project.getLayerAt(c.currentLayerIndex);
        project.layers = project.getLayers().filter((l) => !branch.has(l));
        c.currentLayerIndex = Math.max(
          0,
          project.getLayers().indexOf(selected)
        );
      }
      c.currentFrameIndex = frame;
    } catch (error) {
      c.setPiskel(await U.deserialize(backup));
      c.currentFrameIndex = frame;
      c.currentLayerIndex = index;
      $.publish(Events.PISKEL_RESET);
      throw error;
    } finally {
      this.batch = false;
    }
    this.snapshot();
    return targets.length;
  };
  p.edit = async function (a) {
    const c = this.controller;
    if (c.getPiskel().toolState.assetEditing) {
      throw new Error("Return to your project before opening another asset.");
    }
    const decoded = await U.decode(a),
      original = U.document(c.getPiskel());
    decoded.toolState.assetEditing = {
      source: U.clone(a),
      savedFingerprint: JSON.stringify(
        decoded.getLayers().map(U.layerFingerprint)
      ),
      project: original,
      frame: c.getCurrentFrameIndex(),
      layer: c.getCurrentLayerIndex()
    };
    c.setPiskel(decoded);
    $.publish(Events.FRAME_SIZE_CHANGED);
    this.snapshot();
  };
  p.returnToProject = async function () {
    const c = this.controller,
      editing = c.getPiskel().toolState.assetEditing;
    if (!editing) {
      return;
    }
    const project = await U.deserialize(editing.project);
    c.setPiskel(project);
    c.currentFrameIndex = editing.frame;
    c.currentLayerIndex = editing.layer;
    $.publish(Events.FRAME_SIZE_CHANGED);
    this.snapshot();
  };
})();

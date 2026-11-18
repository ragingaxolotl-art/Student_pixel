(function () {
  const ns = $.namespace("pskl.controller"),
    U = pskl.utils.AssetUtils;
  ns.AssetLibraryController = function (controller) {
    this.controller = controller;
    this.service = new pskl.service.AssetLibraryService(controller);
    this.root = document.querySelector("#asset-library");
    this.scope = "library";
    this.mode = "single";
    this.entries = [];
    this.refreshId = 0;
    this.active = false;
  };
  const p = ns.AssetLibraryController.prototype;
  p.q = function (s) {
    return this.root.querySelector(s);
  };
  p.say = function (message, error) {
    this.q(".asset-status").textContent = message;
    this.q(".asset-status").classList.toggle("asset-error", !!error);
  };
  p.init = function () {
    document
      .querySelectorAll("[data-open-assets],[data-save-asset]")
      .forEach((b) =>
        b.addEventListener("click", () => {
          this.open();
          if (b.hasAttribute("data-save-asset")) {
            this.openSave();
          }
        })
      );
    this.root.addEventListener("click", (e) => {
      const b = e.target.closest(
        "[data-asset-action],[data-asset-scope],[data-asset-mode]"
      );
      if (!b) {
        return;
      }
      if (b.dataset.assetScope) {
        this.scope = b.dataset.assetScope;
        this.refresh();
      } else if (b.dataset.assetMode) {
        this.mode = b.dataset.assetMode;
        this.renderModes();
      } else {
        this.action(b.dataset.assetAction).catch((error) =>
          this.say(error.message || String(error), true)
        );
      }
    });
    this.q(".asset-search").addEventListener("input", () => this.renderGrid());
    this.form = this.q(".asset-save-form");
    this.form.addEventListener("submit", (e) => {
      e.preventDefault();
      this.save(false);
    });
    this.form.addEventListener("change", () => this.previewCapture());
    this.q(".asset-save-preview").addEventListener("click", (e) => {
      if (!this.candidate) {
        return;
      }
      const box = e.target.getBoundingClientRect(),
        fit = this.previewFit;
      this.customAnchor = {
        x: Math.round(
          Math.max(
            0,
            Math.min(
              this.candidate.getWidth(),
              (((e.clientX - box.left) / box.width) * 192 - fit.x) / fit.scale
            )
          )
        ),
        y: Math.round(
          Math.max(
            0,
            Math.min(
              this.candidate.getHeight(),
              (((e.clientY - box.top) / box.height) * 192 - fit.y) / fit.scale
            )
          )
        )
      };
      this.form.elements.anchor.value = "custom";
      this.drawCapture();
    });
    this.q(".asset-file").addEventListener("change", async (e) => {
      try {
        const file = e.target.files[0];
        if (!file) {
          return;
        }
        if (file.size > U.MAX_BYTES) {
          throw new Error("Asset pack exceeds 64 MiB.");
        }
        const data = JSON.parse(await file.text());
        const list =
          data.format === "piskel-asset"
            ? [data]
            : data.format === "piskel-asset-pack" && data.version === 1
              ? data.assets
              : null;
        if (!Array.isArray(list) || !list.length || list.length > 256) {
          throw new Error("Choose a valid asset or asset pack.");
        }
        let pixels = 0;
        list.forEach((a) => {
          pixels += U.validate(a).pixels;
        });
        if (pixels > U.MAX_PIXELS) {
          throw new Error("Asset pack exceeds 16 million decoded pixels.");
        }
        this.pendingImport = data;
        this.q(".asset-import-summary").textContent =
          list.length +
          " asset(s): " +
          list.map((a) => a.asset.name).join(", ");
        this.q(".asset-import-dialog").showModal();
      } catch (error) {
        this.say(error.message, true);
      }
      e.target.value = "";
    });
    this.root.addEventListener("keydown", (e) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        !this.q("dialog[open]") &&
        !e.target.matches("input,select,textarea")
      ) {
        return;
      }
      if (e.key === "Escape" && !this.q("dialog[open]")) {
        this.stop();
        this.root.hidden = true;
      }
      e.stopPropagation();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.active) {
        this.stop();
        e.preventDefault();
      }
    });
    $.subscribe(Events.TOOL_SELECTED, () => this.stop());
    $.subscribe(Events.PISKEL_RESET, () => {
      if (this.lastProject !== this.controller.getPiskel()) {
        this.stop();
        this.lastProject = this.controller.getPiskel();
      }
      this.q('[data-asset-action="return"]').hidden =
        !this.controller.getPiskel().toolState.assetEditing;
      if (!this.root.hidden) {
        this.refresh();
      }
    });
    this.lastProject = this.controller.getPiskel();
    this.renderModes();
    this.bindCanvas();
    this.bindGeometry();
  };
  p.open = function () {
    this.root.hidden = false;
    this.q('[data-asset-action="return"]').hidden =
      !this.controller.getPiskel().toolState.assetEditing;
    this.refresh();
  };
  p.refresh = async function () {
    const token = ++this.refreshId;
    this.root
      .querySelectorAll("[data-asset-scope]")
      .forEach((b) =>
        b.setAttribute(
          "aria-pressed",
          String(b.dataset.assetScope === this.scope)
        )
      );
    try {
      let entries;
      if (this.scope === "project") {
        entries = this.service.projectAssets();
      } else {
        const list = await this.service.list();
        entries = list.map((a) => ({ asset: a, thumbnail: a.thumbnail }));
      }
      if (token !== this.refreshId) {
        return;
      }
      this.entries = entries.filter(Boolean);
      if (
        !this.selected ||
        !this.entries.some((a) => U.key(a) === U.key(this.selected))
      ) {
        this.selected = this.entries[0] || null;
      }
      this.renderGrid();
      if (this.selected) {
        await this.select(this.selected);
      } else {
        this.clearDetail();
      }
    } catch (error) {
      this.say(error.message, true);
      this.entries = [];
      this.renderGrid();
    }
  };
  p.clearDetail = function () {
    this.q(".asset-detail strong").textContent = "No asset selected";
    this.q(".asset-detail p").textContent = "";
    this.q(".asset-anchor-caption").textContent = "";
    this.q(".asset-detail canvas").getContext("2d").clearRect(0, 0, 96, 96);
    this.decoded = null;
  };
  p.renderGrid = function () {
    const query = this.q(".asset-search").value.trim().toLowerCase(),
      grid = this.q(".asset-grid");
    grid.replaceChildren();
    this.entries
      .filter((a) =>
        (a.asset.name + " " + a.asset.collection).toLowerCase().includes(query)
      )
      .forEach((a) => {
        const b = document.createElement("button"),
          canvas = document.createElement("canvas"),
          label = document.createElement("span");
        b.type = "button";
        b.dataset.assetKey = U.key(a);
        b.setAttribute(
          "aria-pressed",
          String(this.selected && U.key(this.selected) === U.key(a))
        );
        b.setAttribute("aria-label", a.asset.name + " asset");
        canvas.width = canvas.height = 64;
        canvas.setAttribute("aria-hidden", "true");
        label.textContent = a.asset.name;
        b.append(canvas, label);
        grid.append(b);
        if (a.thumbnail) {
          const image = new Image();
          image.onload = () =>
            canvas.getContext("2d").drawImage(image, 0, 0, 64, 64);
          image.src = a.thumbnail;
        } else {
          this.service
            .decoded(a)
            .then((decoded) => this.drawFit(canvas, U.preview(decoded, 0)))
            .catch((error) => this.say(error.message, true));
        }
        b.addEventListener("click", () => {
          this.stop();
          this.select(a).catch((error) => this.say(error.message, true));
        });
      });
    this.q(".asset-empty").hidden = grid.children.length > 0;
    this.q(".asset-empty").textContent = query
      ? "No matching assets."
      : "Save your artwork or import an asset pack.";
  };
  p.select = async function (a) {
    this.selected = a;
    this.decoded = null;
    const envelope = a.document ? a : await this.service.get(U.key(a));
    if (!envelope) {
      throw new Error("This asset was removed. Refresh the library.");
    }
    const decoded = await this.service.decoded(envelope);
    if (this.selected !== a) {
      return;
    }
    this.selected = envelope;
    this.decoded = decoded;
    this.root
      .querySelectorAll("[data-asset-key]")
      .forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.assetKey === U.key(a)))
      );
    this.q(".asset-detail strong").textContent = a.asset.name;
    this.q(".asset-detail p").textContent =
      decoded.getWidth() +
      " × " +
      decoded.getHeight() +
      " · " +
      decoded.getFrameCount() +
      " frame(s) · " +
      decoded.getLayers().length +
      " layer(s) · revision " +
      a.asset.revision;
    this.q(".asset-anchor-caption").textContent =
      "Anchor " + a.asset.anchor.x + ", " + a.asset.anchor.y;
    this.drawFit(this.q(".asset-detail canvas"), U.preview(decoded, 0));
  };
  p.drawFit = function (canvas, frame) {
    const ctx = canvas.getContext("2d"),
      scale = Math.min(
        (canvas.width - 12) / frame.getWidth(),
        (canvas.height - 12) / frame.getHeight()
      );
    const x = (canvas.width - frame.getWidth() * scale) / 2,
      y = (canvas.height - frame.getHeight() * scale) / 2;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      pskl.utils.FrameUtils.toImage(frame),
      x,
      y,
      frame.getWidth() * scale,
      frame.getHeight() * scale
    );
    return { x, y, scale };
  };
  p.openSave = function () {
    this.stop();
    const c = this.controller,
      editing = c.getPiskel().toolState.assetEditing;
    this.form.elements.source.value = editing
      ? "project"
      : pskl.app.selectionManager.currentSelection?.pixels.length
        ? "selection"
        : pskl.utils.LayerGroupUtils.isGroup(c.getCurrentLayer())
          ? "group"
          : "layer";
    this.form.elements.name.value = editing
      ? editing.source.asset.name
      : c.getCurrentLayer().getName();
    this.form.elements.frames.value = "all";
    this.form.elements.anchor.value = "bottom";
    this.customAnchor = null;
    this.form.elements.collection.value =
      editing?.source.asset.collection || "My assets";
    this.q('[data-asset-action="update"]').hidden = !editing;
    this.previewCapture();
    this.q(".asset-save-dialog").showModal();
    this.form.elements.name.focus();
  };
  p.previewCapture = function () {
    try {
      this.candidate = U.capture(this.controller, {
        source: this.form.elements.source.value,
        allFrames: this.form.elements.frames.value === "all",
        editable: this.form.elements.editable.checked,
        name: this.form.elements.name.value
      });
      this.q(".asset-save-status").textContent = "";
      this.drawCapture();
    } catch (error) {
      this.candidate = null;
      this.q(".asset-save-status").textContent = error.message;
    }
  };
  p.anchor = function () {
    const p = this.candidate,
      mode = this.form.elements.anchor.value;
    return mode === "custom" && this.customAnchor
      ? this.customAnchor
      : mode === "center"
        ? { x: Math.floor(p.getWidth() / 2), y: Math.floor(p.getHeight() / 2) }
        : mode === "top-left"
          ? { x: 0, y: 0 }
          : { x: Math.floor(p.getWidth() / 2), y: p.getHeight() };
  };
  p.drawCapture = function () {
    const cv = this.q(".asset-save-preview");
    this.previewFit = this.drawFit(cv, U.preview(this.candidate, 0));
    const anchor = this.anchor(),
      fit = this.previewFit,
      ctx = cv.getContext("2d");
    ctx.fillStyle = "#ffd700";
    ctx.fillRect(
      fit.x + anchor.x * fit.scale - 3,
      fit.y + anchor.y * fit.scale - 3,
      6,
      6
    );
    this.q(".asset-capture-size").textContent =
      this.candidate.getWidth() +
      " × " +
      this.candidate.getHeight() +
      " · " +
      this.candidate.getFrameCount() +
      " frame(s) · click preview to set anchor";
  };
  p.draft = function (update) {
    if (!this.candidate) {
      throw new Error("Choose a source containing artwork first.");
    }
    const editing = this.controller.getPiskel().toolState.assetEditing;
    return U.envelope(
      this.candidate,
      this.form.elements.name.value,
      this.anchor(),
      this.form.elements.collection.value,
      update ? editing?.source : null
    );
  };
  p.save = async function (update) {
    try {
      const a = this.draft(update);
      this.q(".asset-save-status").classList.remove("asset-error");
      this.q(".asset-save-status").textContent = "Saving…";
      this.form.querySelectorAll("button").forEach((b) => {
        b.disabled = true;
      });
      await this.service.save(a, update);
      const editing = this.controller.getPiskel().toolState.assetEditing;
      if (editing) {
        editing.source = U.clone(a);
        editing.savedDocument = U.document(this.candidate);
        editing.savedFingerprint = JSON.stringify(
          this.controller.getLayers().map(U.layerFingerprint)
        );
        this.service.snapshot();
      }
      this.q(".asset-save-dialog").close();
      this.scope = "library";
      this.selected = a;
      this.q(".asset-search").value = "";
      await this.refresh();
      this.say(
        "Saved to My library on this device. Export a pack to back it up."
      );
    } catch (error) {
      this.q(".asset-save-status").textContent = error.message;
      this.q(".asset-save-status").classList.add("asset-error");
    } finally {
      this.form.querySelectorAll("button").forEach((b) => {
        b.disabled = false;
      });
    }
  };
  p.action = async function (action) {
    if (action === "close") {
      this.stop();
      this.root.hidden = true;
    }
    if (action === "capture") {
      this.openSave();
    }
    if (action === "cancel-save") {
      this.q(".asset-save-dialog").close();
    }
    if (action === "download-draft") {
      this.service.download(this.draft(false), "asset.piskelasset");
    }
    if (action === "update") {
      await this.save(true);
    }
    if (action === "place") {
      if (this.active) {
        this.stop();
        return;
      }
      if (!this.selected || !this.decoded) {
        throw new Error("Select an asset first.");
      }
      this.active = true;
      document.body.classList.add("asset-stamping");
      $.publish(Events.SELECTION_DISMISSED);
      this.q(".asset-place").textContent = "Stop placing · Esc";
      this.say(
        "Click the canvas to place. Drag for Repeat. Esc ends placement. Each gesture is one undo."
      );
    }
    if (action === "edit") {
      if (!this.selected) {
        throw new Error("Select an asset first.");
      }
      this.stop();
      await this.service.edit(this.selected);
      this.say(
        "Editing your asset. Use Save as asset to update it or make a new asset; Return to project keeps your scene."
      );
    }
    if (action === "return") {
      const edit = this.controller.getPiskel().toolState.assetEditing;
      if (
        edit &&
        edit.savedFingerprint !==
          JSON.stringify(this.controller.getLayers().map(U.layerFingerprint)) &&
        !confirm(
          "Return to your project? Save asset changes first if you want to keep them in My library."
        )
      ) {
        return;
      }
      this.stop();
      await this.service.returnToProject();
      this.say(
        "Returned to your project. Its existing asset copies are unchanged."
      );
    }
    if (action === "export") {
      const entries =
        this.scope === "project"
          ? this.service.projectAssets()
          : await Promise.all(
              (await this.service.list()).map((a) => this.service.get(a.key))
            );
      if (!entries.length) {
        throw new Error("There are no assets to export.");
      }
      this.service.download(
        {
          format: "piskel-asset-pack",
          version: 1,
          name: "My assets",
          assets: entries
        },
        "my-assets.piskelpack"
      );
    }
    if (action === "export-one") {
      if (!this.selected) {
        throw new Error("Select an asset first.");
      }
      this.service.download(this.selected, "asset.piskelasset");
    }
    if (action === "import") {
      this.q(".asset-file").click();
    }
    if (action === "cancel-import") {
      this.pendingImport = null;
      this.q(".asset-import-dialog").close();
    }
    if (action === "confirm-import") {
      if (this.importing) {
        return;
      }
      this.importing = true;
      try {
        const imported = await this.service.importPack(this.pendingImport);
        this.q(".asset-import-dialog").close();
        this.scope = "library";
        await this.refresh();
        this.say(imported.length + " asset(s) added to My library.");
      } finally {
        this.importing = false;
      }
    }
    if (action === "copy") {
      if (!this.selected) {
        throw new Error("Select a project asset first.");
      }
      const a = U.clone(this.selected);
      a.asset.id = U.uuid();
      a.asset.revision = 1;
      await this.service.save(a, false);
      this.scope = "library";
      this.selected = a;
      await this.refresh();
      this.say("Asset copied to My library.");
    }
    if (action === "delete") {
      if (!this.selected || this.scope !== "library") {
        throw new Error("Select an asset in My library first.");
      }
      if (
        !confirm(
          "Remove this asset from My library? Copies embedded in projects will remain."
        )
      ) {
        return;
      }
      await this.service.remove(this.selected.asset.id);
      this.selected = null;
      await this.refresh();
      this.say("Removed from My library. Project copies remain available.");
    }
    if (action === "update-copies") {
      if (!this.selected) {
        throw new Error("Choose the updated asset in My library first.");
      }
      this.stop();
      const count = await this.service.updateCopies(this.selected);
      this.say(
        count + " untouched placed copies updated. Edited copies were kept."
      );
    }
  };
  p.renderModes = function () {
    this.root
      .querySelectorAll("[data-asset-mode]")
      .forEach((b) =>
        b.setAttribute(
          "aria-pressed",
          String(b.dataset.assetMode === this.mode)
        )
      );
    this.q(".asset-spacing").hidden = this.mode === "single";
  };
  p.options = function () {
    return {
      scale: Number(this.q('[aria-label="Asset scale"]').value),
      turn: Number(this.q('[aria-label="Asset rotation"]').value),
      flip: this.q('[aria-label="Flip asset"]').checked
    };
  };
  p.stop = function () {
    this.active = false;
    this.down = null;
    document.body.classList.remove("asset-stamping");
    this.q(".asset-place").textContent = "Place on canvas";
    pskl.app.drawingController?.overlayFrame?.clear();
  };
  p.bindCanvas = function () {
    const stage = document.querySelector("#drawing-canvas-container");
    const point = (e) =>
      pskl.app.drawingController.getSpriteCoordinates(e.clientX, e.clientY);
    stage.addEventListener(
      "pointerdown",
      (e) => {
        if (!this.active || e.button !== 0) {
          return;
        }
        e.preventDefault();
        e.stopImmediatePropagation();
        document.activeElement?.blur();
        this.down = point(e);
        stage.setPointerCapture(e.pointerId);
      },
      true
    );
    stage.addEventListener(
      "pointermove",
      (e) => {
        if (!this.active || !this.decoded) {
          return;
        }
        e.preventDefault();
        e.stopImmediatePropagation();
        const pos = point(e),
          overlay = pskl.app.drawingController.overlayFrame;
        overlay.clear();
        try {
          U.transform(
            U.preview(this.decoded, 0),
            this.selected.asset.anchor,
            this.options(),
            (dx, dy, color) => {
              if (overlay.containsPixel(pos.x + dx, pos.y + dy)) {
                overlay.setPixel(pos.x + dx, pos.y + dy, color);
              }
            }
          );
        } catch (error) {
          this.stop();
          this.say(error.message, true);
        }
      },
      true
    );
    stage.addEventListener(
      "pointerup",
      (e) => {
        if (!this.active || !this.down) {
          return;
        }
        e.preventDefault();
        e.stopImmediatePropagation();
        const pos = point(e),
          start = this.down;
        this.down = null;
        const spacing = Math.max(
          1,
          Math.min(
            512,
            Number(this.q('[aria-label="Stamp spacing"]').value) || 16
          )
        );
        const positions = [];
        if (this.mode === "single") {
          positions.push(pos);
        }
        if (this.mode === "repeat") {
          const dx = pos.x - start.x,
            dy = pos.y - start.y,
            n = Math.min(63, Math.floor(Math.hypot(dx, dy) / spacing));
          for (let i = 0; i <= n; i++) {
            positions.push({
              x: Math.round(start.x + dx * (n ? i / n : 0)),
              y: Math.round(start.y + dy * (n ? i / n : 0))
            });
          }
        }
        if (this.mode === "scatter") {
          const count = Math.max(
            1,
            Math.min(
              32,
              Number(this.q('[aria-label="Scatter count"]').value) || 5
            )
          );
          for (let i = 0; i < count; i++) {
            positions.push({
              x: Math.round(pos.x + Math.cos(i * 2.4) * spacing * Math.sqrt(i)),
              y: Math.round(pos.y + Math.sin(i * 2.4) * spacing * Math.sqrt(i))
            });
          }
        }
        try {
          this.service.place(
            this.selected,
            this.decoded,
            positions,
            this.options()
          );
          this.say(
            positions.length +
              " editable asset(s) placed. Undo removes this gesture."
          );
        } catch (error) {
          this.say(error.message, true);
        }
        pskl.app.drawingController.overlayFrame.clear();
      },
      true
    );
    stage.addEventListener("pointercancel", () => {
      this.down = null;
      pskl.app.drawingController.overlayFrame.clear();
    });
    [
      "mousedown",
      "mousemove",
      "mouseup",
      "touchstart",
      "touchmove",
      "touchend"
    ].forEach((type) =>
      window.addEventListener(
        type,
        (e) => {
          if (this.active && (stage.contains(e.target) || this.down)) {
            e.stopImmediatePropagation();
            if (e.cancelable) {
              e.preventDefault();
            }
          }
        },
        { capture: true, passive: false }
      )
    );
  };
  p.bindGeometry = function () {
    const handle = this.q(".asset-drag"),
      root = this.root;
    try {
      const s = JSON.parse(localStorage.getItem("asset-library-window"));
      if (s) {
        if (Number.isFinite(s.x) && Number.isFinite(s.y)) {
          root.style.right = "auto";
          root.style.left =
            Math.max(
              0,
              Math.min(innerWidth - Math.min(s.width, innerWidth - 16), s.x)
            ) + "px";
          root.style.top = Math.max(40, Math.min(innerHeight - 80, s.y)) + "px";
        }
        root.style.width =
          Math.max(260, Math.min(innerWidth - 16, s.width)) + "px";
        root.style.height =
          Math.max(220, Math.min(innerHeight - 70, s.height)) + "px";
      }
    } catch (_) {}
    handle.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const rect = root.getBoundingClientRect(),
        start = { x: e.clientX, y: e.clientY };
      handle.setPointerCapture(e.pointerId);
      handle.onpointermove = (event) => {
        root.style.right = "auto";
        root.style.left =
          Math.max(
            0,
            Math.min(innerWidth - rect.width, rect.x + event.clientX - start.x)
          ) + "px";
        root.style.top =
          Math.max(
            40,
            Math.min(innerHeight - 80, rect.y + event.clientY - start.y)
          ) + "px";
      };
      handle.onpointerup = () => {
        handle.onpointermove = null;
        const b = root.getBoundingClientRect();
        try {
          localStorage.setItem(
            "asset-library-window",
            JSON.stringify({ width: b.width, height: b.height, x: b.x, y: b.y })
          );
        } catch (_) {}
      };
    });
    new ResizeObserver(() => {
      if (!root.hidden) {
        const b = root.getBoundingClientRect();
        try {
          localStorage.setItem(
            "asset-library-window",
            JSON.stringify({ width: b.width, height: b.height, x: b.x, y: b.y })
          );
        } catch (_) {}
      }
    }).observe(root);
  };
})();

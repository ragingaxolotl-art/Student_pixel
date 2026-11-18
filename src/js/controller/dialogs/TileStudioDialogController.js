(function () {
  const ns = pskl.controller.dialogs,
    u = pskl.utils,
    U = u.TileStudioUtils;
  ns.TileStudioDialogController = function (controller) {
    this.controller = controller;
  };
  u.inherit(ns.TileStudioDialogController, ns.AbstractDialogController);
  const p = ns.TileStudioDialogController.prototype;
  p.init = function () {
    this.wrapper = document.querySelector(".tile-dialog");
    this.superclass.init.call(this);
    this.canvas = this.wrapper.querySelector(".tile-canvas");
    this.preview = this.wrapper.querySelector(".tile-preview canvas");
    this.status = this.wrapper.querySelector('[role="status"]');
    this.wrapper
      .querySelector(".tile-stagebar")
      .insertBefore(
        this.wrapper.querySelector(".tile-resolution-controls"),
        this.wrapper.querySelector('[data-tile-action="save"]')
      );
    const side = this.wrapper.querySelector(".tile-side");
    side.append(
      this.wrapper.querySelector(".tile-preview"),
      this.wrapper.querySelector(".tile-draw-layers"),
      this.wrapper.querySelector(".tile-palette"),
      this.wrapper.querySelector(".tile-drawing"),
      this.wrapper.querySelector(".tile-properties"),
      this.wrapper.querySelector(".tile-tutorials")
    );

    this.stage = "tiles";
    this.tool = "brush";
    this.turn = 0;
    this.flip = false;
    this.past = [];
    this.future = [];
    this.selected = null;
    this.service = new pskl.service.PuppetStudioService(this.controller);
    try {
      this.config = U.clone(
        U.validate(this.controller.getPiskel().toolState.tileStudio)
      );
    } catch (error) {
      this.config = U.create();
      if (this.controller.getPiskel().toolState.tileStudio) {
        this.say(error.message + " Import a valid backup to recover.");
      }
    }
    this.selected = this.config.tiles[0]?.id;
    this.addEventListener(this.wrapper, "click", function (e) {
      const b = e.target.closest(
        "[data-tile-action],[data-tile-stage],[data-tile-tool],[data-tile-id],[data-layer-select]"
      );
      if (!b) {
        return;
      }
      try {
        if (b.dataset.tileStage) {
          this.finishGesture();
          this.stage = b.dataset.tileStage;
          this.tileClipboard = null;
          this.selection = null;
          this.clipboard = null;
          this.tool = "brush";
          this.applyLayout();
          this.reloadStudioPanels?.();
          this.render();
        } else if (b.dataset.tileTool) {
          this.tool = b.dataset.tileTool;
          this.render();
        } else if (b.dataset.tileId) {
          this.selected = b.dataset.tileId;
          this.clipboard = null;
          this.tileClipboard = null;
          this.selection = null;
          this.render();
        } else if (b.dataset.layerSelect !== undefined) {
          this.config.activeLayer = Number(b.dataset.layerSelect);
          this.selection = null;
          this.render();
        } else {
          this.action(b.dataset.tileAction);
        }
      } catch (error) {
        this.say(error.message);
      }
    });
    this.addEventListener(this.wrapper, "change", this.change);
    this.addEventListener(this.wrapper, "submit", (e) => e.preventDefault());
    this.addEventListener(this.wrapper, "keydown", this.key);
    this.addEventListener(this.canvas, "pointerdown", this.pointerDown);
    this.addEventListener(this.canvas, "pointermove", this.pointerMove);
    this.addEventListener(this.canvas, "pointerup", this.pointerUp);
    this.addEventListener(this.canvas, "pointercancel", this.pointerCancel);
    this.addEventListener(this.canvas, "contextmenu", (e) =>
      e.preventDefault()
    );
    this.addEventListener(
      this.wrapper.querySelector(".tile-image-file"),
      "change",
      this.importImage
    );
    this.addEventListener(
      this.wrapper.querySelector(".tile-json-file"),
      "change",
      this.importJSON
    );
    this.observer = new ResizeObserver(() => this.draw());
    this.observer.observe(this.wrapper.querySelector(".tile-viewport"));
    this.onReset = () => {
      if (this.applying) {
        return;
      }
      const saved = this.controller.getPiskel().toolState.tileStudio;
      this.config = saved ? U.clone(U.validate(saved)) : U.create();
      this.selected = this.config.tiles[0]?.id;
      this.past = [];
      this.future = [];
      this.selection = null;
      this.clipboard = null;
      this.render();
    };
    $.subscribe(Events.PISKEL_RESET, this.onReset);
    this.setupPaintOptions();
    this.setupLayout();
    this.render();
  };
  p.say = function (text) {
    this.status.textContent = text;
  };
  p.field = function (name) {
    return this.wrapper.querySelector('[data-tile-field="' + name + '"]');
  };
  p.tile = function () {
    return this.config.tiles.find((t) => t.id === this.selected);
  };
  p.layer = function () {
    return this.config.layers[this.config.activeLayer];
  };
  p.snapshot = function () {
    return JSON.stringify(this.config);
  };
  p.remember = function (before) {
    if (before === this.snapshot()) {
      return;
    }
    this.past.push(before);
    if (this.past.length > 40) {
      this.past.shift();
    }
    this.future = [];
    this.persist();
  };
  p.edit = function (fn) {
    const before = this.snapshot();
    try {
      fn();
      U.validate(this.config);
      this.remember(before);
    } catch (error) {
      this.config = JSON.parse(before);
      throw error;
    }
    this.render();
  };
  p.persist = function () {
    const out = u.PuppetProjectUtils.cloneProject(this.controller.getPiskel());
    out.toolState.tileStudio = U.clone(this.config);
    this.applying = true;
    try {
      this.service.replaceProject(out);
    } finally {
      this.applying = false;
    }
  };
  p.change = function (e) {
    if (e.target.dataset.tileDrawField) {
      this.changeDrawLayer(e);
      return;
    }
    const f = e.target,
      key = f.dataset.tileField;
    try {
      if (
        f.dataset.layerVisible !== undefined ||
        f.dataset.layerLocked !== undefined
      ) {
        const i = Number(f.dataset.layerVisible ?? f.dataset.layerLocked);
        this.edit(() => {
          this.config.layers[i][
            f.dataset.layerVisible !== undefined ? "visible" : "locked"
          ] = f.checked;
        });
      } else if (f.dataset.layerName !== undefined) {
        this.edit(() => {
          this.config.layers[Number(f.dataset.layerName)].name =
            f.value.slice(0, 80) || "Layer";
        });
      } else if (key === "name" && this.tile()) {
        this.edit(() => {
          this.tile().name = f.value || "Tile";
        });
      } else if (key === "stamp" && f.value !== "") {
        this.clipboard = U.clone(this.config.stamps[Number(f.value)]);
        this.stage = "map";
        this.tool = "brush";
        this.render();
      } else if (key === "palette") {
        this.renderPalette();
      } else if (key === "tutorial") {
        this.tutorial();
      } else {
        this.draw();
      }
    } catch (error) {
      this.say(error.message);
    }
  };
  p.key = function (e) {
    if (e.target.matches("input,select,textarea")) {
      return;
    }
    const mod = e.ctrlKey || e.metaKey,
      key = e.key.toLowerCase();
    if (mod && key === "v") {
      e.preventDefault();
      this.selection = null;
      this.tool = "brush";
      this.render();
      this.say("Click the canvas to paste your copied selection.");
      return;
    }
    if (mod && key === "a") {
      e.preventDefault();
      this.selection = {
        x: 0,
        y: 0,
        width: this.stage === "tiles" ? this.config.size : this.config.width,
        height: this.stage === "tiles" ? this.config.size : this.config.height
      };
      this.draw();
      return;
    }
    if ((mod && key === "d") || key === "escape") {
      e.preventDefault();
      e.stopPropagation();
      this.selection = null;
      this.clipboard = null;
      this.tileClipboard = null;
      this.draw();
      return;
    }
    if (key === "delete" || key === "backspace") {
      e.preventDefault();
      this.selectionAction("clear");
      return;
    }
    if (mod && (key === "z" || key === "y")) {
      e.preventDefault();
      e.stopPropagation();
      this.action(key === "y" || e.shiftKey ? "redo" : "undo");
    } else if (mod && (key === "c" || key === "x")) {
      e.preventDefault();
      this.action(key === "x" ? "cut" : "copy");
    } else if (key === "escape") {
      this.selection = null;
      this.clipboard = null;
      this.tileClipboard = null;
      this.draw();
      e.stopPropagation();
    } else if (
      ["b", "e", "s", "i", "g", "l", "r", "c", "t", "x", "u", "d"].includes(key)
    ) {
      e.preventDefault();
      if (key === "x") {
        this.action("swap");
        return;
      }
      this.tool = {
        b: "brush",
        e: "erase",
        s: "select",
        i: "pick",
        g: "fill",
        l: "line",
        r: "rectangle",
        u: "lighten",
        d: "darken",
        c: "ellipse",
        t: "dither"
      }[key];
      this.render();
    }
  };
  p.action = function (id) {
    if (id === "start") {
      id = "new";
    }
    this.finishGesture();
    if (id.startsWith("tile-layer-")) {
      this.tileLayerAction(id);
      return;
    }
    if (id === "undo" || id === "redo") {
      const from = id === "undo" ? this.past : this.future,
        to = id === "undo" ? this.future : this.past;
      if (!from.length) {
        return;
      }
      to.push(this.snapshot());
      this.config = JSON.parse(from.pop());
      this.selection = null;
      this.clipboard = null;
      this.persist();
      this.render();
      return;
    }
    if (id === "swap") {
      const a = this.field("color").value;
      this.field("color").value = this.field("secondary").value;
      this.field("secondary").value = a;
      this.renderPaintOptions();
      return;
    }
    if (id === "download-project") {
      this.persist();
      const project = this.controller.getPiskel();
      const name = (project.getDescriptor().name || "Student Pixel").replace(
        /[\\/:*?"<>|]/g,
        "-"
      );
      u.FileUtils.downloadAsFile(
        new Blob([u.serialization.Serializer.serialize(project)], {
          type: "application/json"
        }),
        name + ".piskel"
      );
      this.say(
        "Downloaded the whole project: artwork, rigging, tiles, maps and drawing layers."
      );
      return;
    }
    if (id === "save") {
      this.persist();
      this.say(
        "Tile Studio saved in this project. Download .piskel to keep a file."
      );
      return;
    }
    if (id === "image" || id === "import") {
      this.wrapper
        .querySelector(id === "image" ? ".tile-image-file" : ".tile-json-file")
        .click();
      return;
    }
    if (id === "export") {
      u.PuppetExportUtils.json(this.config, "tile-studio");
      return;
    }
    if (id === "map-png" || id === "tiles-png") {
      this.exportPNG(id);
      return;
    }
    if (id === "flip" || id === "rotate") {
      if (id === "flip") {
        this.flip = !this.flip;
      } else {
        this.turn = (this.turn + 1) % 4;
      }
      this.render();
      return;
    }
    if (["copy", "cut", "stamp", "clear", "unique"].includes(id)) {
      this.selectionAction(id);
      return;
    }
    this.edit(() => {
      const c = this.config;
      if (id === "new") {
        this.selected = U.tile(c).id;
        this.stage = "tiles";
        this.selection = null;
        this.tileClipboard = null;
      }
      if (id === "duplicate") {
        if (!this.tile()) {
          throw new Error("Select a tile first.");
        }
        const source = this.tile(),
          copy = U.tile(c, source.pixels, source.name + " copy");
        U.ensureDrawLayers(source);
        copy.drawLayers = U.clone(source.drawLayers);
        copy.activeDrawLayer = source.activeDrawLayer;
        this.selected = copy.id;
        this.selection = null;
        this.tileClipboard = null;
      }
      if (id === "size") {
        this.selection = null;
        this.tileClipboard = null;
        U.resolution(
          c,
          Number(this.field("size").value),
          this.field("resample").value
        );
        this.say(
          "Tile resolution updated to " +
            c.size +
            " × " +
            c.size +
            ". Linked map placements are preserved."
        );
      }
      if (id === "resize") {
        U.resize(
          c,
          Number(this.field("width").value),
          Number(this.field("height").value)
        );
        this.selection = null;
        this.clipboard = null;
      }
      if (id === "artwork") {
        this.sliceArtwork();
      }
      if (id === "add-layer") {
        if (c.layers.length >= 16) {
          throw new Error("A map can hold up to 16 layers.");
        }
        c.layers.push(
          U.layer("Layer " + (c.layers.length + 1), c.width, c.height)
        );
        c.activeLayer = c.layers.length - 1;
      }
      if (id === "delete-layer") {
        if (c.layers.length === 1) {
          throw new Error("Keep at least one map layer.");
        }
        if (this.layer().locked) {
          throw new Error("Unlock this layer before deleting it.");
        }
        c.layers.splice(c.activeLayer, 1);
        c.activeLayer = Math.max(0, c.activeLayer - 1);
        this.selection = null;
      }
      if (id === "layer-up" || id === "layer-down") {
        const at = c.activeLayer,
          next = at + (id === "layer-up" ? 1 : -1);
        if (next >= 0 && next < c.layers.length) {
          [c.layers[at], c.layers[next]] = [c.layers[next], c.layers[at]];
          c.activeLayer = next;
        }
      }
    });
  };
  p.sliceArtwork = function () {
    const c = this.config,
      frame = this.controller.getCurrentFrame(),
      size = c.size;
    let canvas = document.createElement("canvas");
    // Artwork may be rectangular; build its exact dimensions rather than a square tile.
    canvas.width = frame.getWidth();
    canvas.height = frame.getHeight();
    const image = canvas
      .getContext("2d")
      .createImageData(canvas.width, canvas.height);
    frame.getPixels().forEach((v, i) => {
      image.data[i * 4] = v & 255;
      image.data[i * 4 + 1] = (v >>> 8) & 255;
      image.data[i * 4 + 2] = (v >>> 16) & 255;
      image.data[i * 4 + 3] = v >>> 24;
    });
    canvas.getContext("2d").putImageData(image, 0, 0);
    if (this.field("source").value === "selection") {
      const pixels = pskl.app.selectionManager.currentSelection?.pixels.filter(
        (p) => frame.containsPixel(p.col, p.row)
      );
      if (!pixels?.length) {
        throw new Error(
          "Select artwork in the main editor before opening Tile Studio."
        );
      }
      const xs = pixels.map((p) => p.col),
        ys = pixels.map((p) => p.row),
        x = Math.min(...xs),
        y = Math.min(...ys);
      const crop = document.createElement("canvas");
      crop.width = Math.max(...xs) - x + 1;
      crop.height = Math.max(...ys) - y + 1;
      const ctx = crop.getContext("2d");
      pixels.forEach((p) =>
        ctx.drawImage(canvas, p.col, p.row, 1, 1, p.col - x, p.row - y, 1, 1)
      );
      canvas = crop;
    }
    const before = c.tiles.length;
    U.slice(c, canvas);
    this.selected = c.tiles[before]?.id;
    this.say(
      "Added " +
        (c.tiles.length - before) +
        " tiles at " +
        size +
        " × " +
        size +
        ". Source artwork is preserved."
    );
  };
  p.importImage = async function (e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) {
      return;
    }
    let image;
    try {
      image = await createImageBitmap(file);
      if (this.destroyed) {
        return;
      }
      if (image.width * image.height > 4194304) {
        throw new Error("Import an image with up to 4 million pixels.");
      }
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      canvas.getContext("2d").drawImage(image, 0, 0);
      this.edit(() => {
        const at = this.config.tiles.length;
        U.slice(this.config, canvas);
        this.selected = this.config.tiles[at]?.id;
      });
      this.say("PNG sliced into tiles.");
    } catch (error) {
      if (!this.destroyed) {
        this.say(error.message);
      }
    } finally {
      image?.close();
    }
  };
  p.importJSON = async function (e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) {
      return;
    }
    try {
      if (file.size > 24000000) {
        throw new Error("Tile project file is too large.");
      }
      const config = U.clone(U.validate(JSON.parse(await file.text())));
      if (this.destroyed) {
        return;
      }
      this.edit(() => {
        this.config = config;
        this.selected = config.tiles[0]?.id;
        this.selection = null;
        this.clipboard = null;
      });
      this.say(
        "Editable tile project imported. Undo restores the previous map."
      );
    } catch (error) {
      if (!this.destroyed) {
        this.say(error.message);
      }
    }
  };
  p.exportPNG = function (id) {
    let canvas;
    if (id === "map-png") {
      canvas = U.mapCanvas(this.config);
    } else {
      if (!this.config.tiles.length) {
        this.say("Add tiles before exporting a tileset.");
        return;
      }
      const c = this.config,
        cols = Math.min(8, c.tiles.length);
      canvas = document.createElement("canvas");
      canvas.width = cols * c.size;
      canvas.height = Math.ceil(c.tiles.length / cols) * c.size;
      c.tiles.forEach((t, i) =>
        canvas
          .getContext("2d")
          .drawImage(
            U.pixelsCanvas(t.pixels, c.size),
            (i % cols) * c.size,
            Math.floor(i / cols) * c.size
          )
      );
    }
    canvas.toBlob((blob) => {
      if (blob) {
        u.FileUtils.downloadAsFile(
          blob,
          id === "map-png" ? "tile-map.png" : "tileset.png"
        );
      }
    });
  };
  p.selectionAction = function (id) {
    const c = this.config,
      s = this.selection;
    if (this.stage !== "map" || !s) {
      this.say("In Map, use Select and drag a rectangle first.");
      return;
    }
    if (["cut", "clear", "unique"].includes(id) && this.layer().locked) {
      this.say("Unlock the selected map layer first.");
      return;
    }
    const cells = [];
    for (let y = 0; y < s.height; y++) {
      for (let x = 0; x < s.width; x++) {
        cells.push(U.clone(this.layer().cells[(s.y + y) * c.width + s.x + x]));
      }
    }
    const stamp = {
      name: "Stamp " + (c.stamps.length + 1),
      width: s.width,
      height: s.height,
      cells
    };
    if (id === "copy") {
      this.clipboard = stamp;
      this.tool = "brush";
      this.say("Click the map to paste. Escape ends pasting.");
      this.render();
      return;
    }
    this.edit(() => {
      if (id === "stamp") {
        if (c.stamps.length >= 128) {
          throw new Error("A project can hold up to 128 stamps.");
        }
        c.stamps.push(stamp);
        this.clipboard = U.clone(stamp);
        this.tool = "brush";
      } else if (id === "unique") {
        const copies = {};
        for (let y = 0; y < s.height; y++) {
          for (let x = 0; x < s.width; x++) {
            const cell = this.layer().cells[(s.y + y) * c.width + s.x + x];
            if (cell) {
              if (!copies[cell.tile]) {
                const t = c.tiles.find((t) => t.id === cell.tile);
                copies[cell.tile] = U.tile(c, t.pixels, t.name + " unique").id;
              }
              cell.tile = copies[cell.tile];
              this.selected = cell.tile;
            }
          }
        }
        this.say("Selection now uses independent tile copies.");
      } else {
        for (let y = 0; y < s.height; y++) {
          for (let x = 0; x < s.width; x++) {
            this.layer().cells[(s.y + y) * c.width + s.x + x] = null;
          }
        }
        if (id === "cut") {
          this.clipboard = stamp;
          this.tool = "brush";
          this.say("Click to place the cut section. Undo restores its source.");
        }
      }
    });
  };
  p.render = function () {
    const c = this.config;
    if (!this.tile()) {
      this.selected = c.tiles[0]?.id;
    }
    this.wrapper
      .querySelectorAll("[data-tile-stage]")
      .forEach((b) =>
        b.setAttribute("aria-pressed", b.dataset.tileStage === this.stage)
      );
    this.wrapper
      .querySelectorAll('[data-tile-action="undo"],[data-tile-action="redo"]')
      .forEach((b) => {
        b.disabled = !(
          b.dataset.tileAction === "undo" ? this.past : this.future
        ).length;
      });
    const tools = [
      ["brush", "Brush · B"],
      ["dither", "Dither · T"],
      ["lighten", "Lighten · U"],
      ["darken", "Darken · D"],
      ["erase", "Erase · E"],
      ["fill", "Fill · G"],
      ["line", "Line · L"],
      ["rectangle", "Rectangle · R"],
      ["ellipse", "Circle / ellipse · C"],
      ["select", "Select · S"],
      ["pick", "Pick · I"]
    ];
    const list = this.wrapper.querySelector(".tile-tool-list");
    list.replaceChildren();
    tools.forEach(([id, name]) => {
      if (
        this.stage === "map" &&
        ["dither", "lighten", "darken"].includes(id)
      ) {
        return;
      }
      const b = document.createElement("button");
      b.type = "button";
      b.className = "tile-tool-button";
      b.title = name;
      b.setAttribute("aria-label", name);
      const icons = {
        brush: "pen",
        dither: "dithering",
        lighten: "lighten",
        darken: "lighten",
        erase: "eraser",
        fill: "paint-bucket",
        line: "stroke",
        rectangle: "rectangle",
        ellipse: "circle",
        select: "rectangle-select",
        pick: "colorpicker"
      };
      const icon = document.createElement("span");
      icon.className = "tile-tool-icon icon-tool-" + icons[id];
      icon.setAttribute("aria-hidden", "true");
      b.append(icon);
      if (id === "lighten" || id === "darken") {
        const badge = document.createElement("span");
        badge.className = "tile-shade-badge";
        badge.textContent = id === "lighten" ? "+" : "−";
        badge.setAttribute("aria-hidden", "true");
        b.append(badge);
      }
      b.dataset.tileTool = id;
      b.setAttribute("aria-pressed", this.tool === id);
      list.append(b);
    });
    this.field("name").value = this.tile()?.name || "";
    this.field("name").disabled = !this.tile();
    this.field("width").value = c.width;
    this.field("height").value = c.height;
    this.field("size").value = c.size;
    this.field("wrap").closest("label").hidden = this.stage !== "tiles";
    this.field("color").closest("label").hidden = this.stage !== "tiles";
    this.wrapper.querySelector(".tile-map-controls").hidden =
      this.stage !== "map";
    this.wrapper.querySelector("[data-tile-transform]").textContent =
      (this.flip ? "Flipped · " : "") + this.turn * 90 + "°";
    const tiles = this.wrapper.querySelector(".tile-tile-list");
    tiles.replaceChildren();
    c.tiles.forEach((t) => {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.tileId = t.id;
      b.title = t.name;
      b.setAttribute("aria-label", t.name);
      b.setAttribute("aria-pressed", t.id === this.selected && !this.clipboard);
      b.append(U.pixelsCanvas(t.pixels, c.size));
      tiles.append(b);
    });
    if (!c.tiles.length) {
      const note = document.createElement("p");
      note.textContent = "Add a tile, slice your artwork, or import a PNG.";
      tiles.append(note);
    }
    const layers = this.wrapper.querySelector(".tile-layer-list");
    layers.replaceChildren();
    c.layers.forEach((l, i) => {
      const row = document.createElement("div"),
        b = document.createElement("button");
      b.type = "button";
      b.textContent = l.name;
      b.dataset.layerSelect = i;
      b.setAttribute("aria-pressed", i === c.activeLayer);
      row.append(b);
      [
        ["Visible", "layerVisible", l.visible],
        ["Locked", "layerLocked", l.locked]
      ].forEach(([label, key, checked]) => {
        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = checked;
        input.dataset[key] = i;
        input.setAttribute("aria-label", label + " " + l.name);
        row.append(input);
      });
      const rename = document.createElement("input");
      rename.type = "text";
      rename.value = l.name;
      rename.maxLength = 80;
      rename.dataset.layerName = i;
      rename.setAttribute("aria-label", "Rename " + l.name);
      const group = document.createElement("div");
      group.style.display = "block";
      group.append(row, rename);
      layers.prepend(group);
    });
    const stamps = this.field("stamp");
    stamps.replaceChildren(new Option("Choose a stamp", ""));
    c.stamps.forEach((s, i) => stamps.add(new Option(s.name, i)));
    this.wrapper.querySelector("[data-tile-canvas-heading]").textContent =
      this.stage === "tiles"
        ? "Tile canvas · " + (this.tile()?.name || "No tile selected")
        : "Map canvas · " + c.width + " × " + c.height;
    this.wrapper.querySelector("[data-tile-preview-heading]").textContent =
      this.stage === "tiles" ? "Seam preview · 3 × 3" : "Whole map preview";
    this.wrapper.querySelector(".tile-hint").textContent =
      this.stage === "tiles"
        ? "Draw here; the preview repeats your tile. Changes update every map placement."
        : "Paint on the selected layer. Select a region to copy, move or save a stamp. Scroll to explore at higher zoom.";
    this.renderPaintOptions();
    this.tutorial();
    this.draw();
  };
  p.tutorial = function () {
    this.wrapper.querySelector(".tile-tutorial-text").textContent = {
      seam: "1. Choose a tile size, then + Tile. 2. Draw with Brush; Wrap edges joins strokes across borders. 3. Check the 3 × 3 preview for seams. 4. Switch to Map and paint with your tile.",
      world:
        "1. Draw tiles or slice artwork from the current frame. 2. Switch to Map. 3. Paint Ground, then add a Details layer. 4. Use Fill and Rectangle for larger areas. 5. Export Map PNG or download your .piskel project.",
      stamp:
        "1. In Map, paint a tree or building. 2. Choose Select and drag around it. 3. Save stamp. 4. Click to place copies. Select a tile thumbnail or press Escape to leave stamp painting."
    }[this.field("tutorial").value];
  };
  p.setupLayout = function () {
    this.wrapper.querySelectorAll("[data-tile-panel]").forEach((el) => {
      const h = el.querySelector("h4"),
        b = document.createElement("button");
      b.type = "button";
      b.className = "tile-panel-collapse";
      b.textContent = "⌃";
      b.setAttribute(
        "aria-label",
        "Collapse " + el.dataset.tilePanel + " panel"
      );
      b.setAttribute("aria-expanded", "true");
      h.append(b);
      this.addEventListener(b, "click", () => {
        const collapsed = el.dataset.collapsed !== "true";
        el.dataset.collapsed = collapsed;
        b.textContent = collapsed ? "⌄" : "⌃";
        b.setAttribute("aria-expanded", !collapsed);
        this.saveLayout();
        this.draw();
      });
    });
    this.layoutObserver = new ResizeObserver(() => this.saveLayout());
    this.wrapper
      .querySelectorAll("[data-tile-panel]")
      .forEach((el) => this.layoutObserver.observe(el));
    this.applyLayout();
  };
  p.layoutKey = function () {
    return "tile-studio-layout-" + this.stage;
  };
  p.saveLayout = function () {
    if (this.loadingLayout) {
      return;
    }
    const data = {};
    this.wrapper.querySelectorAll("[data-tile-panel]").forEach((el) => {
      data[el.dataset.tilePanel] = {
        collapsed: el.dataset.collapsed === "true"
      };
    });
    try {
      localStorage.setItem(this.layoutKey(), JSON.stringify(data));
    } catch (_) {}
  };
  p.applyLayout = function () {
    this.loadingLayout = true;
    let data = {};
    try {
      data = JSON.parse(localStorage.getItem(this.layoutKey())) || {};
    } catch (_) {}
    this.wrapper.querySelectorAll("[data-tile-panel]").forEach((el) => {
      const saved = data[el.dataset.tilePanel];
      // Shared panel manager owns floating placement. Stage-specific collapse state is independent.
      el.dataset.collapsed = !!saved?.collapsed;
      const b = el.querySelector(".tile-panel-collapse");
      if (b) {
        b.textContent = saved?.collapsed ? "⌄" : "⌃";
        b.setAttribute("aria-expanded", !saved?.collapsed);
      }
    });
    this.loadingLayout = false;
  };
  p.destroy = function () {
    this.finishGesture();
    this.saveLayout();
    this.destroyed = true;
    this.observer.disconnect();
    this.layoutObserver.disconnect();
    $.unsubscribe(Events.PISKEL_RESET, this.onReset);
    this.superclass.destroy.call(this);
  };
})();

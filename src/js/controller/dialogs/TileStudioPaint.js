(function () {
  const p = pskl.controller.dialogs.TileStudioDialogController.prototype,
    u = pskl.utils;
  p.setupPaintOptions = function () {
    const fields = [
      "color",
      "secondary",
      "brush-size",
      "opacity",
      "shape-mode",
      "outline-width",
      "dither",
      "pattern",
      "dither-mode",
      "density",
      "pattern-scale",
      "palette"
    ];
    u.DitherPatterns.list().forEach((v) =>
      this.field("pattern").add(new Option(v.label, v.id))
    );
    let palettes = [];
    try {
      palettes = pskl.app.paletteService.getPalettes();
    } catch (_) {}
    this.tilePalettes = palettes;
    this.field("palette").add(new Option("Tile colors", "tile-colors"));
    this.field("palette").add(new Option("Starter colors", "starter"));
    palettes.forEach((v) =>
      this.field("palette").add(new Option(v.name, v.id))
    );
    this.field("palette").value = "starter";
    const primary =
      u.colorToInt(pskl.app.selectedColorsService.getPrimaryColor()) >>> 0;
    if (primary >>> 24) {
      this.field("color").value = this.colorHex(primary);
    }
    try {
      const saved =
        JSON.parse(localStorage.getItem("tile-studio-paint-options")) || {};
      fields.forEach((key) => {
        if (saved[key] === undefined) {
          return;
        }
        const field = this.field(key);
        if (field.type === "checkbox") {
          field.checked = saved[key] === true;
        } else {
          field.value = String(saved[key]);
        }
      });
    } catch (_) {}
    this.addEventListener(this.wrapper, "input", (e) => {
      if (fields.includes(e.target.dataset.tileField)) {
        this.wrapper.querySelector("[data-tile-opacity]").textContent =
          this.field("opacity").value + "%";
      }
    });
    this.addEventListener(this.wrapper, "change", (e) => {
      if (!fields.includes(e.target.dataset.tileField)) {
        return;
      }
      const saved = {};
      fields.forEach((key) => {
        const f = this.field(key);
        saved[key] = f.type === "checkbox" ? f.checked : f.value;
      });
      try {
        localStorage.setItem(
          "tile-studio-paint-options",
          JSON.stringify(saved)
        );
      } catch (_) {}
    });
  };
  p.colorHex = function (value) {
    return (
      "#" +
      [value & 255, (value >>> 8) & 255, (value >>> 16) & 255]
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("")
    );
  };
  p.renderPaintOptions = function () {
    this.wrapper.querySelector(".tile-paint-options").hidden =
      this.stage !== "tiles";
    this.wrapper.querySelector(".tile-drawing").hidden = false;
    this.wrapper.querySelector(".tile-palette").hidden = this.stage !== "tiles";
    this.wrapper.querySelector(".tile-start").hidden =
      this.stage !== "tiles" || !!this.tile();
    this.wrapper.querySelector("[data-tile-opacity]").textContent =
      this.field("opacity").value + "%";
    this.renderPalette();
    this.renderDrawLayers();
  };
  p.renderPalette = function () {
    const choice = this.field("palette").value;
    let colors = [];
    if (choice === "tile-colors") {
      this.config.tiles.forEach((t) =>
        t.pixels.forEach((v) => {
          if (v >>> 24) {
            colors.push(this.colorHex(v));
          }
        })
      );
      colors = [...new Set(colors)].slice(0, 256);
    } else if (choice === "starter") {
      colors = [
        "#000000",
        "#ffffff",
        "#40364d",
        "#695572",
        "#b28ea7",
        "#eac4d5",
        "#a83246",
        "#e75d50",
        "#ffb55a",
        "#f8e989",
        "#499b55",
        "#87cc75",
        "#266b79",
        "#4ba9b5",
        "#4264aa",
        "#93b9ed"
      ];
    } else {
      colors =
        this.tilePalettes.find((v) => v.id === choice)?.getColors() || [];
    }
    const root = this.wrapper.querySelector(".tile-swatches");
    root.replaceChildren();
    [...new Set(colors)].slice(0, 256).forEach((color) => {
      const value = u.colorToInt(color) >>> 0;
      if (!(value >>> 24)) {
        return;
      }
      const hex = this.colorHex(value),
        b = document.createElement("button");
      b.type = "button";
      b.title = hex;
      b.style.background = hex;
      b.setAttribute("aria-label", "Tile palette color " + hex);
      b.onclick = () => {
        this.field("color").value = hex;
      };
      b.oncontextmenu = (e) => {
        e.preventDefault();
        this.field("secondary").value = hex;
      };
      root.append(b);
    });
    if (!root.children.length) {
      root.textContent =
        "No colors yet. Draw a tile or select another palette.";
    }
  };
  const paintMap = p.paintAt;
  p.paintAt = function (x, y, erase, raw, color) {
    if (this.stage === "map") {
      paintMap.call(this, x, y, erase);
      return;
    }
    if (!this.tile()) {
      return;
    }
    const layer = u.TileStudioUtils.ensureDrawLayers(this.tile());
    if (layer.locked) {
      this.say("Unlock the selected tile drawing layer before painting.");
      return;
    }
    if (!layer.visible) {
      this.say("Show the selected tile drawing layer before painting.");
      return;
    }
    if (this.tileClipboard && this.tool === "brush" && !raw && !erase) {
      const clip = this.tileClipboard;
      clip.pixels.forEach((v, i) => {
        if (v >>> 24) {
          this.paintAt(
            x + (i % clip.width),
            y + Math.floor(i / clip.width),
            false,
            true,
            v
          );
        }
      });
      return;
    }
    const width = raw
      ? 1
      : Math.max(1, Math.min(32, Number(this.field("brush-size").value) || 1));
    const points = raw ? [[x, y]] : pskl.PixelUtils.resizePixel(x, y, width);
    const settings = u.DitherPatterns.normalize({
      pattern: this.field("pattern").value,
      mode: this.field("dither-mode").value,
      density: Number(this.field("density").value),
      scale: Number(this.field("pattern-scale").value),
      coverage: 50
    });
    const dither = this.tool === "dither" || this.field("dither").checked,
      size = this.config.size;
    const opacity = Math.max(
      0,
      Math.min(100, Number(this.field("opacity").value))
    );
    points.forEach(([px, py]) => {
      if (this.field("wrap").checked) {
        px = ((px % size) + size) % size;
        py = ((py % size) + size) % size;
      }
      if (px < 0 || py < 0 || px >= size || py >= size) {
        return;
      }
      const selection = this.selection;
      if (
        selection &&
        (px < selection.x ||
          py < selection.y ||
          px >= selection.x + selection.width ||
          py >= selection.y + selection.height)
      ) {
        return;
      }
      const at = py * size + px;
      if (this.gesture?.painted.has(at)) {
        return;
      }
      this.gesture?.painted.add(at);
      const base = layer.pixels[at];
      if (erase) {
        const alpha = Math.round((base >>> 24) * (1 - opacity / 100));
        layer.pixels[at] = alpha
          ? ((base & 0xffffff) | (alpha << 24)) >>> 0
          : 0;
        return;
      }
      if (this.tool === "lighten" || this.tool === "darken") {
        if (!(base >>> 24)) {
          return;
        }
        const ink = window.tinycolor[
          this.tool === "lighten" ? "lighten" : "darken"
        ](u.intToColor(base), 10).toHexString();
        const rgb = u.colorToInt(ink) >>> 0;
        let mixed = base & 0xff000000;
        [0, 8, 16].forEach((shift) => {
          const v = Math.round(
            ((base >>> shift) & 255) * (1 - opacity / 100) +
              (((rgb >>> shift) & 255) * opacity) / 100
          );
          mixed |= v << shift;
        });
        layer.pixels[at] = mixed >>> 0;
        return;
      }
      const chosen = dither
        ? u.DitherPatterns.sample(px, py, settings)
          ? this.field("color").value
          : this.field("secondary").value
        : color === undefined
          ? this.field("color").value
          : color;
      layer.pixels[at] = u.PuppetColorUtils.over(
        base,
        u.DitherPaintUtils.opacity(u.colorToInt(chosen) >>> 0, opacity)
      );
    });
    u.TileStudioUtils.flatten(this.tile());
  };
  p.applyShape = function () {
    const g = this.gesture;
    if (!g) {
      return;
    }
    const a = g.start,
      b = g.last;
    this.config = JSON.parse(g.before);
    g.painted.clear();
    if (this.tool === "line") {
      u.TileStudioUtils.line(a, b, (x, y) => this.paintAt(x, y, g.erase));
      return;
    }
    const proto =
      pskl.tools.drawing[this.tool === "ellipse" ? "Circle" : "Rectangle"]
        .prototype;
    const shape = Object.create(proto);
    shape.startCol = a.x;
    shape.startRow = a.y;
    const size = this.stage === "map" ? this.config.width : this.config.size,
      height = this.stage === "map" ? this.config.height : this.config.size;
    const points = new Map(),
      primary = this.field("color").value,
      secondary = this.field("secondary").value;
    const mode = this.field("shape-mode").value;
    shape.draw(
      b.x,
      b.y,
      primary,
      {
        getWidth: () => size,
        getHeight: () => height,
        setPixel: (x, y, v) => {
          if (x >= 0 && y >= 0 && x < size && y < height) {
            points.set(y * size + x, [x, y, v]);
          }
        }
      },
      Math.max(1, Math.min(16, Number(this.field("outline-width").value) || 1)),
      { mode, fillColor: mode === "filled" ? secondary : primary }
    );
    points.forEach(([x, y, v]) => this.paintAt(x, y, g.erase, true, v));
  };
})();

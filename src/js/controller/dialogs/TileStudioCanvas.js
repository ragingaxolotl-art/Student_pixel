(function () {
  const p = pskl.controller.dialogs.TileStudioDialogController.prototype,
    U = pskl.utils.TileStudioUtils;
  p.draw = function () {
    if (!this.canvas || this.destroyed) {
      return;
    }
    const c = this.config,
      tile = this.tile(),
      map = this.stage === "map";
    const w = map ? c.width * c.size : c.size,
      h = map ? c.height * c.size : c.size;
    const viewport = this.wrapper.querySelector(".tile-viewport"),
      zoom = this.field("zoom").value;
    const requestedScale =
      zoom === "fit"
        ? Math.max(
            0.1,
            Math.min(
              (viewport.clientWidth - 16) / w,
              (viewport.clientHeight - 16) / h,
              24
            )
          )
        : Number(zoom);
    const scale = Math.min(requestedScale, 4096 / w, 4096 / h);
    // Render the editing surface at screen resolution so the grid remains visible at fit zoom.
    this.scale = scale;
    this.unit = map ? c.size : 1;
    this.canvas.width = Math.max(1, Math.round(w * scale));
    this.canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = this.canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    const image = map
      ? U.mapCanvas(c)
      : tile
        ? U.pixelsCanvas(tile.pixels, c.size)
        : null;
    if (image) {
      ctx.drawImage(image, 0, 0, this.canvas.width, this.canvas.height);
    }
    const cell = this.unit * scale,
      cols = map ? c.width : c.size,
      rows = map ? c.height : c.size;
    if (this.field("grid").checked && cell >= 4) {
      ctx.strokeStyle = "rgba(170,170,170,.28)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= cols; x++) {
        ctx.moveTo(Math.round(x * cell) + 0.5, 0);
        ctx.lineTo(Math.round(x * cell) + 0.5, this.canvas.height);
      }
      for (let y = 0; y <= rows; y++) {
        ctx.moveTo(0, Math.round(y * cell) + 0.5);
        ctx.lineTo(this.canvas.width, Math.round(y * cell) + 0.5);
      }
      ctx.stroke();
    }
    if (this.selection) {
      const s = this.selection;
      ctx.strokeStyle = "#ffe36c";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        s.x * cell + 1,
        s.y * cell + 1,
        s.width * cell - 2,
        s.height * cell - 2
      );
    }
    if (
      this.hover &&
      map &&
      ["brush", "erase", "rectangle", "line"].includes(this.tool)
    ) {
      const x = this.hover.x,
        y = this.hover.y;
      if (this.clipboard && this.tool === "brush") {
        ctx.globalAlpha = 0.55;
        this.clipboard.cells.forEach((v, i) => {
          const t = v && c.tiles.find((t) => t.id === v.tile),
            px = x + (i % this.clipboard.width),
            py = y + Math.floor(i / this.clipboard.width);
          if (t && px < c.width && py < c.height) {
            U.drawCell(
              ctx,
              U.pixelsCanvas(t.pixels, c.size),
              v,
              px * cell,
              py * cell,
              cell
            );
          }
        });
        ctx.globalAlpha = 1;
      } else if (tile && this.tool === "brush") {
        ctx.globalAlpha = 0.55;
        U.drawCell(
          ctx,
          U.pixelsCanvas(tile.pixels, c.size),
          this.brushValue(),
          x * cell,
          y * cell,
          cell
        );
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = "#ffe36c";
      ctx.lineWidth = 2;
      ctx.strokeRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
    }
    if (this.gesture && ["line", "rectangle", "ellipse"].includes(this.tool)) {
      const a = this.gesture.start,
        b = this.gesture.last;
      ctx.strokeStyle = "#ffe36c";
      ctx.lineWidth = 2;
      if (this.tool === "ellipse") {
        ctx.beginPath();
        ctx.ellipse(
          ((a.x + b.x + 1) * cell) / 2,
          ((a.y + b.y + 1) * cell) / 2,
          ((Math.abs(a.x - b.x) + 1) * cell) / 2,
          ((Math.abs(a.y - b.y) + 1) * cell) / 2,
          0,
          0,
          Math.PI * 2
        );
        ctx.stroke();
      } else if (this.tool === "rectangle") {
        ctx.strokeRect(
          Math.min(a.x, b.x) * cell,
          Math.min(a.y, b.y) * cell,
          (Math.abs(a.x - b.x) + 1) * cell,
          (Math.abs(a.y - b.y) + 1) * cell
        );
      } else {
        ctx.beginPath();
        ctx.moveTo((a.x + 0.5) * cell, (a.y + 0.5) * cell);
        ctx.lineTo((b.x + 0.5) * cell, (b.y + 0.5) * cell);
        ctx.stroke();
      }
    }
    const preview = this.preview;
    this.field("repeats").closest("label").hidden = map;
    if (map) {
      const factor = Math.min(240 / w, 140 / h, 1);
      preview.width = Math.max(1, Math.round(w * factor));
      preview.height = Math.max(1, Math.round(h * factor));
      const pc = preview.getContext("2d");
      pc.imageSmoothingEnabled = false;
      pc.drawImage(image, 0, 0, preview.width, preview.height);
    } else {
      const repeats = Math.max(
        1,
        Math.min(9, Math.round(Number(this.field("repeats").value) || 3))
      );
      this.wrapper.querySelector("[data-tile-preview-heading]").textContent =
        "Seam preview · " + repeats + " × " + repeats;
      preview.width = c.size * repeats;
      preview.height = c.size * repeats;
      preview.style.width = "144px";
      const pc = preview.getContext("2d");
      if (image) {
        for (let y = 0; y < repeats; y++) {
          for (let x = 0; x < repeats; x++) {
            pc.drawImage(image, x * c.size, y * c.size);
          }
        }
      }
    }
    if (map) {
      preview.style.width = "";
    }
  };
  p.point = function (e, clamp) {
    const b = this.canvas.getBoundingClientRect(),
      c = this.config,
      map = this.stage === "map";
    let x = Math.floor(
        ((e.clientX - b.left) / b.width) * (map ? c.width : c.size)
      ),
      y = Math.floor(
        ((e.clientY - b.top) / b.height) * (map ? c.height : c.size)
      );
    const w = map ? c.width : c.size,
      h = map ? c.height : c.size;
    if (clamp) {
      x = Math.max(0, Math.min(w - 1, x));
      y = Math.max(0, Math.min(h - 1, y));
    }
    return { x, y };
  };
  p.brushValue = function () {
    return this.stage === "tiles"
      ? pskl.utils.colorToInt(this.field("color").value) >>> 0
      : this.tile()
        ? { tile: this.selected, turn: this.turn, flip: this.flip }
        : null;
  };
  p.paintAt = function (x, y, erase) {
    const c = this.config,
      map = this.stage === "map",
      w = map ? c.width : c.size,
      h = map ? c.height : c.size;
    if (!map && this.field("wrap").checked) {
      x = ((x % w) + w) % w;
      y = ((y % h) + h) % h;
    }
    if (x < 0 || y < 0 || x >= w || y >= h) {
      return;
    }
    if (map && this.clipboard && !erase) {
      this.clipboard.cells.forEach((v, i) => {
        const px = x + (i % this.clipboard.width),
          py = y + Math.floor(i / this.clipboard.width);
        if (px < w && py < h && v) {
          this.layer().cells[py * w + px] = U.clone(v);
        }
      });
    } else {
      const values = map ? this.layer().cells : this.tile().pixels;
      values[y * w + x] = erase ? (map ? null : 0) : U.clone(this.brushValue());
    }
  };
  p.pointerDown = function (e) {
    if (e.button !== 0 && e.button !== 2) {
      return;
    }
    e.preventDefault();
    this.canvas.focus();
    const point = this.point(e, true),
      c = this.config,
      map = this.stage === "map";
    if (this.tool === "pick") {
      if (map) {
        const cell = this.layer().cells[point.y * c.width + point.x];
        if (cell) {
          this.selected = cell.tile;
          this.turn = cell.turn;
          this.flip = cell.flip;
          this.clipboard = null;
        }
      } else if (this.tile()) {
        const v = this.tile().pixels[point.y * c.size + point.x];
        this.field("color").value =
          "#" +
          [v & 255, (v >>> 8) & 255, (v >>> 16) & 255]
            .map((n) => n.toString(16).padStart(2, "0"))
            .join("");
      }
      this.render();
      return;
    }
    if (map && this.layer().locked && this.tool !== "select") {
      this.say("Unlock the selected map layer before painting.");
      return;
    }
    if (!map && !this.tile()) {
      this.say("Add a tile or slice artwork to start drawing.");
      return;
    }
    if (
      map &&
      !this.tile() &&
      !this.clipboard &&
      this.tool !== "select" &&
      this.tool !== "erase"
    ) {
      this.say("Add a tile before painting the map.");
      return;
    }
    this.gesture = {
      before: this.snapshot(),
      start: point,
      last: point,
      painted: new Set(),
      erase: e.button === 2 || this.tool === "erase"
    };
    this.canvas.setPointerCapture(e.pointerId);
    if (this.tool === "select") {
      this.selection = { x: point.x, y: point.y, width: 1, height: 1 };
    } else if (this.tool === "fill") {
      const values = map ? this.layer().cells : this.tile().pixels,
        w = map ? c.width : c.size,
        h = map ? c.height : c.size;
      if (!map) {
        const mask = values.slice();
        U.fill(mask, w, h, point.x, point.y, -1);
        mask.forEach((v, i) => {
          if (v === -1) {
            this.paintAt(i % w, Math.floor(i / w), this.gesture.erase, true);
          }
        });
      } else {
        U.fill(
          values,
          w,
          h,
          point.x,
          point.y,
          this.gesture.erase ? (map ? null : 0) : this.brushValue()
        );
      }
    } else if (
      this.tool === "brush" ||
      this.tool === "erase" ||
      this.tool === "dither" ||
      this.tool === "lighten" ||
      this.tool === "darken"
    ) {
      this.paintAt(point.x, point.y, this.gesture.erase);
    }
    this.draw();
  };
  p.pointerMove = function (e) {
    const point = this.point(
      e,
      !!this.gesture &&
        !(
          this.stage === "tiles" &&
          this.field("wrap").checked &&
          ["brush", "erase", "dither", "lighten", "darken"].includes(this.tool)
        )
    );
    this.hover = point;
    if (!this.gesture) {
      this.draw();
      return;
    }
    const g = this.gesture;
    if (e.shiftKey && ["rectangle", "ellipse"].includes(this.tool)) {
      const length = Math.min(
        Math.max(Math.abs(point.x - g.start.x), Math.abs(point.y - g.start.y)),
        this.stage === "tiles"
          ? this.config.size - 1
          : Math.min(this.config.width, this.config.height) - 1
      );
      point.x = g.start.x + (point.x < g.start.x ? -length : length);
      point.y = g.start.y + (point.y < g.start.y ? -length : length);
      const w = this.stage === "tiles" ? this.config.size : this.config.width,
        h = this.stage === "tiles" ? this.config.size : this.config.height;
      const span = Math.min(
        Math.abs(point.x - g.start.x),
        point.x < g.start.x ? g.start.x : w - 1 - g.start.x,
        point.y < g.start.y ? g.start.y : h - 1 - g.start.y
      );
      point.x = g.start.x + (point.x < g.start.x ? -span : span);
      point.y = g.start.y + (point.y < g.start.y ? -span : span);
    }
    if (this.tool === "select") {
      this.selection = {
        x: Math.min(g.start.x, point.x),
        y: Math.min(g.start.y, point.y),
        width: Math.abs(g.start.x - point.x) + 1,
        height: Math.abs(g.start.y - point.y) + 1
      };
    } else if (
      this.tool === "brush" ||
      this.tool === "erase" ||
      this.tool === "dither" ||
      this.tool === "lighten" ||
      this.tool === "darken"
    ) {
      U.line(g.last, point, (x, y) => this.paintAt(x, y, g.erase));
    }
    g.last = point;
    if (["rectangle", "ellipse", "line"].includes(this.tool)) {
      this.applyShape();
    }
    this.draw();
  };
  p.pointerUp = function (e) {
    if (!this.gesture) {
      return;
    }
    this.pointerMove(e);
    this.finishGesture();
  };
  p.finishGesture = function () {
    if (!this.gesture) {
      return;
    }
    const before = this.gesture.before;
    this.gesture = null;
    this.remember(before);
    this.render();
  };
  p.pointerCancel = function () {
    if (this.gesture) {
      this.config = JSON.parse(this.gesture.before);
      this.gesture = null;
      this.render();
    }
  };
})();

(function () {
  const p = pskl.controller.dialogs.TileStudioDialogController.prototype,
    U = pskl.utils.TileStudioUtils;
  p.renderDrawLayers = function () {
    const tile = this.tile(),
      root = this.wrapper.querySelector(".tile-draw-layer-list");
    root.replaceChildren();
    this.wrapper.querySelector(".tile-draw-layers").hidden =
      this.stage !== "tiles";
    this.wrapper.querySelector(".tile-layers").hidden = this.stage === "tiles";
    if (!tile) {
      root.textContent = "Create a tile to use its four drawing layers.";
      return;
    }
    U.ensureDrawLayers(tile);
    tile.drawLayers.forEach((l, i) => {
      const group = document.createElement("div"),
        row = document.createElement("div");
      row.className = "tile-row";
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = l.name;
      b.dataset.tileAction = "tile-layer-select-" + i;
      b.setAttribute("aria-pressed", i === tile.activeDrawLayer);
      b.setAttribute("aria-label", "Select tile layer " + l.name);
      row.append(b);
      [
        ["visible", "Show"],
        ["locked", "Lock"]
      ].forEach(([key, text]) => {
        const label = document.createElement("label"),
          input = document.createElement("input");
        input.type = "checkbox";
        input.checked = l[key];
        input.dataset.tileDrawField = key;
        input.dataset.tileDrawIndex = i;
        input.setAttribute("aria-label", text + " tile layer " + l.name);
        label.append(input, document.createTextNode(text));
        row.append(label);
      });
      const name = document.createElement("input");
      name.value = l.name;
      name.maxLength = 80;
      name.dataset.tileDrawField = "name";
      name.dataset.tileDrawIndex = i;
      name.setAttribute("aria-label", "Rename tile layer " + l.name);
      group.append(row, name);
      root.prepend(group);
    });
  };
  p.changeDrawLayer = function (e) {
    const index = Number(e.target.dataset.tileDrawIndex),
      key = e.target.dataset.tileDrawField;
    try {
      this.edit(() => {
        const layer = this.tile().drawLayers[index];
        layer[key] =
          key === "name" ? e.target.value || "Layer" : e.target.checked;
        U.flatten(this.tile());
      });
    } catch (error) {
      this.say(error.message);
    }
  };
  p.tileLayerAction = function (id) {
    const t = this.tile();
    if (!t) {
      this.say("Create a tile first.");
      return;
    }
    U.ensureDrawLayers(t);
    if (id.startsWith("tile-layer-select-")) {
      t.activeDrawLayer = Number(id.split("-").pop());
      this.selection = null;
      this.render();
      return;
    }
    this.edit(() => {
      if (id === "tile-layer-add") {
        if (t.drawLayers.length >= 16) {
          throw new Error("A tile supports up to 16 drawing layers.");
        }
        t.drawLayers.push({
          name: "Layer " + (t.drawLayers.length + 1),
          visible: true,
          locked: false,
          pixels: Array(this.config.size * this.config.size).fill(0)
        });
        t.activeDrawLayer = t.drawLayers.length - 1;
      } else if (id === "tile-layer-delete") {
        if (t.drawLayers.length === 1) {
          throw new Error("Keep at least one drawing layer.");
        }
        if (t.drawLayers[t.activeDrawLayer].locked) {
          throw new Error("Unlock this layer first.");
        }
        t.drawLayers.splice(t.activeDrawLayer, 1);
        t.activeDrawLayer = Math.max(0, t.activeDrawLayer - 1);
      } else {
        const a = t.activeDrawLayer,
          b = a + (id === "tile-layer-up" ? 1 : -1);
        if (b >= 0 && b < t.drawLayers.length) {
          [t.drawLayers[a], t.drawLayers[b]] = [
            t.drawLayers[b],
            t.drawLayers[a]
          ];
          t.activeDrawLayer = b;
        }
      }
      U.flatten(t);
    });
  };
  const originalSelection = p.selectionAction;
  p.selectionAction = function (id) {
    if (this.stage === "map") {
      originalSelection.call(this, id);
      return;
    }
    const s = this.selection,
      t = this.tile();
    if (!s || !t) {
      this.say("Choose Select, then drag around tile pixels first.");
      return;
    }
    const l = U.ensureDrawLayers(t);
    if (id === "unique" || id === "stamp") {
      this.say("Stamps and Make unique apply to map selections.");
      return;
    }
    if (["cut", "clear"].includes(id) && l.locked) {
      this.say("Unlock the selected tile layer first.");
      return;
    }
    const pixels = [];
    for (let y = 0; y < s.height; y++) {
      for (let x = 0; x < s.width; x++) {
        pixels.push(l.pixels[(s.y + y) * this.config.size + s.x + x]);
      }
    }
    if (id === "copy" || id === "cut") {
      this.tileClipboard = { width: s.width, height: s.height, pixels };
    }
    if (id !== "copy") {
      this.edit(() => {
        for (let y = 0; y < s.height; y++) {
          for (let x = 0; x < s.width; x++) {
            l.pixels[(s.y + y) * this.config.size + s.x + x] = 0;
          }
        }
        U.flatten(t);
      });
    }
    if (id === "copy" || id === "cut") {
      this.selection = null;
      this.tool = "brush";
      this.say("Click to paste the selected tile pixels. Escape ends pasting.");
    }
    this.render();
  };
})();

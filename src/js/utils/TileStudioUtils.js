(function () {
  const u = pskl.utils;
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const integer = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
  const api = (u.TileStudioUtils = {
    clone,
    create: function (size) {
      return {
        version: 1,
        size: size || 16,
        width: 24,
        height: 16,
        tiles: [],
        stamps: [],
        layers: [api.layer("Ground", 24, 16)],
        activeLayer: 0
      };
    },
    layer: function (name, w, h) {
      return {
        name,
        visible: true,
        locked: false,
        cells: Array(w * h).fill(null)
      };
    },
    validate: function (c) {
      if (
        !c ||
        c.version !== 1 ||
        !integer(c.size, 1, 128) ||
        !integer(c.width, 1, 128) ||
        !integer(c.height, 1, 128) ||
        c.width * c.height * c.size * c.size > 4194304 ||
        !Array.isArray(c.tiles) ||
        c.tiles.length > 1024 ||
        !Array.isArray(c.layers) ||
        !c.layers.length ||
        c.layers.length > 16 ||
        !Array.isArray(c.stamps) ||
        c.stamps.length > 128 ||
        !integer(c.activeLayer, 0, c.layers.length - 1)
      ) {
        throw new Error(
          "Invalid Tile Studio project or project exceeds size limits."
        );
      }
      const ids = new Set();
      c.tiles.forEach((t) => {
        if (
          !t ||
          typeof t.id !== "string" ||
          ids.has(t.id) ||
          typeof t.name !== "string" ||
          !Array.isArray(t.pixels) ||
          t.pixels.length !== c.size * c.size ||
          !t.pixels.every((p) => integer(p, 0, 4294967295))
        ) {
          throw new Error("Invalid tile pixels or duplicate tile ID.");
        }
        if (t.drawLayers !== undefined) {
          if (
            !Array.isArray(t.drawLayers) ||
            !t.drawLayers.length ||
            t.drawLayers.length > 16 ||
            !integer(t.activeDrawLayer, 0, t.drawLayers.length - 1) ||
            !t.drawLayers.every(
              (l) =>
                l &&
                typeof l.name === "string" &&
                typeof l.visible === "boolean" &&
                typeof l.locked === "boolean" &&
                Array.isArray(l.pixels) &&
                l.pixels.length === c.size * c.size &&
                l.pixels.every((v) => integer(v, 0, 4294967295))
            )
          ) {
            throw new Error("Invalid tile drawing layers.");
          }
        }
        ids.add(t.id);
      });
      const cellOK = (v) =>
        v === null ||
        (v &&
          ids.has(v.tile) &&
          integer(v.turn, 0, 3) &&
          typeof v.flip === "boolean");
      c.layers.forEach((l) => {
        if (
          !l ||
          typeof l.name !== "string" ||
          typeof l.visible !== "boolean" ||
          typeof l.locked !== "boolean" ||
          !Array.isArray(l.cells) ||
          l.cells.length !== c.width * c.height ||
          !l.cells.every(cellOK)
        ) {
          throw new Error("Invalid map layer or tile reference.");
        }
      });
      c.stamps.forEach((s) => {
        if (
          !s ||
          typeof s.name !== "string" ||
          !integer(s.width, 1, c.width) ||
          !integer(s.height, 1, c.height) ||
          !Array.isArray(s.cells) ||
          s.cells.length !== s.width * s.height ||
          !s.cells.every(cellOK)
        ) {
          throw new Error("Invalid stamp.");
        }
      });
      return c;
    },
    tile: function (c, pixels, name) {
      if (c.tiles.length >= 1024) {
        throw new Error("A tileset can hold up to 1024 tiles.");
      }
      const t = {
        id: u.Uuid.generate(),
        name: name || "Tile " + (c.tiles.length + 1),
        pixels: pixels ? Array.from(pixels) : Array(c.size * c.size).fill(0)
      };
      api.ensureDrawLayers(t);
      c.tiles.push(t);
      return t;
    },
    ensureDrawLayers: function (t) {
      if (!t.drawLayers) {
        t.drawLayers = ["Artwork", "Details", "Shadows", "Highlights"].map(
          (name, i) => ({
            name,
            visible: true,
            locked: false,
            pixels: i === 0 ? t.pixels.slice() : Array(t.pixels.length).fill(0)
          })
        );
        t.activeDrawLayer = 0;
      }
      return t.drawLayers[t.activeDrawLayer];
    },
    flatten: function (t) {
      api.ensureDrawLayers(t);
      t.pixels = Array(t.pixels.length).fill(0);
      t.drawLayers.forEach((l) => {
        if (l.visible) {
          l.pixels.forEach((v, i) => {
            t.pixels[i] = u.PuppetColorUtils.over(t.pixels[i], v);
          });
        }
      });
    },
    resolution: function (c, size, method) {
      if (
        !integer(size, 1, 128) ||
        c.width * c.height * size * size > 4194304
      ) {
        throw new Error(
          "Choose 1–128 pixels per tile, within the four-million-pixel map limit. Reduce map rows/columns for higher resolutions."
        );
      }
      const old = c.size;
      c.tiles.forEach((t) => {
        const pixels = Array(size * size).fill(0);
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const sx = method === "canvas" ? x : Math.floor((x * old) / size),
              sy = method === "canvas" ? y : Math.floor((y * old) / size);
            if (sx < old && sy < old) {
              pixels[y * size + x] = t.pixels[sy * old + sx];
            }
          }
        }
        t.pixels = pixels;
        if (t.drawLayers) {
          t.drawLayers.forEach((l) => {
            const resized = Array(size * size).fill(0);
            for (let y = 0; y < size; y++) {
              for (let x = 0; x < size; x++) {
                const sx =
                    method === "canvas" ? x : Math.floor((x * old) / size),
                  sy = method === "canvas" ? y : Math.floor((y * old) / size);
                if (sx < old && sy < old) {
                  resized[y * size + x] = l.pixels[sy * old + sx];
                }
              }
            }
            l.pixels = resized;
          });
        }
      });
      c.size = size;
    },
    resize: function (c, w, h) {
      if (
        !integer(w, 1, 128) ||
        !integer(h, 1, 128) ||
        w * h * c.size * c.size > 4194304
      ) {
        throw new Error(
          "Use 1–128 cells per side, up to 4 million output pixels."
        );
      }
      c.layers.forEach((l) => {
        const cells = Array(w * h).fill(null);
        for (let y = 0; y < Math.min(h, c.height); y++) {
          for (let x = 0; x < Math.min(w, c.width); x++) {
            cells[y * w + x] = l.cells[y * c.width + x];
          }
        }
        l.cells = cells;
      });
      c.stamps = c.stamps.filter((s) => s.width <= w && s.height <= h);
      c.width = w;
      c.height = h;
    },
    line: function (a, b, visit) {
      let x = a.x,
        y = a.y;
      const dx = Math.abs(b.x - x),
        dy = -Math.abs(b.y - y),
        sx = x < b.x ? 1 : -1,
        sy = y < b.y ? 1 : -1;
      let error = dx + dy;
      for (;;) {
        visit(x, y);
        if (x === b.x && y === b.y) {
          break;
        }
        const twice = 2 * error;
        if (twice >= dy) {
          error += dy;
          x += sx;
        }
        if (twice <= dx) {
          error += dx;
          y += sy;
        }
      }
    },
    fill: function (values, w, h, x, y, value) {
      const target = JSON.stringify(values[y * w + x]),
        replacement = JSON.stringify(value);
      if (target === replacement) {
        return;
      }
      const stack = [y * w + x];
      while (stack.length) {
        const at = stack.pop();
        if (JSON.stringify(values[at]) !== target) {
          continue;
        }
        values[at] = clone(value);
        const cx = at % w,
          cy = Math.floor(at / w);
        if (cx > 0) {
          stack.push(at - 1);
        }
        if (cx < w - 1) {
          stack.push(at + 1);
        }
        if (cy > 0) {
          stack.push(at - w);
        }
        if (cy < h - 1) {
          stack.push(at + w);
        }
      }
    },
    pixelsCanvas: function (pixels, size) {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d"),
        image = ctx.createImageData(size, size);
      pixels.forEach((p, i) => {
        image.data[i * 4] = p & 255;
        image.data[i * 4 + 1] = (p >>> 8) & 255;
        image.data[i * 4 + 2] = (p >>> 16) & 255;
        image.data[i * 4 + 3] = p >>> 24;
      });
      ctx.putImageData(image, 0, 0);
      return canvas;
    },
    drawCell: function (ctx, image, cell, x, y, size) {
      if (!image || !cell) {
        return;
      }
      ctx.save();
      ctx.translate(x + size / 2, y + size / 2);
      ctx.rotate((cell.turn * Math.PI) / 2);
      ctx.scale(cell.flip ? -1 : 1, 1);
      ctx.drawImage(image, -size / 2, -size / 2, size, size);
      ctx.restore();
    },
    mapCanvas: function (c) {
      const canvas = document.createElement("canvas");
      canvas.width = c.width * c.size;
      canvas.height = c.height * c.size;
      const ctx = canvas.getContext("2d"),
        images = {};
      ctx.imageSmoothingEnabled = false;
      c.tiles.forEach((t) => {
        images[t.id] = api.pixelsCanvas(t.pixels, c.size);
      });
      c.layers.forEach((l) => {
        if (!l.visible) {
          return;
        }
        l.cells.forEach((cell, i) => {
          if (cell) {
            api.drawCell(
              ctx,
              images[cell.tile],
              cell,
              (i % c.width) * c.size,
              Math.floor(i / c.width) * c.size,
              c.size
            );
          }
        });
      });
      return canvas;
    },
    slice: function (c, canvas) {
      const cols = Math.ceil(canvas.width / c.size),
        rows = Math.ceil(canvas.height / c.size);
      if (cols * rows + c.tiles.length > 1024) {
        throw new Error(
          "Import would exceed 1024 tiles. Choose a larger tile size."
        );
      }
      const ctx = canvas.getContext("2d"),
        data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let ty = 0; ty < rows; ty++) {
        for (let tx = 0; tx < cols; tx++) {
          const pixels = Array(c.size * c.size).fill(0);
          for (let y = 0; y < c.size; y++) {
            for (let x = 0; x < c.size; x++) {
              const sx = tx * c.size + x,
                sy = ty * c.size + y,
                at = (sy * canvas.width + sx) * 4;
              if (sx < canvas.width && sy < canvas.height) {
                pixels[y * c.size + x] =
                  (data[at] |
                    (data[at + 1] << 8) |
                    (data[at + 2] << 16) |
                    (data[at + 3] << 24)) >>>
                  0;
              }
            }
          }
          api.tile(c, pixels, "Tile " + (tx + 1) + "," + (ty + 1));
        }
      }
    }
  });
})();

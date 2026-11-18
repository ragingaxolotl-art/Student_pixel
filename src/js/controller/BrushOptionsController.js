(function () {
  var ns = $.namespace("pskl.controller");
  var tips = [
    ["square", "Square"],
    ["round", "Round"],
    ["diamond", "Diamond"],
    ["horizontal", "Horizontal"],
    ["vertical", "Vertical"],
    ["slash", "Slash"],
    ["backslash", "Backslash"],
    ["cross", "Cross"],
    ["calligraphy", "Calligraphy"],
    ["calligraphy-reverse", "Reverse calligraphy"],
    ["flat", "Flat"],
    ["ring", "Ring"],
    ["square-outline", "Square outline"],
    ["diamond-outline", "Diamond outline"],
    ["x", "X"],
    ["asterisk", "Asterisk"],
    ["oval-horizontal", "Wide oval"],
    ["oval-vertical", "Tall oval"],
    ["triangle-up", "Triangle up"],
    ["triangle-down", "Triangle down"],
    ["triangle-left", "Triangle left"],
    ["triangle-right", "Triangle right"],
    ["heart", "Heart"],
    ["star", "Star"],
    ["plus-stamp", "Block cross"],
    ["hollow-cross", "Hollow cross"],
    ["cloud", "Cloud"],
    ["flower", "Flower"],
    ["petal", "Petal"],
    ["double-leaf", "Double leaf"],
    ["grass", "Grass"],
    ["fur", "Fur"],
    ["scallop", "Scallop"],
    ["bristles", "Bristles"],
    ["sparkle", "Sparkle"],
    ["leaf", "Leaf"]
  ];
  ns.brushTipContains = function (tip, x, y, size) {
    var dx = Math.abs(x - (size - 1) / 2),
      dy = Math.abs(y - (size - 1) / 2);
    var edge = Math.max(0.5, size / 8);
    // Very small tips remain usable even when their detail cannot fit.
    if (size <= 2) {
      return true;
    }
    var u = (x - (size - 1) / 2) / (size / 2),
      v = (y - (size - 1) / 2) / (size / 2),
      radius = Math.sqrt(u * u + v * v);
    switch (tip) {
      case "square-outline":
        return dx >= size / 2 - 1 || dy >= size / 2 - 1;
      case "diamond-outline":
        return dx + dy <= size / 2 && dx + dy >= size / 2 - 1.5;
      case "x":
        return Math.abs(dx - dy) <= edge;
      case "asterisk":
        return dx <= edge || dy <= edge || Math.abs(dx - dy) <= edge;
      case "oval-horizontal":
        return u * u + 4 * v * v <= 1;
      case "oval-vertical":
        return 4 * u * u + v * v <= 1;
      case "triangle-up":
        return Math.abs(u) <= (v + 1) / 2;
      case "triangle-down":
        return Math.abs(u) <= (1 - v) / 2;
      case "triangle-left":
        return Math.abs(v) <= (u + 1) / 2;
      case "triangle-right":
        return Math.abs(v) <= (1 - u) / 2;
      case "heart":
        return Math.pow(u * u + v * v - 0.65, 3) - u * u * Math.pow(-v, 3) <= 0;
      case "star":
        return (
          radius <= 0.62 + 0.3 * Math.cos(5 * (Math.atan2(v, u) + Math.PI / 2))
        );
      case "plus-stamp":
        return Math.abs(u) <= 0.38 || Math.abs(v) <= 0.38;
      case "hollow-cross":
        return (dx <= edge || dy <= edge) && Math.max(dx, dy) >= size / 4;
      case "bristles":
        return x % 3 !== 1 && Math.abs(v) < 0.65 + (x % 5) * 0.08;
      case "sparkle":
        return Math.abs(u * v) <= 0.09 && radius <= 1;
      case "leaf":
        return Math.abs(u + v) < 0.65 * (1 - Math.abs(u - v) / 2);

      case "calligraphy":
        return Math.abs(u + v) <= 0.38;
      case "calligraphy-reverse":
        return Math.abs(u - v) <= 0.38;
      case "flat":
        return Math.abs(v) <= 0.4;
      case "cloud":
        return (
          (u + 0.45) * (u + 0.45) + (v - 0.1) * (v - 0.1) < 0.3 ||
          u * u + (v + 0.22) * (v + 0.22) < 0.44 ||
          (u - 0.48) * (u - 0.48) + (v - 0.12) * (v - 0.12) < 0.27
        );
      case "flower":
        return radius <= 0.66 + 0.25 * Math.cos(5 * Math.atan2(v, u));
      case "petal":
        return (u * u) / 0.38 + v * v <= 1 && v < 0.75;
      case "double-leaf":
        return (
          Math.pow((u + v) / 0.42, 2) + Math.pow((u - v) / 1.45, 2) <= 1 ||
          Math.pow((u - v) / 0.42, 2) + Math.pow((u + v) / 1.45, 2) <= 1
        );
      case "grass":
        return (
          Math.abs(u) <= 0.16 ||
          Math.abs(u + 0.42 * (1 - v)) < 0.14 ||
          Math.abs(u - 0.42 * (1 - v)) < 0.14
        );
      case "fur":
        return (
          Math.abs(v) < 0.75 &&
          Math.abs(u + 0.25 * v) < 0.75 - 0.18 * Math.cos(12 * v)
        );
      case "scallop":
        return radius <= 0.78 + 0.14 * Math.cos(8 * Math.atan2(v, u));
      case "round":
        return dx * dx + dy * dy <= (size * size) / 4;
      case "diamond":
        return dx + dy <= size / 2;
      case "horizontal":
        return dy <= edge;
      case "vertical":
        return dx <= edge;
      case "slash":
        return Math.abs(x + y - size + 1) <= edge;
      case "backslash":
        return Math.abs(x - y) <= edge;
      case "cross":
        return dx <= edge || dy <= edge;
      case "ring":
        return (
          size <= 2 ||
          (dx * dx + dy * dy <= (size * size) / 4 &&
            dx * dx + dy * dy >= Math.pow(Math.max(0, size / 2 - 1.5), 2))
        );
      default:
        return true;
    }
  };
  ns.BrushOptionsController = function () {
    this.root = document.querySelector("#brush-options");
    this.size = this.root.querySelector('[aria-label="Brush size (pixels)"]');
    this.opacity = this.root.querySelector('[aria-label="Brush opacity"]');
  };
  var p = ns.BrushOptionsController.prototype;
  p.init = function () {
    var trigger = this.root.querySelector(".brush-library-trigger");
    this.menu = this.root.querySelector(".brush-library-menu");
    tips.forEach((tip) => {
      var button = document.createElement("button");
      button.type = "button";
      button.dataset.brushTip = tip[0];
      button.setAttribute("aria-label", tip[1] + " brush");
      var canvas = document.createElement("canvas");
      canvas.width = canvas.height = 16;
      canvas.setAttribute("aria-hidden", "true");
      this.previewTip(canvas, tip[0]);
      button.append(canvas, document.createTextNode(tip[1]));
      button.addEventListener("click", () => {
        pskl.UserSettings.set(pskl.UserSettings.BRUSH_TIP, tip[0]);
        this.closeLibrary();
        trigger.focus();
      });
      this.menu.querySelector(".brush-tip-grid").append(button);
    });
    trigger.addEventListener("click", () => {
      this.menu.hidden = !this.menu.hidden;
      trigger.setAttribute("aria-expanded", String(!this.menu.hidden));
      if (!this.menu.hidden) {
        this.search.focus();
      }
    });
    this.search = this.menu.querySelector(".brush-library-search");
    this.search.addEventListener("input", () => {
      var query = this.search.value.trim().toLowerCase(),
        count = 0;
      this.menu.querySelectorAll("[data-brush-tip]").forEach((button) => {
        button.hidden = !button.textContent.toLowerCase().includes(query);
        if (!button.hidden) {
          count++;
        }
      });
      this.menu.querySelector(".brush-library-empty").hidden = count !== 0;
    });
    var presets = document.querySelector(".pen-size-container");
    this.root.querySelector(".brush-presets").append(presets);
    presets.querySelectorAll("[data-size]").forEach((button) => {
      button.tabIndex = 0;
      button.setAttribute("role", "button");
      button.setAttribute("aria-label", button.dataset.size + " pixel brush");
      button.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          button.click();
        }
      });
    });
    this.size.addEventListener("input", () => {
      var value = Number(this.size.value),
        valid =
          this.size.value !== "" &&
          Number.isInteger(value) &&
          value >= 1 &&
          value <= 32;
      this.size.setAttribute("aria-invalid", String(!valid));
      if (valid) {
        pskl.app.penSizeService.setPenSize(value);
      }
    });
    this.size.addEventListener("blur", () => this.render());
    this.opacity.addEventListener("input", () => {
      pskl.UserSettings.set(
        pskl.UserSettings.BRUSH_OPACITY,
        Number(this.opacity.value)
      );
    });
    this.root.querySelector(".brush-compact").addEventListener("click", () => {
      var open = this.root.classList.toggle("controls-open");
      this.root
        .querySelector(".brush-compact")
        .setAttribute("aria-expanded", String(open));
    });
    this.root.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.collapse();
        trigger.focus();
      }
      e.stopPropagation();
    });
    document.addEventListener("pointerdown", (e) => {
      if (!this.root.contains(e.target)) {
        this.collapse();
      }
    });
    $.subscribe(Events.TOOL_SELECTED, (event, tool) => {
      this.tool = tool;
      this.collapse();
      this.render();
    });
    $.subscribe(Events.PEN_SIZE_CHANGED, () => this.render());
    $.subscribe(Events.USER_SETTINGS_CHANGED, (event, key) => {
      if (
        key === pskl.UserSettings.BRUSH_TIP ||
        key === pskl.UserSettings.BRUSH_OPACITY ||
        key === pskl.UserSettings.DITHER_SETTINGS
      ) {
        this.render();
      }
    });
    this.tool = pskl.app.toolController.currentSelectedTool;
    this.render();
  };
  p.previewTip = function (canvas, tip) {
    var ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, 16, 16);
    ctx.fillStyle = "#ffd700";
    for (var y = 0; y < 12; y++) {
      for (var x = 0; x < 12; x++) {
        if (ns.brushTipContains(tip, x, y, 12)) {
          ctx.fillRect(x + 2, y + 2, 1, 1);
        }
      }
    }
  };
  p.closeLibrary = function () {
    this.menu.hidden = true;
    this.root
      .querySelector(".brush-library-trigger")
      .setAttribute("aria-expanded", "false");
  };
  p.collapse = function () {
    this.closeLibrary();
    this.root.classList.remove("controls-open");
    this.root
      .querySelector(".brush-compact")
      .setAttribute("aria-expanded", "false");
  };
  p.render = function () {
    if (!this.tool) {
      return;
    }
    var tip = pskl.UserSettings.get(pskl.UserSettings.BRUSH_TIP);
    var selected = tips.find((entry) => entry[0] === tip) || tips[0];
    this.root.querySelector(".brush-tip-name").textContent = selected[1];
    this.previewTip(
      this.root.querySelector(".brush-library-trigger canvas"),
      selected[0]
    );
    this.menu.querySelectorAll("[data-brush-tip]").forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.brushTip === selected[0])
      );
    });
    this.root.querySelector(".brush-library-group").hidden = ![
      "tool-pen",
      "tool-eraser",
      "tool-vertical-mirror-pen"
    ].includes(this.tool.toolId);
    var size = this.tool.supportsDynamicPenSize(),
      fill = ["tool-paint-bucket", "tool-dithering", "tool-colorswap"].includes(
        this.tool.toolId
      );
    this.root.hidden = !size && !fill;
    // Shape options already expose outline width through the same size service.
    if (["tool-rectangle", "tool-circle"].includes(this.tool.toolId)) {
      size = false;
    }
    this.root.querySelector(".brush-size-group").hidden = !size;
    this.size.disabled = !size;
    this.root.querySelector(".brush-opacity-group").hidden = [
      "tool-eraser",
      "tool-lighten"
    ].includes(this.tool.toolId);
    this.size.value = pskl.app.penSizeService.getPenSize();
    this.size.removeAttribute("aria-invalid");
    var opacity = Number(
      pskl.UserSettings.get(pskl.UserSettings.BRUSH_OPACITY)
    );
    this.opacity.value = Number.isFinite(opacity)
      ? Math.max(0, Math.min(100, opacity))
      : 100;
    this.root.querySelector("output").textContent = this.opacity.value + "%";
  };
})();

(function () {
  var ns = $.namespace("pskl.controller");
  ns.BrushOptionsController = function () {
    this.root = document.querySelector("#brush-options");
    this.size = this.root.querySelector('[aria-label="Brush size (pixels)"]');
    this.opacity = this.root.querySelector('[aria-label="Brush opacity"]');
  };
  var p = ns.BrushOptionsController.prototype;
  p.init = function () {
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
        key === pskl.UserSettings.BRUSH_OPACITY ||
        key === pskl.UserSettings.DITHER_SETTINGS
      ) {
        this.render();
      }
    });
    this.tool = pskl.app.toolController.currentSelectedTool;
    this.render();
  };
  p.collapse = function () {
    this.root.classList.remove("controls-open");
    this.root
      .querySelector(".brush-compact")
      .setAttribute("aria-expanded", "false");
  };
  p.render = function () {
    if (!this.tool) {
      return;
    }
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

(function () {
  const ns = $.namespace("pskl.controller");
  ns.ShapeOptionsController = function () {
    this.root = document.querySelector("#shape-options");
    this.tool = null;
  };
  const p = ns.ShapeOptionsController.prototype;
  p.init = function () {
    this.root
      .querySelector("[data-shape-width]")
      .addEventListener("change", (event) => {
        const value = Number(event.target.value);
        if (Number.isInteger(value) && value >= 1 && value <= 32) {
          pskl.app.penSizeService.setPenSize(value);
        }
        this.render();
      });
    ["outline", "fill"].forEach((kind) => {
      const picker = $("#shape-" + kind + "-color");
      picker.spectrum({
        color: pskl.app.selectedColorsService.getPrimaryColor(),
        showInput: true,
        showAlpha: true,
        showButtons: false,
        showPalette: true,
        palette: [["rgba(0,0,0,0)"]],
        clickoutFiresChange: true,
        beforeShow: (color) => {
          if (!color.getAlpha()) {
            var candidate = window.tinycolor(
              pskl.app.selectedColorsService.getPrimaryColor()
            );
            candidate.setAlpha(1);
            picker.spectrum("set", candidate.toRgbString());
          }
        },
        change: (color) => {
          if (!this.tool || !color) {
            return;
          }
          if (kind === "outline") {
            $.publish(Events.SELECT_PRIMARY_COLOR, [color.toRgbString()]);
          } else {
            this.tool.fillColor = color.toRgbString();
          }
          this.render();
        }
      });
      picker.next(".sp-replacer").attr({
        role: "button",
        "aria-label": kind === "outline" ? "Outline color" : "Fill color",
        tabindex: "0"
      });
      picker.next(".sp-replacer").on("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          picker.spectrum("toggle");
        }
      });
    });
    this.root.querySelector(".shape-compact").addEventListener("click", () => {
      const open = this.root.classList.toggle("controls-open");
      this.root
        .querySelector(".shape-compact")
        .setAttribute("aria-expanded", String(open));
    });
    this.root.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        this.collapse(true);
      }
      event.stopPropagation();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !this.root.hidden) {
        this.collapse(true);
      }
    });
    document.addEventListener("pointerdown", (event) => {
      if (
        !this.root.contains(event.target) &&
        !event.target.closest(".sp-container")
      ) {
        this.collapse();
      }
    });
    $.subscribe(Events.TOOL_SELECTED, (_event, tool) => {
      this.collapse();
      this.tool = ["tool-rectangle", "tool-circle"].includes(tool.toolId)
        ? tool
        : null;
      this.root.hidden = !this.tool;
      this.render();
    });
    [
      Events.PRIMARY_COLOR_SELECTED,
      Events.SECONDARY_COLOR_SELECTED,
      Events.PEN_SIZE_CHANGED
    ].forEach((event) => $.subscribe(event, () => this.render()));
    $.subscribe(Events.DIALOG_SHOW, () => this.collapse());
  };
  p.collapse = function (cancel) {
    this.root.classList.remove("controls-open");
    this.root
      .querySelector(".shape-compact")
      .setAttribute("aria-expanded", "false");
    ["outline", "fill"].forEach((kind) =>
      $("#shape-" + kind + "-color").spectrum(
        "hide",
        cancel ? "cancel" : undefined
      )
    );
  };
  p.render = function () {
    if (!this.tool) {
      return;
    }
    this.root.querySelector("[data-shape-width]").value =
      pskl.app.penSizeService.getPenSize();
    const primary = pskl.app.selectedColorsService.getPrimaryColor();
    $("#shape-outline-color").spectrum("set", primary);
    $("#shape-fill-color").spectrum("set", this.tool.fillColor);
    ["outline", "fill"].forEach((kind) => {
      const color = kind === "outline" ? primary : this.tool.fillColor;
      const inactive = !(pskl.utils.colorToInt(color) >>> 24);
      const picker = $("#shape-" + kind + "-color");
      picker.next(".sp-replacer").attr("aria-pressed", String(!inactive));
      picker
        .next(".sp-replacer")
        .attr(
          "title",
          inactive
            ? "Transparent · choose a color to enable " + kind
            : "Choose " + kind + " color; transparent turns it off"
        );
    });
    this.root.querySelector("[data-shape-width]").disabled = !(
      pskl.utils.colorToInt(primary) >>> 24
    );
  };
})();

(function () {
  const ns = $.namespace("pskl.controller");
  const patterns = pskl.utils.DitherPatterns;

  ns.DitherOptionsController = function () {
    this.root = document.querySelector("#dither-options");
    this.menu = this.root.querySelector(".dither-pattern-menu");
    this.trigger = this.root.querySelector(".dither-pattern-trigger");
    this.settings = patterns.normalize(
      pskl.UserSettings.get(pskl.UserSettings.DITHER_SETTINGS)
    );
  };

  ns.DitherOptionsController.prototype.init = function () {
    patterns.list().forEach((entry) => {
      const button = document.createElement("button"),
        canvas = document.createElement("canvas"),
        label = document.createElement("span");
      button.type = "button";
      button.className = "dither-pattern-choice";
      button.dataset.ditherPattern = entry.id;
      button.setAttribute("aria-label", entry.label + " pattern");
      button.setAttribute("aria-pressed", "false");
      canvas.width = 16;
      canvas.height = 8;
      canvas.setAttribute("aria-hidden", "true");
      label.className = "dither-pattern-name";
      label.textContent = entry.label;
      button.append(canvas, label);
      this.menu.append(button);
    });
    this.root.addEventListener("click", (event) => {
      const choice = event.target.closest("[data-dither-pattern]");
      if (choice) {
        this.settings.pattern = choice.dataset.ditherPattern;
        this.settings.mode = "pattern";
        this.save_();
        this.close_();
        this.trigger.focus({ preventScroll: true });
        this.root.querySelector(".dither-announcement").textContent =
          patterns.get(this.settings.pattern).label;
      } else if (event.target.closest(".dither-density-mode")) {
        this.settings.mode =
          this.settings.mode === "density" ? "pattern" : "density";
        this.save_();
        this.close_();
      } else if (event.target.closest(".dither-pattern-trigger")) {
        if (this.menu.hidden) {
          this.open_();
        } else {
          this.close_();
        }
      } else if (event.target.closest(".dither-compact")) {
        this.close_();
        const open = this.root.classList.toggle("controls-open");
        this.root
          .querySelector(".dither-compact")
          .setAttribute("aria-expanded", String(open));
      }
    });
    this.root.addEventListener("input", (event) => {
      if (event.target.dataset.ditherSetting === "density") {
        this.settings.density = Number(event.target.value);
        this.settings.mode = "density";
        this.close_();
        this.save_();
      }
    });
    this.root.addEventListener("change", (event) => {
      const key = event.target.dataset.ditherSetting;
      if (!key || key === "density") {
        return;
      }
      this.settings[key] = event.target.value;
      if (
        key === "coverage" &&
        patterns.get(this.settings.pattern).family === "density"
      ) {
        this.settings.pattern =
          patterns
            .list()
            .find(
              (e) =>
                e.family === "density" &&
                String(e.coverage) === this.settings.coverage
            )?.id || "checker";
      }
      this.save_();
    });
    this.root.addEventListener("keydown", (event) => {
      if (event.target === this.trigger && event.key === "ArrowDown") {
        this.open_(true);
        event.preventDefault();
      } else if (!this.menu.hidden && event.key === "Escape") {
        this.close_();
        this.trigger.focus();
        event.preventDefault();
      } else if (event.target.closest(".dither-pattern-choice")) {
        const buttons = [...this.menu.children],
          i = buttons.indexOf(event.target);
        const delta = {
          ArrowUp: -1,
          ArrowLeft: -1,
          ArrowDown: 1,
          ArrowRight: 1
        }[event.key];
        if (delta || event.key === "Home" || event.key === "End") {
          const next =
            buttons[
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? buttons.length - 1
                  : (i + delta + buttons.length) % buttons.length
            ];
          next.focus({ preventScroll: true });
          next.scrollIntoView({ block: "nearest" });
          event.preventDefault();
        }
      } else if (event.key === "Escape") {
        this.collapse_();
      }
      event.stopPropagation();
    });
    document.addEventListener("pointerdown", (event) => {
      if (!this.root.contains(event.target)) {
        this.collapse_();
      }
    });
    window.addEventListener("resize", () => this.position_());
    $.subscribe(Events.TOOL_SELECTED, (event, tool) => {
      this.root.hidden = tool.toolId !== "tool-dithering";
      this.collapse_();
      if (!this.root.hidden) {
        this.render_();
      }
    });
    $.subscribe(Events.DIALOG_SHOW, () => this.collapse_());
    [Events.PRIMARY_COLOR_SELECTED, Events.SECONDARY_COLOR_SELECTED].forEach(
      (name) => $.subscribe(name, () => this.render_())
    );
    $.subscribe(Events.USER_SETTINGS_CHANGED, (event, key) => {
      if (key === pskl.UserSettings.DITHER_SETTINGS) {
        this.settings = patterns.normalize(pskl.UserSettings.get(key));
        this.render_();
      }
    });
    this.root.hidden =
      document.body.dataset.selectedToolClass !== "tool-dithering";
    this.render_();
  };

  ns.DitherOptionsController.prototype.save_ = function () {
    this.settings = patterns.normalize(this.settings);
    pskl.UserSettings.set(pskl.UserSettings.DITHER_SETTINGS, {
      ...this.settings
    });
  };
  ns.DitherOptionsController.prototype.close_ = function () {
    this.menu.hidden = true;
    this.trigger.setAttribute("aria-expanded", "false");
  };
  ns.DitherOptionsController.prototype.collapse_ = function () {
    this.close_();
    this.root.classList.remove("controls-open");
    this.root
      .querySelector(".dither-compact")
      .setAttribute("aria-expanded", "false");
  };
  ns.DitherOptionsController.prototype.position_ = function () {
    if (this.menu.hidden) {
      return;
    }
    const r = this.trigger.getBoundingClientRect();
    if (!this.trigger.getClientRects().length) {
      this.close_();
      return;
    }
    this.menu.style.left =
      Math.max(4, Math.min(innerWidth - 120, r.left)) + "px";
    this.menu.style.top = r.bottom + 3 + "px";
  };
  ns.DitherOptionsController.prototype.open_ = function (focus) {
    this.menu.hidden = false;
    this.trigger.setAttribute("aria-expanded", "true");
    this.position_();
    const selected = this.menu.querySelector(
      '[data-dither-pattern="' + this.settings.pattern + '"]'
    );
    selected.scrollIntoView({ block: "nearest" });
    if (focus) {
      selected.focus({ preventScroll: true });
    }
  };
  ns.DitherOptionsController.prototype.paint_ = function (canvas, id, active) {
    const settings = patterns.normalize({
      ...this.settings,
      pattern: id,
      mode: active ? this.settings.mode : "pattern"
    });
    const bits = patterns.createMask(16, 8, settings),
      ctx = canvas.getContext("2d");
    const colors = pskl.app.selectedColorsService;
    ctx.clearRect(0, 0, 16, 8);
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 16; x++) {
        const primary = bits[y * 16 + x];
        if (!primary && settings.colors === "primary") {
          continue;
        }
        ctx.fillStyle = primary
          ? colors.getPrimaryColor()
          : colors.getSecondaryColor();
        ctx.fillRect(x, y, 1, 1);
      }
    }
  };
  ns.DitherOptionsController.prototype.render_ = function () {
    this.root.querySelectorAll("[data-dither-setting]").forEach((input) => {
      input.value = this.settings[input.dataset.ditherSetting];
    });
    const densityMode = this.settings.mode === "density";
    this.root.dataset.ditherMode = this.settings.mode;
    this.root
      .querySelector(".dither-density-mode")
      .setAttribute("aria-pressed", String(densityMode));
    this.root.querySelector(".dither-density-value").textContent =
      this.settings.density + "%";
    const label = densityMode
      ? "Density: " + this.settings.density + "%"
      : "Pattern: " + patterns.get(this.settings.pattern).label;
    this.trigger.setAttribute("aria-label", label);
    this.trigger.title = densityMode
      ? label + " · choose a pattern to switch back"
      : label;
    this.paint_(
      this.trigger.querySelector("canvas"),
      this.settings.pattern,
      true
    );
    const colors = pskl.app.selectedColorsService;
    const thumbnailKey = [
      this.settings.coverage,
      this.settings.scale,
      this.settings.colors,
      colors.getPrimaryColor(),
      colors.getSecondaryColor()
    ].join("|");
    this.menu.querySelectorAll("[data-dither-pattern]").forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        String(
          !densityMode && button.dataset.ditherPattern === this.settings.pattern
        )
      );
      if (this.thumbnailKey !== thumbnailKey) {
        this.paint_(
          button.querySelector("canvas"),
          button.dataset.ditherPattern
        );
      }
    });
    this.thumbnailKey = thumbnailKey;
  };
})();

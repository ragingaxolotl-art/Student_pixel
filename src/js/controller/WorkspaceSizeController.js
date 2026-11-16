(function () {
  const ns = $.namespace("pskl.controller");
  const defaults = {
    sideWidth: 210,
    toolsWidth: 100,
    frameHeight: 94,
    layerHeight: 180,
    layerWidth: 680,
    previewHeight: 200,
    transformHeight: 82,
    paletteHeight: 180,
    fxHeight: 320
  };
  const limits = {
    sideWidth: [170, 420],
    toolsWidth: [54, 198],
    frameHeight: [94, 280],
    layerHeight: [80, 650],
    layerWidth: [240, 1600],
    previewHeight: [96, 500],
    transformHeight: [82, 400],
    paletteHeight: [100, 600],
    fxHeight: [120, 1200]
  };
  const labels = {
    sideWidth: "Resize side panels width",
    toolsWidth: "Resize tools width",
    frameHeight: "Resize frames height",
    layerHeight: "Resize layers height",
    layerWidth: "Resize layers width",
    previewHeight: "Resize preview height",
    transformHeight: "Resize transform height",
    paletteHeight: "Resize palettes height",
    fxHeight: "Resize layer options height"
  };
  const selectors = {
    frameHeight: ".frames-column",
    layerHeight: ".layers-column",
    layerWidth: ".layers-column",
    previewHeight: ".workspace-preview-panel",
    transformHeight: ".transformations-container",
    paletteHeight: ".palettes-list-container",
    fxHeight: ".workspace-options-panel",
    toolsWidth: "#tool-section"
  };
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  ns.WorkspaceSizeController = function () {
    this.root = document.querySelector("#main-wrapper");
    this.sizes = this.normalize(
      pskl.UserSettings.get(pskl.UserSettings.WORKSPACE_LAYOUT)
    );
    this.handles = {};
  };
  const p = ns.WorkspaceSizeController.prototype;
  p.normalize = function (input) {
    const sizes = { ...defaults };
    Object.keys(defaults).forEach((key) => {
      if (input && Number.isFinite(input[key])) {
        sizes[key] = clamp(input[key], ...limits[key]);
      }
    });
    return sizes;
  };
  p.init = function () {
    this.root.classList.add("workspace-sized");
    Object.keys(defaults).forEach((key) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "workspace-resize";
      button.dataset.workspaceResize = key;
      button.setAttribute("role", "separator");
      button.setAttribute("aria-label", labels[key]);
      button.setAttribute(
        "aria-orientation",
        key.includes("Width") ? "vertical" : "horizontal"
      );
      button.title =
        labels[key] + " · drag or use arrow keys · double-click to reset";
      button.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) {
          return;
        }
        this.drag = {
          key,
          x: event.clientX,
          y: event.clientY,
          value: this.actual[key],
          before: { ...this.sizes }
        };
        button.setPointerCapture(event.pointerId);
        button.classList.add("dragging");
        event.preventDefault();
      });
      button.addEventListener("pointermove", (event) => {
        if (!this.drag) {
          return;
        }
        const d = this.drag,
          delta = key.includes("Width")
            ? event.clientX - d.x
            : event.clientY - d.y;
        this.sizes[key] = d.value + Math.round(delta * this.direction(key));
        this.layout_();
        this.sizes[key] = this.actual[key];
      });
      ["pointerup", "pointercancel", "lostpointercapture"].forEach((type) =>
        button.addEventListener(type, (event) => {
          if (!this.drag) {
            return;
          }
          if (event.type !== "pointerup") {
            this.sizes = this.drag.before;
          }
          this.drag = null;
          button.classList.remove("dragging");
          this.layout_();
          this.save();
        })
      );
      button.addEventListener("dblclick", () => this.reset(key));
      button.addEventListener("keydown", (event) => {
        const delta = (
          key.includes("Width")
            ? { ArrowLeft: -1, ArrowRight: 1 }
            : { ArrowUp: -1, ArrowDown: 1 }
        )[event.key];
        if (delta !== undefined) {
          this.sizes[key] =
            this.actual[key] +
            delta * this.direction(key) * (event.shiftKey ? 1 : 10);
          this.layout_();
          this.sizes[key] = this.actual[key];
          this.save();
          event.preventDefault();
        } else if (event.key === "Home") {
          this.reset(key);
          event.preventDefault();
        }
        event.stopPropagation();
      });
      this.root.append(button);
      this.handles[key] = button;
    });
    document
      .querySelectorAll(".right-panels-scroller")
      .forEach((scroller) =>
        scroller.addEventListener("scroll", () => this.position_())
      );
    this.observer = new ResizeObserver(() => this.layout_());
    this.observer.observe(this.root);
    this.previewObserver = new ResizeObserver(() => this.layout_());
    this.previewObserver.observe(
      document.querySelector("#animated-preview-container")
    );
    this.paneObserver = new ResizeObserver(() => this.position_());
    this.paneObserver.observe(document.querySelector("#layer-options"));
    $.subscribe(Events.USER_SETTINGS_CHANGED, (_event, key) => {
      if (key === pskl.UserSettings.WORKSPACE_LAYOUT) {
        this.sizes = this.normalize(pskl.UserSettings.get(key));
        this.layout_();
      } else if (key === pskl.UserSettings.TRANSFORM_SHOW_MORE) {
        const content = document.querySelector(
          ".transformations-container .tools-wrapper"
        );
        this.sizes.transformHeight = pskl.UserSettings.get(key)
          ? Math.max(this.actual.transformHeight, content.scrollHeight + 38)
          : defaults.transformHeight;
        this.layout_();
        this.save();
      }
    });
    this.layout_();
  };
  p.panel = function (key) {
    if (key === "sideWidth") {
      return document
        .querySelector(".workspace-preview-panel")
        .closest(".workspace-side");
    }
    return document.querySelector(selectors[key]);
  };
  p.direction = function (key) {
    const dock = this.panel(key).closest("[data-dock]");
    if (key === "sideWidth") {
      return dock.dataset.dock === "left" ? 1 : -1;
    }
    if (key === "toolsWidth") {
      return pskl.app.workspaceController.state.tools === "left" ? 1 : -1;
    }
    if (["frameHeight", "layerHeight"].includes(key)) {
      return dock.dataset.dock === "top" ? 1 : -1;
    }
    return 1;
  };
  p.layout_ = function () {
    const s = this.normalize(this.sizes),
      width = this.root.clientWidth,
      height = this.root.clientHeight;
    s.toolsWidth = clamp(
      s.toolsWidth,
      54,
      Math.max(54, Math.min(198, width - 430))
    );
    const columns =
      document.querySelectorAll(".workspace-side:not(.workspace-side-empty)")
        .length || 1;
    s.sideWidth = clamp(
      s.sideWidth,
      170,
      Math.max(170, Math.min(420, (width - s.toolsWidth - 250) / columns))
    );
    s.frameHeight = clamp(
      s.frameHeight,
      94,
      Math.max(94, Math.min(280, height - 240))
    );
    s.layerHeight = clamp(
      s.layerHeight,
      80,
      Math.max(80, Math.min(650, height - s.frameHeight - 160))
    );
    const space = document.querySelector(".workspace-stack").clientWidth;
    s.layerWidth = clamp(s.layerWidth, Math.min(240, space), space);
    s.previewHeight = clamp(
      s.previewHeight,
      96,
      Math.max(96, Math.min(500, height - 210))
    );
    this.actual = s;
    const vars = {
      "--workspace-side-width": s.sideWidth,
      "--workspace-tools-width": s.toolsWidth,
      "--workspace-frame-height": s.frameHeight,
      "--workspace-layer-height": s.layerHeight,
      "--workspace-layer-width": s.layerWidth,
      "--workspace-preview-width": s.sideWidth - 10,
      "--workspace-preview-height": s.previewHeight,
      "--workspace-transform-height": s.transformHeight,
      "--workspace-palette-height": s.paletteHeight,
      "--workspace-fx-height": s.fxHeight
    };
    Object.entries(vars).forEach(([key, value]) =>
      this.root.style.setProperty(key, value + "px")
    );
    this.root.classList.toggle("workspace-narrow-tools", s.toolsWidth < 96);
    const preview = pskl.app.previewController;
    if (
      preview.viewportWidth !== s.sideWidth - 10 ||
      preview.viewportHeight !== s.previewHeight
    ) {
      preview.setViewportSize(s.sideWidth - 10, s.previewHeight);
    }
    pskl.app.workspaceController.render();
    pskl.app.drawingController.requestRelayout_();
    this.position_();
  };
  p.position_ = function () {
    if (!this.actual) {
      return;
    }
    Object.keys(defaults).forEach((key) => {
      const panel = this.panel(key),
        rect = panel.getBoundingClientRect(),
        b = this.handles[key];
      const vertical = key.includes("Width"),
        direction = this.direction(key);
      const edge = vertical
        ? direction > 0
          ? rect.right
          : rect.left
        : ["frameHeight", "layerHeight"].includes(key) && direction < 0
          ? rect.top
          : rect.bottom;
      const box = vertical
        ? [edge - 4, rect.top, 8, rect.height]
        : [rect.left, edge - 4, rect.width, 8];
      // Keep the tool grip on the canvas side of the fixed toolbar. Raising
      // every grip above the toolbar would also put them above Save/Import.
      if (key === "toolsWidth") {
        box[0] = direction > 0 ? rect.right : rect.left - 8;
      }
      const scroll = panel.closest(".right-panels-scroller"),
        view = scroll && scroll.getBoundingClientRect();
      b.hidden =
        !(this.drag && this.drag.key === key) &&
        ((key !== "sideWidth" && !!panel.closest(".workspace-collapsed")) ||
          !rect.width ||
          !rect.height ||
          (view && (edge - 4 < view.top || edge + 4 > view.bottom)));
      Object.assign(b.style, {
        left: box[0] + "px",
        top: box[1] + "px",
        width: box[2] + "px",
        height: box[3] + "px"
      });
      b.setAttribute("aria-valuemin", limits[key][0]);
      b.setAttribute("aria-valuemax", limits[key][1]);
      b.setAttribute("aria-valuenow", Math.round(this.actual[key]));
    });
  };
  p.reset = function (key) {
    this.sizes[key] = defaults[key];
    this.layout_();
    this.save();
  };
  p.save = function () {
    pskl.UserSettings.set(pskl.UserSettings.WORKSPACE_LAYOUT, {
      ...this.sizes
    });
  };
})();

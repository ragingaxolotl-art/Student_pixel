(function () {
  var ns = $.namespace("pskl.controller");
  var Layout = pskl.utils.WorkspaceLayout;
  var names = {
    tools: "Tools",
    preview: "Preview",
    transform: "Transform",
    palettes: "Palettes",
    studios: "Studios",
    gradient: "Dither gradient",
    options: "Layer options",
    frames: "Frames",
    layers: "Layers"
  };
  function element(tag, cls, parent) {
    var node = document.createElement(tag);
    node.className = cls;
    if (parent) {
      parent.append(node);
    }
    return node;
  }
  // Move live elements rather than rebuilding panels: drawing, selection and
  // unfinished effect edits stay with the existing controllers.
  function place(parent, nodes) {
    nodes.forEach(function (node, index) {
      if (parent.children[index] !== node) {
        parent.insertBefore(node, parent.children[index] || null);
      }
    });
  }
  ns.WorkspaceController = function () {};
  var proto = ns.WorkspaceController.prototype;
  proto.init = function () {
    this.state = Layout.defaults();
    try {
      this.state = Layout.normalize(
        JSON.parse(localStorage.getItem(Layout.storageKey))
      );
    } catch (_error) {
      // A damaged preference or blocked storage must never prevent editing.
    }
    this.root = document.querySelector("#main-wrapper");
    this.column = document.querySelector("#column-wrapper");
    this.canvas = this.column.querySelector(".main-column");
    this.coords = document.querySelector(".cursor-coordinates");
    this.panels = {
      tools: document.querySelector("#tool-section"),
      transform: document.querySelector(".transformations-container"),
      palettes: document.querySelector(".palettes-list-container"),
      studios: document.querySelector(".studio-panel"),
      gradient: document.querySelector("#dither-gradient-panel"),
      frames: document.querySelector(".frames-column"),
      layers: document.querySelector(".layers-column")
    };
    var preview = document.querySelector("#animated-preview-container");
    var options = document.querySelector("#layer-options");
    this.panels.preview = element("section", "workspace-preview-panel");
    this.panels.preview.append(preview);
    this.panels.options = element("section", "workspace-options-panel");
    this.panels.options.append(options);
    this.panels.options.hidden = options.hidden;
    this.docks = {};
    ["left", "right"].forEach(
      function (side) {
        var dock = element("div", "workspace-side");
        dock.dataset.dock = side;
        this.docks[side] = {
          root: dock,
          pin: element("div", "workspace-pin", dock),
          scroll: element("div", "right-panels-scroller", dock),
          footer: element("div", "workspace-footer", dock)
        };
        this.docks[side].scroll.setAttribute(
          "aria-label",
          side + " tool panels"
        );
      }.bind(this)
    );
    this.center = element("div", "workspace-center");
    ["top", "bottom"].forEach(
      function (side) {
        this.docks[side] = element("div", "workspace-stack", this.center);
        this.docks[side].dataset.dock = side;
      }.bind(this)
    );
    this.center.insertBefore(this.canvas, this.docks.bottom);
    this.column.replaceChildren(
      this.docks.left.root,
      this.center,
      this.docks.right.root
    );
    this.handles = {};
    this.collapseButtons = {};
    Object.keys(this.panels).forEach(this.addHandle.bind(this));
    this.status = element("div", "workspace-sr-only", this.root);
    this.status.setAttribute("role", "status");
    this.help = element("div", "workspace-sr-only", this.root);
    this.help.id = "workspace-drag-help";
    this.help.textContent =
      "Drag this handle to a highlighted edge. Click for placement options. " +
      "Arrow keys move the panel. Escape cancels. Layout saves in this browser.";
    this.root.classList.add("workspace-enabled");
    this.render();
    new MutationObserver(
      function () {
        this.panels.options.hidden = options.hidden;
        this.render();
      }.bind(this)
    ).observe(options, { attributes: true, attributeFilter: ["hidden"] });
    new ResizeObserver(this.positionTabs.bind(this)).observe(preview);
    window.addEventListener(
      "resize",
      function () {
        this.cancelDrag();
        this.closeMenu(false);
        this.render();
      }.bind(this)
    );
    window.addEventListener("blur", this.cancelDrag.bind(this));
    document.addEventListener("keydown", this.onEscape.bind(this), true);
    document.addEventListener(
      "pointerdown",
      function (event) {
        if (
          this.menu &&
          !this.menu.contains(event.target) &&
          event.target !== this.menuHandle
        ) {
          this.closeMenu(false);
        }
      }.bind(this)
    );
  };
  proto.addHandle = function (id) {
    var panel = this.panels[id];
    panel.dataset.workspacePanel = id;
    panel.classList.add("workspace-panel");
    var heading = panel.querySelector(":scope > .toolbox-title");
    if (!heading) {
      heading = element("div", "", panel);
      heading.textContent = names[id];
      panel.prepend(heading);
    }
    heading.classList.add("workspace-panel-title");
    Array.from(heading.childNodes)
      .filter(function (node) {
        return node.nodeType === 3 && node.textContent.trim();
      })
      .forEach(function (node) {
        var name = element("span", "workspace-panel-name");
        name.textContent = node.textContent.trim();
        node.replaceWith(name);
      });
    var button = element("button", "workspace-handle");
    button.type = "button";
    button.setAttribute("aria-label", "Move " + names[id] + " panel");
    button.setAttribute("aria-describedby", "workspace-drag-help");
    button.setAttribute("aria-haspopup", "dialog");
    button.setAttribute("aria-expanded", "false");
    button.title =
      "Drag to move " + names[id] + ". Click for placement options.";
    button.innerHTML =
      '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4h10M3 8h10M3 12h10"/></svg>';
    heading.prepend(button);
    this.handles[id] = button;
    button.addEventListener("pointerdown", this.startDrag.bind(this, id));
    button.addEventListener(
      "click",
      function (event) {
        if (this.suppressClick && event.detail !== 0) {
          this.suppressClick = false;
          return;
        }
        this.openMenu(id);
      }.bind(this)
    );
    button.addEventListener("keydown", this.onHandleKey.bind(this, id));
    var collapse = element("button", "workspace-collapse", heading);
    collapse.type = "button";
    collapse.dataset.workspaceCollapse = id;
    collapse.innerHTML =
      '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>';
    collapse.addEventListener(
      "click",
      function () {
        this.setCollapsed(id, this.state.collapsed.indexOf(id) === -1);
      }.bind(this)
    );
    collapse.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.stopPropagation();
      }
    });
    this.collapseButtons[id] = collapse;
  };
  proto.setCollapsed = function (id, collapsed) {
    this.commit(
      Layout.collapse(this.state, id, collapsed),
      names[id] + (collapsed ? " collapsed" : " expanded")
    );
  };
  proto.render = function () {
    var state = this.state;
    Object.keys(this.panels).forEach(
      function (id) {
        var collapsed = state.collapsed.indexOf(id) !== -1,
          button = this.collapseButtons[id];
        this.panels[id].classList.toggle("workspace-collapsed", collapsed);
        button.setAttribute("aria-expanded", String(!collapsed));
        button.setAttribute(
          "aria-label",
          (collapsed ? "Expand " : "Collapse ") + names[id] + " panel"
        );
        button.title = (collapsed ? "Expand " : "Collapse ") + names[id];
      }.bind(this)
    );
    var compact = window.innerWidth < 1000;
    var visibleSides = ["left", "right"];
    visibleSides.forEach(
      function (side) {
        var effective = compact ? state.preview : side;
        var ids = compact
          ? effective === side
            ? state.left.concat(state.right)
            : []
          : state[side];
        var dock = this.docks[side];
        var pinned = side === state.preview;
        if (pinned) {
          place(dock.pin, [this.panels.preview]);
          place(dock.footer, [this.coords]);
        }
        place(
          dock.scroll,
          ids.map(
            function (id) {
              return this.panels[id];
            }.bind(this)
          )
        );
        var occupied =
          pinned ||
          ids.some(
            function (id) {
              return !this.panels[id].hidden;
            }.bind(this)
          );
        dock.root.classList.toggle("workspace-side-empty", !occupied);
      }.bind(this)
    );
    // Remove stale children after crossing columns, including an empty preview
    // slot. append/insertBefore retains the panel's event handlers and data.
    visibleSides.forEach(
      function (side) {
        if (side !== state.preview) {
          this.docks[side].pin.replaceChildren();
          this.docks[side].footer.replaceChildren();
        }
      }.bind(this)
    );
    ["top", "bottom"].forEach(
      function (zone) {
        place(
          this.docks[zone],
          state[zone].map(
            function (id) {
              return this.panels[id];
            }.bind(this)
          )
        );
      }.bind(this)
    );
    var toolsWidth =
      state.collapsed.indexOf("tools") !== -1
        ? "54px"
        : this.root.style.getPropertyValue("--workspace-tools-width") ||
          "100px";
    this.column.style.left = state.tools === "left" ? toolsWidth : "0";
    this.column.style.right =
      state.tools === "right" ? "calc(50px + " + toolsWidth + ")" : "50px";
    var rect = this.root.getBoundingClientRect();
    var tools = this.panels.tools;
    tools.style.left = state.tools === "left" ? "0" : "auto";
    tools.style.right = state.tools === "right" ? "50px" : "auto";
    tools.style.top = rect.top + "px";
    tools.style.bottom = window.innerHeight - rect.bottom + "px";
    this.root.classList.toggle("workspace-compact", compact);
    this.positionTabs();
    if (pskl.app.workspaceSizeController) {
      pskl.app.workspaceSizeController.position_();
    }
    pskl.app.drawingController.requestRelayout_();
  };
  proto.positionTabs = function () {
    if (pskl.app.layersListController) {
      pskl.app.layersListController.positionPreviewTabs();
    }
  };
  proto.commit = function (next, message) {
    this.state = next;
    this.render();
    try {
      localStorage.setItem(Layout.storageKey, JSON.stringify(next));
      this.status.textContent = message + ". Layout saved.";
    } catch (_error) {
      this.status.textContent =
        message +
        ". Browser storage is unavailable; layout lasts for this visit.";
    }
  };
  proto.move = function (id, zone, before) {
    this.commit(
      Layout.move(this.state, id, zone, before),
      names[id] + " moved to " + zone
    );
    this.handles[id].focus({ preventScroll: true });
  };
  proto.shift = function (id, direction) {
    var zone = Layout.zone(this.state, id);
    var items = this.state[zone];
    var index = items.indexOf(id);
    if (direction < 0 && index > 0) {
      this.move(id, zone, items[index - 1]);
    } else if (direction > 0 && index < items.length - 1) {
      this.move(id, zone, items[index + 2]);
    }
  };
  proto.onHandleKey = function (id, event) {
    var zone = { ArrowLeft: "left", ArrowRight: "right" }[event.key];
    if (zone && Layout.allowed(id).indexOf(zone) !== -1) {
      event.preventDefault();
      event.stopPropagation();
      this.move(id, zone);
    } else if (
      (event.key === "ArrowUp" || event.key === "ArrowDown") &&
      id !== "preview" &&
      id !== "tools"
    ) {
      event.preventDefault();
      event.stopPropagation();
      var direction = event.key === "ArrowUp" ? -1 : 1;
      var current = Layout.zone(this.state, id);
      var items = this.state[current];
      if (
        Layout.allowed(id)[0] === "top" &&
        ((direction < 0 && items.indexOf(id) === 0) ||
          (direction > 0 && items.indexOf(id) === items.length - 1))
      ) {
        this.move(id, direction < 0 ? "top" : "bottom");
      } else {
        this.shift(id, direction);
      }
    }
  };
  proto.openMenu = function (id) {
    var alreadyOpen = this.menuHandle === this.handles[id];
    this.closeMenu(false);
    if (alreadyOpen) {
      return;
    }
    var menu = element("div", "workspace-placement-menu", document.body);
    menu.setAttribute("role", "dialog");
    menu.setAttribute("aria-label", names[id] + " placement");
    var title = element("strong", "", menu);
    title.textContent = names[id] + " placement";
    var add = function (label, callback, disabled) {
      var button = element("button", "", menu);
      button.type = "button";
      button.textContent = label;
      button.disabled = !!disabled;
      button.onclick = function () {
        this.closeMenu(false);
        callback();
      }.bind(this);
    }.bind(this);
    Layout.allowed(id).forEach(
      function (zone) {
        add(
          "Dock " + zone,
          this.move.bind(this, id, zone),
          Layout.zone(this.state, id) === zone
        );
      }.bind(this)
    );
    add(
      this.state.collapsed.indexOf(id) !== -1
        ? "Expand panel"
        : "Collapse panel",
      this.setCollapsed.bind(this, id, this.state.collapsed.indexOf(id) === -1)
    );
    if (id !== "tools" && id !== "preview") {
      var items = this.state[Layout.zone(this.state, id)];
      add("Move up", this.shift.bind(this, id, -1), items.indexOf(id) === 0);
      add(
        "Move down",
        this.shift.bind(this, id, 1),
        items.indexOf(id) === items.length - 1
      );
    }
    if (id === "preview") {
      element("p", "", menu).textContent =
        "Preview stays pinned above the scrolling panels.";
    }
    if (window.innerWidth < 1000) {
      element("p", "", menu).textContent =
        "Side panels share the Preview column on narrow screens. Your wider layout is saved.";
    }
    add(
      "Reset layout",
      function () {
        this.commit(Layout.defaults(), "Default layout restored");
        this.handles[id].focus({ preventScroll: true });
      }.bind(this)
    );
    this.menu = menu;
    this.menuHandle = this.handles[id];
    this.menuHandle.setAttribute("aria-expanded", "true");
    var rect = this.menuHandle.getBoundingClientRect();
    menu.style.left =
      Math.max(
        4,
        Math.min(rect.left, window.innerWidth - menu.offsetWidth - 4)
      ) + "px";
    menu.style.top =
      Math.max(
        4,
        Math.min(rect.bottom, window.innerHeight - menu.offsetHeight - 4)
      ) + "px";
    menu.querySelector("button:not(:disabled)").focus();
  };
  proto.closeMenu = function (restoreFocus) {
    if (this.menu) {
      this.menu.remove();
      this.menuHandle.setAttribute("aria-expanded", "false");
      if (restoreFocus) {
        this.menuHandle.focus({ preventScroll: true });
      }
      this.menu = null;
      this.menuHandle = null;
    }
  };
  proto.onEscape = function (event) {
    if (event.key === "Escape" && (this.drag || this.menu)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.cancelDrag();
      this.closeMenu(true);
    }
  };
  proto.startDrag = function (id, event) {
    if (event.button !== 0 || !event.isPrimary) {
      return;
    }
    this.closeMenu(false);
    this.suppressClick = false;
    var handle = this.handles[id];
    this.drag = { id: id, x: event.clientX, y: event.clientY, handle: handle };
    handle.setPointerCapture(event.pointerId);
    this.onMove = this.dragMove.bind(this);
    this.onUp = this.finishDrag.bind(this);
    this.onCancel = this.cancelDrag.bind(this);
    handle.addEventListener("pointermove", this.onMove);
    handle.addEventListener("pointerup", this.onUp);
    handle.addEventListener("lostpointercapture", this.onCancel);
    handle.addEventListener("pointercancel", this.onCancel);
  };
  proto.dragZones = function (id) {
    var root = this.root.getBoundingClientRect();
    var center = this.center.getBoundingClientRect();
    return Layout.allowed(id).map(
      function (zone) {
        if (zone === "left" || zone === "right") {
          var isLeft = zone === "left";
          var offset =
            this.state.tools === zone
              ? this.panels.tools.getBoundingClientRect().width
              : 0;
          return {
            zone: zone,
            x: isLeft ? root.left + offset : root.right - 50 - offset - 210,
            y: root.top,
            width: 210,
            height: root.height
          };
        }
        var size = Math.min(
          center.height / 2,
          Math.max(88, this.docks[zone].getBoundingClientRect().height)
        );
        var bleedLeft =
          parseFloat(
            this.center.style.getPropertyValue("--workspace-bleed-left")
          ) || 0;
        var bleedRight =
          parseFloat(
            this.center.style.getPropertyValue("--workspace-bleed-right")
          ) || 0;
        return {
          zone: zone,
          x: center.left - bleedLeft,
          y: zone === "top" ? center.top : center.bottom - size,
          width: center.width + bleedLeft + bleedRight,
          height: size
        };
      }.bind(this)
    );
  };
  proto.dragMove = function (event) {
    var drag = this.drag;
    if (!drag) {
      return;
    }
    if (!drag.overlay) {
      if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 5) {
        return;
      }
      drag.overlay = element("div", "workspace-drop-overlay", document.body);
      drag.zones = this.dragZones(drag.id);
      drag.zones.forEach(function (zone) {
        zone.node = element("div", "workspace-drop-zone", drag.overlay);
        zone.node.dataset.dropZone = zone.zone;
        zone.node.textContent = "Dock " + zone.zone;
        Object.assign(zone.node.style, {
          left: zone.x + "px",
          top: zone.y + "px",
          width: zone.width + "px",
          height: zone.height + "px"
        });
      });
      drag.label = element("div", "workspace-drag-label", drag.overlay);
      drag.line = element("div", "workspace-drop-line", drag.overlay);
      this.panels[drag.id].classList.add("workspace-drag-source");
      document.body.classList.add("workspace-dragging");
    }
    event.preventDefault();
    var target = drag.zones.find(function (zone) {
      return (
        event.clientX >= zone.x &&
        event.clientX <= zone.x + zone.width &&
        event.clientY >= zone.y &&
        event.clientY <= zone.y + zone.height
      );
    });
    drag.target = target ? { zone: target.zone } : null;
    drag.zones.forEach(function (zone) {
      zone.node.classList.toggle("workspace-drop-active", zone === target);
    });
    drag.line.hidden = true;
    if (target && drag.id !== "preview" && drag.id !== "tools") {
      var dock = this.docks[target.zone];
      var parent = dock.scroll || dock;
      // Auto-scroll a tall side panel stack while dragging near its edges.
      if (dock.scroll) {
        var scrollRect = parent.getBoundingClientRect();
        if (event.clientY > scrollRect.bottom - 30) {
          parent.scrollTop += 18;
        } else if (event.clientY < scrollRect.top + 30) {
          parent.scrollTop -= 18;
        }
      }
      var candidates = Array.from(parent.children).filter(function (panel) {
        return panel.dataset.workspacePanel !== drag.id && !panel.hidden;
      });
      var before = candidates.find(function (panel) {
        var rect = panel.getBoundingClientRect();
        return event.clientY < rect.top + rect.height / 2;
      });
      drag.target.before = before ? before.dataset.workspacePanel : undefined;
      var lineRect = before
        ? before.getBoundingClientRect()
        : candidates.length
          ? candidates[candidates.length - 1].getBoundingClientRect()
          : parent.getBoundingClientRect();
      drag.line.hidden = false;
      drag.line.style.left = target.x + "px";
      drag.line.style.width = target.width + "px";
      drag.line.style.top =
        Math.max(
          target.y,
          Math.min(
            target.y + target.height - 3,
            before ? lineRect.top : lineRect.bottom
          )
        ) + "px";
    }
    drag.label.textContent = target
      ? names[drag.id] +
        " → " +
        target.zone +
        (drag.target.before ? " · before " + names[drag.target.before] : "")
      : "Move to a highlighted edge · Escape to cancel";
    drag.label.style.left =
      Math.max(4, Math.min(event.clientX + 12, window.innerWidth - 300)) + "px";
    drag.label.style.top =
      Math.max(4, Math.min(event.clientY + 16, window.innerHeight - 40)) + "px";
  };
  proto.finishDrag = function () {
    var drag = this.drag;
    var target = drag && drag.overlay && drag.target;
    this.cancelDrag();
    if (target) {
      this.move(drag.id, target.zone, target.before);
    }
  };
  proto.cancelDrag = function () {
    var drag = this.drag;
    if (!drag) {
      return;
    }
    drag.handle.removeEventListener("pointermove", this.onMove);
    drag.handle.removeEventListener("pointerup", this.onUp);
    drag.handle.removeEventListener("lostpointercapture", this.onCancel);
    drag.handle.removeEventListener("pointercancel", this.onCancel);
    if (drag.overlay) {
      drag.overlay.remove();
      this.suppressClick = true;
    }
    this.panels[drag.id].classList.remove("workspace-drag-source");
    document.body.classList.remove("workspace-dragging");
    this.drag = null;
  };
})();

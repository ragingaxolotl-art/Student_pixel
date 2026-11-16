(function () {
  const ns = pskl.controller.dialogs;
  ["PuppetStudioDialogController", "ParticleStudioDialogController"].forEach(
    function (name) {
      const p = ns[name].prototype,
        init = p.init,
        destroy = p.destroy;
      p.init = function () {
        init.apply(this, arguments);
        const root = this.wrapper,
          key = "studio-panels-" + name;
        let saved = {};
        try {
          saved = JSON.parse(localStorage.getItem(key)) || {};
        } catch (_) {}
        const specs = name.startsWith("Puppet")
          ? [
              [".extra-tools-viewer", "Canvas"],
              [".puppet-mini", "Preview"],
              [".puppet-hierarchy", "Hierarchy"],
              [".puppet-options", "Options"],
              [".puppet-tools", "Tools"],
              [".puppet-timeline", "Timeline"]
            ]
          : [
              [".particle-viewer", "Canvas"],
              [".particle-layers", "Layers"],
              [".particle-properties", "Options"],
              [".particle-timeline", "Timeline"]
            ];
        const panels = [];
        const persist = () => {
          try {
            localStorage.setItem(key, JSON.stringify(saved));
          } catch (_) {}
        };
        const place = (el, box) => {
          Object.assign(el.style, {
            position: "fixed",
            left: Math.max(0, Math.min(innerWidth - 100, box.x)) + "px",
            top: Math.max(0, Math.min(innerHeight - 50, box.y)) + "px",
            width: Math.max(180, Math.min(innerWidth, box.width)) + "px",
            height:
              Math.max(100, Math.min(innerHeight - 20, box.height)) + "px",
            zIndex: "20000",
            resize: "both",
            overflow: "auto",
            display: "block",
            boxSizing: "border-box",
            background: "#292929",
            border: "1px solid #777"
          });
          el.dataset.studioFloating = "true";
        };
        specs.forEach(([selector, label]) => {
          const el = root.querySelector(selector);
          if (!el) {
            return;
          }
          const original = el.getAttribute("style");
          panels.push({ el, original });
          const handle = document.createElement("button");
          handle.type = "button";
          handle.className = "studio-panel-handle";
          handle.textContent = "⠿ Move / resize " + label;
          handle.title =
            "Drag to detach and move. Resize from the bottom-right corner.";
          handle.setAttribute("aria-label", "Move studio " + label + " panel");
          el.prepend(handle);
          if (saved[label]) {
            place(el, saved[label]);
          }
          handle.addEventListener("pointerdown", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const b = el.getBoundingClientRect();
            place(el, { x: b.x, y: b.y, width: b.width, height: b.height });
            const start = { x: e.clientX, y: e.clientY, left: b.x, top: b.y };
            handle.setPointerCapture(e.pointerId);
            const move = (e) => {
              place(el, {
                x: start.left + e.clientX - start.x,
                y: start.top + e.clientY - start.y,
                width: el.offsetWidth,
                height: el.offsetHeight
              });
            };
            const end = () => {
              const b = el.getBoundingClientRect();
              saved[label] = {
                x: b.x,
                y: b.y,
                width: b.width,
                height: b.height
              };
              persist();
              handle.removeEventListener("pointermove", move);
              handle.removeEventListener("pointerup", end);
              handle.removeEventListener("pointercancel", end);
            };
            handle.addEventListener("pointermove", move);
            handle.addEventListener("pointerup", end);
            handle.addEventListener("pointercancel", end);
          });
        });
        this.studioPanelObserver = new ResizeObserver(() => {
          panels.forEach(({ el }, i) => {
            if (el.dataset.studioFloating) {
              const b = el.getBoundingClientRect();
              saved[specs[i][1]] = {
                x: b.x,
                y: b.y,
                width: b.width,
                height: b.height
              };
            }
          });
          persist();
        });
        panels.forEach(({ el }) => this.studioPanelObserver.observe(el));
        const reset = document.createElement("button");
        reset.type = "button";
        reset.className = "button";
        reset.textContent = "Reset panels";
        reset.onclick = () => {
          saved = {};
          persist();
          panels.forEach(({ el, original }) => {
            delete el.dataset.studioFloating;
            if (original === null) {
              el.removeAttribute("style");
            } else {
              el.setAttribute("style", original);
            }
          });
          window.dispatchEvent(new Event("resize"));
        };
        (
          root.querySelector(".puppet-window-heading,.particle-heading") || root
        ).append(reset);
      };
      p.destroy = function () {
        this.studioPanelObserver?.disconnect();
        return destroy.apply(this, arguments);
      };
    }
  );
})();

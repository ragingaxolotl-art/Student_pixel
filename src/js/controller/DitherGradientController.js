(function () {
  var ns = $.namespace("pskl.controller"),
    u = pskl.utils;
  ns.DitherGradientController = function (host) {
    this.host = host;
    this.root = document.querySelector("#dither-gradient-panel");
    this.button = host.root.querySelector("[data-dither-gradient]");
    this.open = false;
  };
  var p = ns.DitherGradientController.prototype;
  p.init = function () {
    this.button.addEventListener("click", () => {
      if (this.host.settings.fill !== "gradient") {
        this.host.settings.fill = "gradient";
        this.host.settings.paint = "bucket";
        this.open = true;
      } else {
        this.open = !this.open;
      }
      this.host.save_();
      this.reveal();
    });
    this.root.addEventListener("input", (e) => {
      if (e.target.dataset.stopField && e.target.dataset.stopField !== "at") {
        this.update_(e.target);
      }
    });
    this.root.addEventListener("change", (e) => {
      if (e.target.dataset.gradientField) {
        this.host.settings.gradient[e.target.dataset.gradientField] = Number(
          e.target.value
        );
        this.host.save_();
      } else if (e.target.dataset.stopField) {
        this.update_(e.target);
      }
    });
    this.root.addEventListener("click", (e) => {
      var button = e.target.closest("[data-gradient-action]");
      if (!button) {
        return;
      }
      var action = button.dataset.gradientAction,
        stops = this.host.settings.gradient.stops;
      if (action === "close") {
        this.open = false;
        this.render();
        return;
      }
      if (action === "add" && stops.length < 8) {
        var at = 1;
        for (var i = 2; i < stops.length; i++) {
          if (stops[i].at - stops[i - 1].at > stops[at].at - stops[at - 1].at) {
            at = i;
          }
        }
        stops.splice(at, 0, {
          at: (stops[at].at + stops[at - 1].at) / 2,
          color: "#808080",
          opacity: 100
        });
      }
      if (action === "remove") {
        var index = Number(
          button.closest("[data-stop-index]").dataset.stopIndex
        );
        if (index > 0 && index < stops.length - 1) {
          stops.splice(index, 1);
        }
      }
      if (action === "colors") {
        var colors = pskl.app.selectedColorsService;
        this.host.settings.gradient.stops = [
          colors.getPrimaryColor(),
          colors.getSecondaryColor()
        ].map((color, i) => {
          var parsed = window.tinycolor(color);
          return {
            at: i * 100,
            color: parsed.toHexString(),
            opacity: Math.round(parsed.getAlpha() * 100)
          };
        });
      }
      this.host.save_();
    });
    this.root.addEventListener("keydown", (e) => {
      if (e.target.closest("input,select")) {
        e.stopPropagation();
      }
    });
  };
  p.reveal = function () {
    if (this.root.hidden) {
      return;
    }
    var scroller = this.root.closest(".right-panels-scroller");
    if (!scroller) {
      return;
    }
    var panel = this.root.getBoundingClientRect(),
      view = scroller.getBoundingClientRect();
    if (panel.height > view.height || panel.top < view.top) {
      scroller.scrollTop += panel.top - view.top;
    } else if (panel.bottom > view.bottom) {
      scroller.scrollTop += panel.bottom - view.bottom;
    }
  };
  p.update_ = function (input) {
    var index = Number(input.closest("[data-stop-index]").dataset.stopIndex),
      key = input.dataset.stopField;
    this.host.settings.gradient.stops[index][key] =
      key === "color" ? input.value : Number(input.value);
    this.host.save_();
  };
  p.render = function () {
    var settings = this.host.settings,
      stops = settings.gradient.stops,
      container = this.root.querySelector(".dither-gradient-stops");
    this.root.hidden =
      this.host.root.hidden || settings.fill !== "gradient" || !this.open;
    this.button.setAttribute(
      "aria-pressed",
      String(settings.fill === "gradient")
    );
    this.button.setAttribute("aria-expanded", String(!this.root.hidden));
    this.root.querySelectorAll("[data-gradient-field]").forEach((input) => {
      input.value = settings.gradient[input.dataset.gradientField];
    });
    if (container.children.length !== stops.length) {
      container.replaceChildren();
      stops.forEach((stop, i) => {
        var row = document.createElement("div");
        row.className = "gradient-stop";
        row.dataset.stopIndex = i;
        row.innerHTML =
          '<label>Color<input type="color" data-stop-field="color"></label><label>At %<input type="number" min="0" max="100" data-stop-field="at"></label><label>Opacity %<input type="number" min="0" max="100" data-stop-field="opacity"></label><button type="button" data-gradient-action="remove">×</button>';
        row.querySelectorAll("input").forEach((input) => {
          input.setAttribute(
            "aria-label",
            "Gradient stop " + (i + 1) + " " + input.dataset.stopField
          );
        });
        row
          .querySelector("button")
          .setAttribute("aria-label", "Remove gradient stop " + (i + 1));
        container.append(row);
      });
    }
    [...container.children].forEach((row, i) => {
      row.querySelectorAll("input").forEach((input) => {
        input.value = stops[i][input.dataset.stopField];
        input.disabled =
          input.dataset.stopField === "at" &&
          (i === 0 || i === stops.length - 1);
      });
      row.querySelector("button").disabled = i === 0 || i === stops.length - 1;
    });
    this.root.querySelector('[data-gradient-action="add"]').disabled =
      stops.length >= 8;
    var canvas = this.root.querySelector("canvas"),
      ctx = canvas.getContext("2d"),
      data = ctx.createImageData(canvas.width, canvas.height),
      pixels = new Uint32Array(data.data.buffer);
    for (var y = 0; y < canvas.height; y++) {
      for (var x = 0; x < canvas.width; x++) {
        pixels[y * canvas.width + x] = u.DitherPaintUtils.gradientColor(
          x,
          y,
          settings,
          { minX: 0, minY: 0, maxX: canvas.width - 1, maxY: canvas.height - 1 }
        );
      }
    }
    ctx.putImageData(data, 0, 0);
    if (pskl.app.workspaceController) {
      pskl.app.workspaceController.render();
    }
  };
})();

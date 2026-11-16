(function () {
  var ns = pskl.controller.dialogs,
    u = pskl.utils,
    clone = u.ToolStateUtils.clone;
  ns.ParticleStudioDialogController = function (controller) {
    this.controller = controller;
  };
  u.inherit(ns.ParticleStudioDialogController, ns.AbstractDialogController);
  var p = ns.ParticleStudioDialogController.prototype;
  p.init = function () {
    this.wrapper = document.querySelector(".particle-dialog");
    this.superclass.init.call(this);
    this.service = new pskl.service.ParticleStudioService(this.controller);
    this.canvas = this.wrapper.querySelector("canvas");
    this.overlay = this.wrapper.querySelector("svg");
    this.form = this.wrapper.querySelector("form");
    this.slider = this.wrapper.querySelector(
      '[aria-label="Particle animation frame"]'
    );
    this.status = this.wrapper.querySelector('[role="status"]');
    this.frame = 0;
    this.mode = "move";
    this.past = [];
    this.future = [];
    this.load();
    this.buildProperties();
    this.buildTiming();
    this.bindInteraction();
    this.bindWindow();
    this.addEventListener(this.wrapper, "click", function (event) {
      var button = event.target.closest("[data-particle-action],[data-mode]");
      if (!button) {
        return;
      }
      if (button.dataset.mode) {
        this.mode = button.dataset.mode;
        this.paint();
        return;
      }
      this.action(button.dataset.particleAction);
    });
    this.addEventListener(this.form, "submit", function (event) {
      event.preventDefault();
    });
    this.addEventListener(this.form, "focusin", function () {
      if (!this.fieldBefore) {
        this.fieldBefore = clone(this.config);
      }
    });
    this.addEventListener(this.form, "input", this.inputProperty);
    this.addEventListener(this.form, "change", function (event) {
      this.inputProperty(event);
      this.finishField();
      this.render();
    });
    this.addEventListener(this.slider, "input", function () {
      this.stop();
      this.frame = Number(this.slider.value);
      this.draw();
      this.drawTimeline();
    });
    this.addEventListener(
      this.wrapper.querySelector('[aria-label="Particle preview zoom"]'),
      "change",
      this.resizeCanvas
    );
    this.onReset = function () {
      if (!this.applying) {
        this.stop();
        this.load();
        this.past = [];
        this.future = [];
        this.fieldBefore = null;
        this.sync();
        this.render();
      }
    }.bind(this);
    $.subscribe(Events.PISKEL_RESET, this.onReset);
    this.observer = new ResizeObserver(this.resizeCanvas.bind(this));
    this.observer.observe(this.wrapper.querySelector(".particle-stage"));
    this.sync();
    this.render();
  };
  p.load = function () {
    this.project = this.controller.getPiskel();
    this.current = this.controller.getCurrentFrameIndex();
    try {
      this.config = u.ParticleStudioUtils.config(this.project);
    } catch (error) {
      var fallback = Object.create(this.project);
      fallback.toolState = {};
      this.config = u.ParticleStudioUtils.config(fallback);
      this.status.textContent =
        "Saved effect could not be opened: " + error.message;
    }
    if (!this.project.toolState.particleStudio) {
      var sourceAt = this.project.getLayers().findIndex(function (l) {
        return (
          l.toolState.kind !== "community-particles" &&
          !u.LayerGroupUtils.isGroup(l)
        );
      });
      this.config.emitters[0].sourceLayer = Math.max(0, sourceAt);
    }
    this.selected = this.config.emitters.some(
      function (e) {
        return e.id === this.selected;
      }.bind(this)
    )
      ? this.selected
      : this.config.emitters[0] && this.config.emitters[0].id;
    this.frame = Math.min(this.frame, this.config.frames - 1);
    var palette = pskl.app.paletteService.getPaletteById(
      pskl.UserSettings.get(pskl.UserSettings.SELECTED_PALETTE)
    );
    this.palette = palette ? palette.getColors() : [];
  };
  p.emitter = function () {
    return this.config.emitters.find(
      function (e) {
        return e.id === this.selected;
      }.bind(this)
    );
  };
  p.field = function (spec, parent) {
    var label = document.createElement("label"),
      input = document.createElement(
        spec.type === "select" ? "select" : "input"
      );
    label.append(document.createTextNode(spec.label));
    input.dataset.particleField = spec.key;
    input.setAttribute("aria-label", spec.label);
    if (spec.type === "select") {
      (spec.values || []).forEach(function (v) {
        input.add(
          new Option(Array.isArray(v) ? v[1] : v, Array.isArray(v) ? v[0] : v)
        );
      });
    } else {
      input.type = spec.type || "number";
      ["min", "max", "accept"].forEach(function (k) {
        if (spec[k] !== undefined) {
          input.setAttribute(k, spec[k]);
        }
      });
      if (input.type === "number") {
        input.step = [
          "count",
          "life",
          "trails",
          "sourceLayer",
          "frames",
          "seed",
          "warmup",
          "start",
          "end"
        ].includes(spec.key)
          ? "1"
          : "any";
      }
    }
    label.append(input);
    parent.append(label);
    return input;
  };
  p.button = function (label, action, parent) {
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.dataset.particleAction = action;
    parent.append(b);
    return b;
  };
  p.buildProperties = function () {
    var groups = [
        ["Animation", "frames seed warmup loop"],
        [
          "Emitter",
          "name enabled count life lifeJitter mode emission sourceLayer"
        ],
        ["Position & path", "x y areaWidth areaHeight followPath pathMode"],
        [
          "Motion",
          "direction spread speed speedJitter gravity wind drag turbulence orbit spin attractX attractY attract collision bounce"
        ],
        [
          "Appearance",
          "shape size sizeEnd colorStart colorMid colorEnd alphaStart alphaEnd trails blend palette alphaDither spriteMode tint"
        ]
      ],
      fields = u.ParticleStudioDefinition.fields.slice();
    fields.push(
      { key: "loop", label: "Loop animation", type: "checkbox" },
      {
        key: "pathMode",
        label: "Path moves",
        type: "select",
        values: [
          ["particle", "Each particle"],
          ["emitter", "Emitter over timeline"]
        ]
      }
    );
    groups.forEach(
      function (group, index) {
        var d = document.createElement("details"),
          s = document.createElement("summary");
        d.open = index < 3;
        s.textContent = group[0];
        d.append(s);
        group[1].split(" ").forEach(
          function (key) {
            this.field(
              fields.find(function (f) {
                return f.key === key;
              }),
              d
            );
          }.bind(this)
        );
        this.form.append(d);
        if (index === 2) {
          this.button("Clear path", "clear-path", d);
        }
      }.bind(this)
    );
    var presets = document.createElement("details"),
      title = document.createElement("summary");
    title.textContent = "Presets & files";
    presets.append(title);
    this.field(
      fields.find(function (f) {
        return f.key === "preset";
      }),
      presets
    );
    this.button("Load preset", "preset", presets);
    this.button("Export effect", "export", presets);
    this.field(
      fields.find(function (f) {
        return f.key === "files";
      }),
      presets
    );
    this.button("Import effect", "import", presets);
    this.button("Remove generated layer", "remove-output", presets);
    this.form.append(presets);
  };
  p.buildTiming = function () {
    var parent = this.wrapper.querySelector(".particle-timing");
    [
      ["start", "Emit from"],
      ["end", "to"]
    ].forEach(
      function (v) {
        var input = this.field(
          { key: v[0], label: v[1], min: 1, max: 120 },
          parent
        );
        this.addEventListener(input, "change", function () {
          this.change(function () {
            this.emitter()[v[0]] = Number(input.value) - 1;
          });
          this.sync();
        });
      }.bind(this)
    );
  };
  p.sync = function () {
    var e = this.emitter(),
      global = ["frames", "seed", "warmup", "loop"];
    this.form.querySelectorAll("[data-particle-field]").forEach(
      function (input) {
        var key = input.dataset.particleField;
        if (key === "files" || key === "preset") {
          return;
        }
        input.disabled = !e && !global.includes(key);
        if (key === "sourceLayer") {
          input.replaceChildren();
          this.project.getLayers().forEach(function (l, i) {
            if (
              l.toolState.kind !== "community-particles" &&
              !u.LayerGroupUtils.isGroup(l)
            ) {
              input.add(new Option(l.getName(), i));
            }
          });
          if (e && e.sourceId) {
            var at = this.project.getLayers().findIndex(function (l) {
              return l.toolState.id === e.sourceId;
            });
            if (at >= 0) {
              e.sourceLayer = at;
            }
          }
        }
        var value = global.includes(key) ? this.config[key] : e && e[key];
        if (input.type === "checkbox") {
          input.checked = !!value;
        } else {
          input.value = value === undefined ? "" : value;
        }
      }.bind(this)
    );
    this.wrapper.querySelectorAll(".particle-timing input").forEach(
      function (input) {
        input.disabled = !e;
        input.max = this.config.frames;
        input.value = e ? e[input.dataset.particleField] + 1 : 1;
      }.bind(this)
    );
    var list = this.wrapper.querySelector(".particle-emitter-list");
    list.replaceChildren();
    this.config.emitters
      .slice()
      .reverse()
      .forEach(
        function (emitter) {
          var row = document.createElement("div"),
            toggle = document.createElement("input"),
            button = document.createElement("button");
          row.className = "particle-emitter";
          row.dataset.emitterId = emitter.id;
          toggle.type = "checkbox";
          toggle.checked = emitter.enabled;
          toggle.setAttribute("aria-label", "Enable " + emitter.name);
          toggle.addEventListener(
            "change",
            function () {
              this.change(function () {
                emitter.enabled = toggle.checked;
              });
              this.sync();
            }.bind(this)
          );
          button.type = "button";
          button.textContent = emitter.name;
          button.setAttribute(
            "aria-pressed",
            String(emitter.id === this.selected)
          );
          button.addEventListener(
            "click",
            function () {
              this.finishField();
              this.selected = emitter.id;
              this.sync();
              this.paint();
            }.bind(this)
          );
          row.append(toggle, button);
          list.append(row);
        }.bind(this)
      );
    this.drawTimeline();
    this.paint();
  };
  p.inputProperty = function (event) {
    var input = event.target,
      key = input.dataset.particleField;
    if (!key || ["files", "preset"].includes(key)) {
      return;
    }
    if (!this.fieldBefore) {
      this.fieldBefore = clone(this.config);
    }
    var target = ["frames", "seed", "warmup", "loop"].includes(key)
      ? this.config
      : this.emitter();
    if (!target) {
      return;
    }
    target[key] =
      input.type === "checkbox"
        ? input.checked
        : input.type === "number" || key === "sourceLayer"
          ? Number(input.value)
          : input.value;
    if (["x", "y"].includes(key) && target.keys.length) {
      var original = this.fieldBefore.emitters.find(function (e) {
        return e.id === target.id;
      });
      target[key] = original[key];
      var position = u.ParticleTimelineUtils.position(target, this.frame);
      position[key] = Number(input.value);
      u.ParticleTimelineUtils.key(target, this.frame, position);
    }
    if (key === "sourceLayer") {
      target.sourceId =
        (this.project.getLayerAt(target[key]) || { toolState: {} }).toolState
          .id || null;
    }
    if (
      key === "frames" &&
      Number.isInteger(target[key]) &&
      target[key] >= 2 &&
      target[key] <= 120
    ) {
      this.config.emitters.forEach(function (e) {
        e.start = Math.min(e.start, target.frames - 1);
        e.end = Math.max(e.start, Math.min(e.end, target.frames - 1));
        e.keys = e.keys.filter(function (k) {
          return k.at < target.frames;
        });
      });
      this.frame = Math.min(this.frame, target.frames - 1);
      this.drawTimeline();
    }
    if (key === "name" || key === "enabled") {
      this.refreshEmitterLabels();
    }
    clearTimeout(this.renderTimer);
    this.renderTimer = setTimeout(this.render.bind(this), 50);
  };
  p.refreshEmitterLabels = function () {
    this.wrapper.querySelectorAll("[data-emitter-id]").forEach(
      function (row) {
        var e = this.config.emitters.find(function (e) {
          return e.id === row.dataset.emitterId;
        });
        if (e) {
          row.querySelector("button").textContent = e.name;
          var toggle = row.querySelector("input");
          toggle.checked = e.enabled;
          toggle.setAttribute("aria-label", "Enable " + e.name);
        }
      }.bind(this)
    );
  };
  p.push = function (before) {
    if (JSON.stringify(before) !== JSON.stringify(this.config)) {
      this.past.push(before);
      if (this.past.length > 64) {
        this.past.shift();
      }
      this.future = [];
    }
  };
  p.finishField = function () {
    if (this.fieldBefore) {
      this.push(this.fieldBefore);
      this.fieldBefore = null;
    }
  };
  p.change = function (fn) {
    this.finishField();
    var before = clone(this.config);
    try {
      fn.call(this);
      u.ParticleStudioUtils.validate(this.config);
      this.push(before);
      this.render();
    } catch (error) {
      this.config = before;
      this.status.textContent = error.message;
      this.sync();
    }
  };
  p.undo = function (redo) {
    this.stop();
    this.finishField();
    var from = redo ? this.future : this.past,
      to = redo ? this.past : this.future;
    if (from.length) {
      to.push(clone(this.config));
      this.config = from.pop();
      this.selected = this.config.emitters.some(
        function (e) {
          return e.id === this.selected;
        }.bind(this)
      )
        ? this.selected
        : this.config.emitters[0] && this.config.emitters[0].id;
      this.sync();
      this.render();
    } else {
      pskl.app.historyService[redo ? "redo" : "undo"]();
    }
  };
  p.action = async function (name) {
    try {
      this.finishField();
      var e = this.emitter();
      if (name === "undo" || name === "redo") {
        return this.undo(name === "redo");
      }
      if (name === "cancel") {
        return this.closeDialog();
      }
      if (name === "play") {
        if (this.playing) {
          return this.stop();
        }
        if (!this.engine) {
          return;
        }
        this.playing = setInterval(
          function () {
            if (this.frame >= this.config.frames - 1 && !this.config.loop) {
              this.stop();
              return;
            }
            this.frame = (this.frame + 1) % this.config.frames;
            this.draw();
            this.drawTimeline();
          }.bind(this),
          1000 / this.project.getFPS()
        );
        return;
      }
      if (name === "export") {
        u.ParticleStudioUtils.validate(this.config);
        u.PuppetExportUtils.json(this.config, "particle-effect");
        return;
      }
      if (name === "import") {
        var file = this.form.querySelector('input[type="file"]').files[0];
        if (!file || file.size > 1048576) {
          throw new Error("Choose an effect JSON smaller than 1 MB.");
        }
        var value = JSON.parse(await file.text()),
          normalized = u.ParticleStudioUtils.config({
            toolState: { particleStudio: value }
          });
        u.ParticleStudioUtils.validate(normalized);
        new u.ParticleStudioEngine(
          this.project,
          normalized,
          this.current,
          this.palette
        );
        this.change(function () {
          this.config = normalized;
          this.selected = normalized.emitters[0] && normalized.emitters[0].id;
        });
        this.sync();
        return;
      }
      if (["save", "generate", "remove-output"].includes(name)) {
        u.ParticleStudioUtils.validate(this.config);
        new u.ParticleStudioEngine(
          this.project,
          this.config,
          this.current,
          this.palette
        );
        this.stop();
        this.applying = true;
        try {
          if (name === "remove-output") {
            this.service.removeOutput();
          } else {
            this.service.commit(
              this.config,
              name === "generate",
              this.current,
              this.palette
            );
          }
        } finally {
          this.applying = false;
        }
        this.past = [];
        this.future = [];
        this.load();
        this.sync();
        this.render();
        this.status.textContent =
          name === "generate"
            ? "Generated Particle FX. Original artwork is preserved."
            : name === "save"
              ? "Effect saved in this project. Save the .piskel file to keep it."
              : "Generated layer removed.";
        return;
      }
      this.change(function () {
        if (name === "add") {
          if (this.config.emitters.length >= 8) {
            throw new Error("Use up to eight emitters.");
          }
          var layer = this.project.getLayers().findIndex(function (l) {
            return (
              l.toolState.kind !== "community-particles" &&
              !u.LayerGroupUtils.isGroup(l)
            );
          });
          var added = Object.assign(
            u.ParticleStudioUtils.preset(
              "fire",
              this.project.getWidth(),
              this.project.getHeight()
            ),
            {
              id: u.Uuid.generate(),
              start: 0,
              end: this.config.frames - 1,
              keys: [],
              path: [],
              pathMode: "particle",
              sourceLayer: Math.max(0, layer)
            }
          );
          this.config.emitters.push(added);
          this.selected = added.id;
          return;
        }
        if (!e) {
          throw new Error("Add an emitter first.");
        }
        var at = this.config.emitters.indexOf(e);
        if (name === "delete") {
          this.config.emitters.splice(at, 1);
          this.selected = (this.config.emitters[0] || {}).id;
        }
        if (name === "up" || name === "down") {
          var next = Math.max(
            0,
            Math.min(
              this.config.emitters.length - 1,
              at + (name === "up" ? 1 : -1)
            )
          );
          this.config.emitters.splice(at, 1);
          this.config.emitters.splice(next, 0, e);
        }
        if (name === "preset") {
          Object.assign(
            e,
            u.ParticleStudioUtils.preset(
              this.form.querySelector('[data-particle-field="preset"]').value,
              this.project.getWidth(),
              this.project.getHeight()
            ),
            { path: [], keys: [], start: 0, end: this.config.frames - 1 }
          );
        }
        if (name === "clear-path") {
          e.path = [];
          e.followPath = false;
        }
        if (name === "key") {
          u.ParticleTimelineUtils.key(
            e,
            this.frame,
            u.ParticleTimelineUtils.position(e, this.frame)
          );
        }
        if (name === "delete-key") {
          e.keys = e.keys.filter(
            function (k) {
              return k.at !== this.frame;
            }.bind(this)
          );
        }
      });
      this.sync();
    } catch (error) {
      this.status.textContent = error.message;
    }
  };
  p.render = function () {
    clearTimeout(this.renderTimer);
    try {
      this.engine = new u.ParticleStudioEngine(
        this.project,
        clone(this.config),
        this.current,
        this.palette
      );
      if (this.previewError) {
        this.status.textContent = "";
      }
      this.previewError = false;
      this.draw();
    } catch (error) {
      this.engine = null;
      this.previewError = true;
      this.status.textContent = error.message;
      this.draw();
    }
  };
  p.draw = function () {
    var source = this.project,
      layers = source.getLayers().filter(function (l) {
        return l.toolState.kind !== "community-particles";
      }),
      index = Math.min(this.frame, source.getFrameCount() - 1);
    var views = layers
      .filter(function (layer) {
        return (
          !u.LayerGroupUtils.isGroup(layer) &&
          !u.LayerGroupUtils.hidden(source.getLayers(), layer)
        );
      })
      .map(function (layer) {
        var view = Object.create(layer);
        view.opacity = u.LayerGroupUtils.opacity(
          source.getLayers(),
          layer,
          true
        );
        return view;
      });
    var image = u.LayerUtils.flattenFrameAt(
      views,
      index,
      true,
      source.getLayers(),
      source.getLayerAt(0).getFrameAt(index)
    );
    this.canvas.width = source.getWidth();
    this.canvas.height = source.getHeight();
    var context = this.canvas.getContext("2d");
    context.drawImage(image, 0, 0);
    if (this.engine) {
      context.drawImage(
        u.FrameUtils.toImage(this.engine.render(this.frame)),
        0,
        0
      );
    }
    var emitter = this.emitter();
    if (emitter) {
      var position = u.ParticleTimelineUtils.position(emitter, this.frame);
      ["x", "y"].forEach(
        function (key) {
          var input = this.form.querySelector(
            '[data-particle-field="' + key + '"]'
          );
          if (document.activeElement !== input) {
            input.value = Number(position[key].toFixed(3));
          }
        }.bind(this)
      );
    }
    this.resizeCanvas();
    this.paint();
  };
  p.resizeCanvas = function () {
    if (!this.canvas || !this.canvas.width) {
      return;
    }
    var stage = this.wrapper.querySelector(".particle-stage"),
      zoom = this.wrapper.querySelector(
        '[aria-label="Particle preview zoom"]'
      ).value,
      scale =
        zoom === "fit"
          ? Math.max(
              0.05,
              Math.min(
                (stage.clientWidth - 28) / this.canvas.width,
                (stage.clientHeight - 28) / this.canvas.height
              )
            )
          : Number(zoom);
    if (zoom === "fit" && scale >= 1) {
      scale = Math.max(1, Math.floor(scale));
    }
    this.canvas.style.width = this.canvas.width * scale + "px";
    this.canvas.style.height = this.canvas.height * scale + "px";
    this.paint();
  };
  p.paint = function () {
    if (!this.overlay) {
      return;
    }
    this.overlay.replaceChildren();
    this.overlay.setAttribute(
      "viewBox",
      "0 0 " + this.canvas.clientWidth + " " + this.canvas.clientHeight
    );
    var e = this.emitter();
    this.wrapper.querySelectorAll("[data-mode]").forEach(
      function (b) {
        b.setAttribute("aria-pressed", String(b.dataset.mode === this.mode));
      }.bind(this)
    );
    if (!e) {
      return;
    }
    var sx = this.canvas.clientWidth / this.canvas.width,
      sy = this.canvas.clientHeight / this.canvas.height;
    function node(tag, attrs) {
      var n = document.createElementNS("http://www.w3.org/2000/svg", tag);
      Object.keys(attrs).forEach(function (k) {
        n.setAttribute(k, attrs[k]);
      });
      this.overlay.append(n);
      return n;
    }
    node = node.bind(this);
    if (e.path && e.path.length) {
      node("polyline", {
        points: e.path
          .map(function (p) {
            return p.x * sx + "," + p.y * sy;
          })
          .join(" "),
        fill: "none",
        stroke: "#6cddff",
        "stroke-width": 2
      });
      if (this.mode === "edit") {
        e.path.forEach(function (point, i) {
          var n = node("circle", {
            cx: point.x * sx,
            cy: point.y * sy,
            r: 4,
            fill: "#6cddff",
            stroke: "#222",
            "data-point": i,
            tabindex: 0,
            role: "button",
            "aria-label": "Particle path point " + (i + 1)
          });
          n.style.pointerEvents = "auto";
        });
      }
    }
    var pos = this.emitterPosition(e),
      x = pos.x * sx,
      y = pos.y * sy;
    node("circle", {
      cx: x,
      cy: y,
      r: 7,
      fill: "none",
      stroke: "#ffe600",
      "stroke-width": 2
    });
    node("path", {
      d: "M" + (x - 11) + "," + y + "h22M" + x + "," + (y - 11) + "v22",
      stroke: "#ffe600",
      "stroke-width": 1
    });
    if (this.mode === "size") {
      node("circle", {
        cx: x + e.size * sx,
        cy: y,
        r: 5,
        fill: "#ffe600",
        stroke: "#222"
      });
    }
    this.wrapper.querySelector('[data-particle-action="play"]').textContent =
      this.playing ? "Ⅱ" : "▶";
  };
  p.emitterPosition = function (e) {
    var pos = u.ParticleTimelineUtils.position(e, this.frame);
    if (e.followPath && e.pathMode === "emitter" && e.path.length > 1) {
      var p = u.ParticleTimelineUtils.route(
        e,
        this.frame / (this.config.frames - 1)
      );
      pos.x += p.x - e.x;
      pos.y += p.y - e.y;
    }
    return pos;
  };
  p.drawTimeline = function () {
    this.frame = Math.max(0, Math.min(this.frame, this.config.frames - 1));
    this.slider.max = this.config.frames - 1;
    this.slider.value = this.frame;
    this.wrapper.querySelector("[data-particle-frame]").textContent =
      "Frame " + (this.frame + 1) + " / " + this.config.frames;
    var track = this.wrapper.querySelector(".particle-track"),
      e = this.emitter();
    track.replaceChildren();
    track.style.backgroundSize = 100 / (this.config.frames - 1) + "% 100%";
    if (e) {
      var range = document.createElement("span");
      range.className = "particle-emission-range";
      range.style.left = (e.start / (this.config.frames - 1)) * 100 + "%";
      range.style.width =
        ((e.end - e.start) / (this.config.frames - 1)) * 100 + "%";
      track.append(range);
    }
    var playhead = document.createElement("span");
    playhead.className = "particle-playhead";
    playhead.style.left = (this.frame / (this.config.frames - 1)) * 100 + "%";
    track.append(playhead);

    ((e && e.keys) || []).forEach(
      function (key) {
        var b = document.createElement("button");
        b.type = "button";
        b.draggable = true;
        b.style.left = (key.at / (this.config.frames - 1)) * 100 + "%";
        b.setAttribute("aria-label", "Emitter key frame " + (key.at + 1));
        b.addEventListener(
          "click",
          function () {
            this.stop();
            this.frame = key.at;
            this.draw();
            this.drawTimeline();
          }.bind(this)
        );
        b.addEventListener(
          "dragstart",
          function (event) {
            this.keyDragging = key.at;
            event.dataTransfer.setData("text/plain", String(key.at));
          }.bind(this)
        );
        b.addEventListener(
          "keydown",
          function (event) {
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              this.retime(
                key.at,
                key.at + (event.key === "ArrowLeft" ? -1 : 1)
              );
            }
          }.bind(this)
        );
        track.append(b);
      }.bind(this)
    );
  };
  p.retime = function (from, to) {
    this.change(function () {
      var e = this.emitter();
      if (
        to < 0 ||
        to >= this.config.frames ||
        e.keys.some(function (k) {
          return k.at === to;
        })
      ) {
        throw new Error("Choose an empty frame within the timeline.");
      }
      var key = e.keys.find(function (k) {
        return k.at === from;
      });
      if (key) {
        key.at = to;
      }
      e.keys.sort(function (a, b) {
        return a.at - b.at;
      });
    });
    this.sync();
  };
  p.stop = function () {
    clearInterval(this.playing);
    this.playing = null;
    if (this.overlay) {
      this.paint();
    }
  };
  p.destroy = function () {
    $.unsubscribe(Events.PISKEL_RESET, this.onReset);
    this.stop();
    clearTimeout(this.renderTimer);
    if (this.observer) {
      this.observer.disconnect();
    }
    this.wrapper.parentElement.style.cssText = this.originalWindowStyle || "";
    this.superclass.destroy.call(this);
  };
})();

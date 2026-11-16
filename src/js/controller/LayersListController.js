(function () {
  var ns = $.namespace("pskl.controller");
  var icons = {
    drag: '<path d="M4 5h12M4 10h12M4 15h12"/>',
    edit: '<path d="m4 13 8-8 3 3-8 8-4 1zM11 6l3 3"/>',
    lock: '<rect x="4" y="9" width="12" height="9" rx="1"/><path d="M7 9V6a3 3 0 0 1 6 0v3"/>',
    unlock:
      '<rect x="4" y="9" width="12" height="9" rx="1"/><path d="M7 9V6a3 3 0 0 1 6-1"/>',
    eye: '<path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z"/><circle cx="10" cy="10" r="2"/>',
    hidden: '<path d="m2 2 16 16M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z"/>',
    merge: '<path d="M10 2v11m-4-4 4 4 4-4M3 17h14"/>',
    subtract: '<path d="M4 10h12"/>',
    fx: '<path d="M4 16V5h7M4 10h5m3 1 5 5m0-5-5 5"/>',
    delete: '<path d="m4 4 12 12M16 4 4 16"/>'
  };
  var manipulations = {
    subtract: "Subtract overlap",
    add: "Add / union",
    xor: "Exclude overlap (XOR)",
    intersect: "Keep overlap / mask",
    inverseMask: "Other layer outside this layer",
    invertOverlap: "Invert colors in overlap",
    lift: "Lift overlap to a new layer"
  };
  var effects = {
    none: "Opacity only / no pixel effect",
    mask: "Alpha mask / keep overlap",
    maskInverse: "Inverse alpha mask",
    outline: "Outline",
    neon: "Neon glow",
    normalMap: "Normal map",
    lcd: "LCD screen…",
    innerOutline: "Inner outline",
    shadow: "Drop shadow",
    grayscale: "Grayscale",
    invert: "Invert colors",
    hueShift: "Hue shift",
    brightness: "Brightness",
    saturation: "Saturation",
    tint: "Color tint",
    threshold: "Threshold",
    dither: "Ordered dithering",
    posterize: "Posterize",
    multiply: "Multiply",
    screen: "Screen",
    overlay: "Overlay",
    darken: "Darken",
    lighten: "Lighten",
    difference: "Difference",
    exclusion: "Exclusion",
    addColor: "Add colors",
    subtractColor: "Subtract colors",
    "color-dodge": "Color dodge",
    "color-burn": "Color burn",
    "hard-light": "Hard light",
    "soft-light": "Soft light",
    hue: "Blend hue",
    saturationBlend: "Blend saturation",
    color: "Blend color",
    luminosity: "Blend luminosity"
  };
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) {
      n.className = cls;
    }
    if (text !== undefined) {
      n.textContent = text;
    }
    return n;
  }
  ns.LayersListController = function (controller) {
    this.piskelController = controller;
  };
  var proto = ns.LayersListController.prototype;
  proto.init = function () {
    pskl.UserSettings.set(pskl.UserSettings.LAYER_PREVIEW, true);
    pskl.UserSettings.set(pskl.UserSettings.LAYER_OPACITY, 1);
    this.rootEl = document.querySelector(".layers-list-container");
    this.layersListEl = this.rootEl.querySelector(".layers-list");
    this.pane = document.querySelector("#layer-options");
    this.rootEl.addEventListener("click", this.onClick_.bind(this));
    this.rootEl.addEventListener(
      "dblclick",
      function (e) {
        if (e.target.closest(".layer-name")) {
          this.rename(
            Number(e.target.closest("[data-layer-index]").dataset.layerIndex)
          );
        }
      }.bind(this)
    );
    $.subscribe(Events.PISKEL_RESET, this.renderLayerList_.bind(this));
    $.subscribe(Events.TOOL_RELEASED, this.preview.bind(this));
    this.renderLayerList_();
    this.ensurePreviewTabs();
    document.addEventListener(
      "pointerup",
      function () {
        if (this.holdingEffectId) {
          this.suppressEffectClickId = this.holdingEffectId;
          this.suppressEffectClickUntil = Date.now() + 350;
          this.holdingEffectId = null;
        }
      }.bind(this),
      true
    );
    $(this.layersListEl).sortable({
      axis: "y",
      handle: ".layer-drag",
      cancel: "input,textarea,select,option,button:not(.layer-drag)",
      items: ".layer-item",
      placeholder: "layer-drop-placeholder",
      update: function () {
        var c = this.piskelController,
          layers = c.getLayers(),
          selected = c.getCurrentLayer();
        var order = Array.from(this.layersListEl.children)
          .map(function (row) {
            return layers[Number(row.dataset.layerIndex)];
          })
          .reverse();
        layers.splice.apply(layers, [0, layers.length].concat(order));
        c.getWrappedPiskelController().selectLayer(selected);
        this.lastSelectedLayer = null;
        this.commit();
      }.bind(this)
    });
  };
  proto.commit = function () {
    $.publish(Events.PISKEL_RESET);
    $.publish(Events.PISKEL_SAVE_STATE, {
      type: pskl.service.HistoryService.SNAPSHOT
    });
  };
  proto.renderLayerList_ = function () {
    var c = this.piskelController,
      scroll = this.layersListEl.scrollTop,
      horizontalScroll = this.layersListEl.scrollLeft;
    this.layersListEl.replaceChildren();
    c.getLayers().forEach(
      function (layer, index) {
        var row = el(
          "li",
          "layer-item" +
            (c.getCurrentLayer() === layer ? " current-layer-item" : "") +
            (layer.rowState.hidden ? " layer-hidden" : "")
        );
        row.dataset.layerIndex = index;
        row.dataset.testId = "layer-item";
        var line = el("div", "layer-row");
        row.append(line);
        var button = function (action, label, icon) {
          var b = el("button", "layer-" + action);
          b.type = "button";
          b.dataset.action = action;
          b.title = label;
          b.setAttribute("aria-label", label);
          b.innerHTML =
            '<svg viewBox="0 0 20 20" aria-hidden="true">' +
            icons[icon || action] +
            "</svg>";
          line.append(b);
          return b;
        };
        button("drag", "Drag to reorder layer");
        button("edit", "Rename layer");
        var name = el("span", "layer-name", layer.getName());
        name.dataset.testId = "layer-name";
        name.title = layer.getName();
        line.append(name);
        var lock = button(
          "lock",
          layer.isLocked() ? "Unlock layer" : "Lock layer",
          layer.isLocked() ? "lock" : "unlock"
        );
        lock.setAttribute("aria-pressed", layer.isLocked());
        var eye = button(
          "visibility",
          layer.rowState.hidden ? "Show layer" : "Hide layer",
          layer.rowState.hidden ? "hidden" : "eye"
        );
        eye.setAttribute("aria-pressed", !layer.rowState.hidden);
        button("merge", "Merge down").disabled =
          index === 0 ||
          layer.isLocked() ||
          c.getLayers()[index - 1].isLocked();
        button("subtract", "Layer manipulation");
        var fxButton = button("fx", "Layer effects");
        fxButton.classList.toggle(
          "has-effects",
          pskl.utils.LayerEffects.list(layer).some(function (effect) {
            return effect.enabled !== false;
          })
        );
        button("delete", "Delete layer").disabled =
          c.getLayers().length === 1 || layer.isLocked();
        pskl.utils.LayerEffects.list(layer).forEach(
          function (effect) {
            var marker = el(
              "button",
              "layer-effect-marker",
              "● " +
                (effects[effect.operation] || effect.operation) +
                (effect.frame === null || effect.frame === undefined
                  ? ""
                  : " · Frame " + (effect.frame + 1))
            );
            marker.classList.add("layer-effect-icon");
            marker.replaceChildren();
            marker.innerHTML =
              '<svg viewBox="0 0 20 20" aria-hidden="true">' +
              '<circle cx="10" cy="10" r="3" fill="currentColor" stroke="none"/>' +
              "</svg>";
            var effectLabel =
              (effects[effect.operation] || effect.operation) +
              (effect.frame === null || effect.frame === undefined
                ? ""
                : " · Frame " + (effect.frame + 1));
            marker.append(el("span", "layer-effect-label", effectLabel));
            marker.setAttribute("aria-label", effectLabel);
            marker.type = "button";
            marker.dataset.action = "effect-toggle";
            marker.dataset.effectId = effect.id;
            marker.dataset.testId = "layer-effect-marker";
            marker.setAttribute("aria-pressed", effect.enabled !== false);
            marker.title =
              (effects[effect.operation] || effect.operation) +
              (effect.enabled === false ? " — off. " : " — on. ") +
              "Click to toggle. Hold or press F2 to edit.";
            marker.setAttribute("aria-keyshortcuts", "F2");
            marker.disabled = layer.isLocked();
            var timer;
            marker.addEventListener(
              "pointerdown",
              function (event) {
                if (event.button !== 0) {
                  return;
                }
                timer = setTimeout(
                  function () {
                    marker.effectHeld = true;
                    this.holdingEffectId = effect.id;
                    this.editEffect(index, effect.id);
                  }.bind(this),
                  450
                );
              }.bind(this)
            );
            ["pointerup", "pointerleave", "pointercancel"].forEach(
              function (type) {
                marker.addEventListener(type, function () {
                  clearTimeout(timer);
                });
              }
            );
            marker.addEventListener(
              "keydown",
              function (event) {
                if (event.key === "F2") {
                  event.preventDefault();
                  this.editEffect(index, effect.id);
                }
              }.bind(this)
            );
            marker.addEventListener(
              "contextmenu",
              function (event) {
                event.preventDefault();
                this.editEffect(index, effect.id);
              }.bind(this)
            );
            line.insertBefore(marker, lock);
          }.bind(this)
        );
        this.layersListEl.prepend(row);
      }.bind(this)
    );
    if (this.decorateGroups) {
      this.decorateGroups();
    }
    this.layersListEl.scrollTop = scroll;
    this.layersListEl.scrollLeft = horizontalScroll;
    var selected = this.layersListEl.querySelector(".current-layer-item");
    var currentLayer = c.getCurrentLayer(),
      selectionKey =
        currentLayer.rowState.groupNodeId || currentLayer.rowState.id;
    if (
      selected &&
      (!this.lastSelectedLayer || this.lastSelectedLayerKey !== selectionKey)
    ) {
      this.scrollWithin_(this.layersListEl, selected);
    }
    this.lastSelectedLayer = c.getCurrentLayer();
    this.lastSelectedLayerKey = selectionKey;
    if (this.panelKind) {
      this.refreshPane();
    }
  };
  proto.scrollWithin_ = function (container, node) {
    if (!node || !node.getClientRects().length) {
      return;
    }
    var view = container.getBoundingClientRect(),
      rect = node.getBoundingClientRect();
    var top = view.top + container.clientTop,
      bottom = top + container.clientHeight;
    if (rect.height > container.clientHeight || rect.top < top) {
      container.scrollTop += rect.top - top;
    } else if (rect.bottom > bottom) {
      container.scrollTop += rect.bottom - bottom;
    }
  };
  proto.revealPane_ = function () {
    this.scrollWithin_(this.pane.closest(".right-panels-scroller"), this.pane);
  };
  proto.onClick_ = function (e) {
    var button = e.target.closest("button"),
      row = e.target.closest("[data-layer-index]"),
      c = this.piskelController;
    if (button && button.dataset.action === "add") {
      if (e.shiftKey) {
        c.duplicateCurrentLayer();
      } else {
        c.createLayer();
      }
      return;
    }
    if (!row || e.target.tagName === "INPUT") {
      return;
    }
    var index = Number(row.dataset.layerIndex),
      action = button && button.dataset.action,
      layer = c.getLayers()[index];
    if (action === "drag") {
      return;
    }
    if (c.getCurrentLayerIndex() !== index) {
      c.setCurrentLayerIndex(index);
    }
    if (action === "effect-toggle") {
      if (
        button.effectHeld ||
        this.holdingEffectId === button.dataset.effectId ||
        (this.suppressEffectClickId === button.dataset.effectId &&
          Date.now() < this.suppressEffectClickUntil)
      ) {
        button.effectHeld = false;
        this.suppressEffectClickId = null;
        return;
      }
      if (layer.isLocked()) {
        return;
      }
      var effect = pskl.utils.LayerEffects.list(layer).find(function (entry) {
        return entry.id === button.dataset.effectId;
      });
      if (effect) {
        effect.enabled = effect.enabled === false;
        if (
          effect.enabled &&
          pskl.utils.LayerBlendUtils.isBlend(effect.operation)
        ) {
          pskl.utils.LayerEffects.list(layer).forEach(function (entry) {
            if (
              entry !== effect &&
              pskl.utils.LayerBlendUtils.isBlend(entry.operation)
            ) {
              entry.enabled = false;
            }
          });
        }
        this.commit();
      }
    } else if (action === "edit") {
      this.rename(index);
    } else if (action === "lock") {
      layer.rowState.locked = !layer.isLocked();
      this.commit();
    } else if (action === "visibility") {
      layer.rowState.hidden = !layer.rowState.hidden;
      this.commit();
    } else if (action === "delete" && !layer.isLocked()) {
      c.removeCurrentLayer();
    } else if (
      action === "merge" &&
      index > 0 &&
      !layer.isLocked() &&
      !c.getLayers()[index - 1].isLocked()
    ) {
      var lower = c.getLayers()[index - 1];
      var frames = layer.getFrames().map(function (_, i) {
        return pskl.utils.LayerEffects.mergeDown(c.getLayers(), index, i);
      });
      lower.frames = frames;
      lower.opacity = 1;
      lower.rowState.hidden = false;
      lower.rowState.effects = [];
      c.getWrappedPiskelController().removeLayerAt(index);
      this.commit();
    } else if (action === "subtract" || action === "fx") {
      if (action === "fx") {
        this.editingEffectId = null;
        this.lastPanelKind = null;
      }
      this.panelKind = action;
      this.requestedPreviewMode = action;
      this.refreshPane();
      this.revealPane_();
    }
  };
  proto.rename = function (index) {
    var c = this.piskelController;
    c.setCurrentLayerIndex(index);
    var row = this.layersListEl.querySelector(
        '[data-layer-index="' + index + '"]'
      ),
      name = row.querySelector(".layer-name"),
      input = el("input", "layer-name-input");
    input.value = c.getLayers()[index].getName();
    input.setAttribute("aria-label", "Layer name");
    input.dataset.testId = "layer-name-input";
    name.replaceWith(input);
    var done = false;
    var finish = function (save) {
      if (done) {
        return;
      }
      done = true;
      if (save && input.value.trim()) {
        c.renameLayerAt(index, input.value.trim());
      }
      this.renderLayerList_();
    }.bind(this);
    input.addEventListener("keydown", function (e) {
      e.stopPropagation();
      if (e.key === "Enter") {
        finish(true);
      }
      if (e.key === "Escape") {
        finish(false);
      }
    });
    input.addEventListener("blur", function () {
      finish(true);
    });
    input.focus();
    input.select();
  };
  proto.refreshPane = function () {
    var c = this.piskelController,
      layer = c.getCurrentLayer(),
      pane = this.pane,
      old = {};
    var scroller = pane.closest(".right-panels-scroller"),
      scroll = scroller.scrollTop,
      innerScroll = pane.scrollTop;
    pane.querySelectorAll("[data-option]").forEach(function (n) {
      old[n.dataset.option] = n.type === "checkbox" ? n.checked : n.value;
    });
    if (this.lastPanelKind !== this.panelKind) {
      old = {};
    } else if (this.pendingLayer !== layer) {
      old.opacity = Math.round(layer.getOpacity() * 100);
      old.effectOnly = !!layer.rowState.effectOnly;
    }
    if (this.loadEffectSettings) {
      var selectedEffect = pskl.utils.LayerEffects.list(layer).find(
        function (entry) {
          return entry.id === this.editingEffectId;
        }.bind(this)
      );
      if (selectedEffect) {
        old = Object.assign({}, selectedEffect.params, {
          operation: selectedEffect.operation,
          opacity: Math.round(layer.getOpacity() * 100),
          all:
            selectedEffect.frame === null || selectedEffect.frame === undefined
        });
        this.configuredOperation = selectedEffect.operation;
      }
      this.loadEffectSettings = false;
    }
    this.pendingLayer = layer;
    this.lastPanelKind = this.panelKind;
    pane.hidden = false;
    pane.replaceChildren();
    pane.append(
      el(
        "h3",
        "",
        (this.panelKind === "fx"
          ? this.editingEffectId
            ? "Edit effect · "
            : "Add effect · "
          : "Manipulate · ") + layer.getName()
      )
    );
    var close = el("button", "", "Close");
    close.onclick = this.closePreview.bind(this);
    pane.append(close);
    function field(title, type, key, values, initial) {
      var label = el("label", "", title),
        n = el(type === "select" ? "select" : "input");
      if (type === "select") {
        Object.keys(values).forEach(function (v) {
          var option = el("option", "", values[v]);
          option.value = v;
          n.append(option);
        });
      } else {
        n.type = type;
      }
      n.dataset.option = key;
      n.setAttribute("aria-label", title);
      n.value =
        old[key] === undefined
          ? initial === null && values
            ? Object.keys(values)[0]
            : initial
          : old[key];
      if (type === "checkbox") {
        n.checked = old[key] === undefined ? initial === true : !!old[key];
      }
      label.append(n);
      pane.append(label);
      return n;
    }
    if (this.panelKind === "fx") {
      var opacity = field(
        "Opacity (%)",
        "range",
        "opacity",
        null,
        Math.round(layer.getOpacity() * 100)
      );
      opacity.min = 0;
      opacity.max = 100;
      var output = el("output", "", opacity.value + "%");
      opacity.after(output);
      opacity.oninput = function () {
        output.textContent = opacity.value + "%";
        this.preview();
      }.bind(this);
    }
    var picker = field(
      this.panelKind === "fx" ? "Effect" : "Operation",
      "select",
      "operation",
      this.panelKind === "fx" ? effects : manipulations,
      this.panelKind === "fx" ? "none" : "subtract"
    );
    var operation = picker.value,
      definitions = pskl.utils.LayerEffectDefinitions;
    if (this.panelKind === "fx" && this.configuredOperation !== operation) {
      [
        "amount",
        "radius",
        "shadowX",
        "shadowY",
        "color",
        "lcdSize",
        "lcdGap",
        "lcdRGB"
      ].forEach(function (key) {
        delete old[key];
      });
      this.configuredOperation = operation;
    }
    picker.addEventListener("change", this.refreshPane.bind(this));
    if (
      this.panelKind === "subtract" ||
      operation === "mask" ||
      operation === "maskInverse"
    ) {
      field(
        "Reference layer",
        "select",
        "direction",
        { below: "Below", above: "Above" },
        "below"
      );
    }
    if (
      this.panelKind === "fx" &&
      (operation === "mask" || operation === "maskInverse")
    ) {
      var sources = { "": "Use above / below" };
      c.getLayers().forEach(function (candidate) {
        if (
          candidate !== layer &&
          !pskl.utils.LayerGroupUtils.isGroup(candidate)
        ) {
          sources[pskl.utils.LayerGroupUtils.id(candidate)] =
            candidate.getName();
        }
      });
      field("Mask layer", "select", "maskId", sources, "");
      field(
        "Hide mask artwork",
        "checkbox",
        "hideMask",
        null,
        !this.editingEffectId
      );
      var paint = el("button", "", "Create & paint mask");
      paint.disabled = layer.isLocked();
      paint.onclick = this.createPaintMask.bind(this);
      pane.append(paint);
      pane.append(
        el(
          "p",
          "",
          "Paint opacity reveals artwork: opaque paint shows it fully, partial opacity shows it partly, and erasing hides it. Masks work on layers and whole groups. Create & paint mask applies a new empty mask and selects it for drawing."
        )
      );
    }
    if (this.panelKind === "fx") {
      definitions.parameters(operation).forEach(function (parameter) {
        var input = field(
          parameter.label,
          "number",
          parameter.key,
          null,
          parameter.value
        );
        input.min = parameter.min;
        input.max = parameter.max;
        input.step = parameter.step;
      });
      if (definitions.usesColor(operation)) {
        field(
          "Effect color",
          "color",
          "color",
          null,
          definitions.color(operation)
        );
      }
      if (pskl.utils.LayerBlendUtils.isBlend(operation)) {
        field(
          "Effect only (hide source artwork)",
          "checkbox",
          "effectOnly",
          null,
          !!layer.rowState.effectOnly
        );
        pane.append(
          el(
            "p",
            "",
            "Effect only changes the layer or group directly below, within its visible pixels. The source stays editable but its artwork is hidden. Leave it off for a normal blend with all visible artwork below. Feather softens the edge; 0 keeps exact pixels."
          )
        );
      } else if (
        operation === "shadow" ||
        operation === "outline" ||
        operation === "neon"
      ) {
        pane.append(el("p", "", "Pixels outside the canvas are clipped."));
      } else if (operation === "lcd") {
        pane.append(
          el(
            "p",
            "",
            "LCD generates a scaled canvas. Its settings window shows the output dimensions before generation."
          )
        );
      } else {
        pane.append(
          el(
            "p",
            "",
            "Blue dot: editing. Draw with the tools and adjust settings in the live preview. Apply saves this effect; yellow is on, grey is off. Hold a saved dot to edit it."
          )
        );
      }
    }
    var all = field(
      "All frames",
      "checkbox",
      "all",
      null,
      this.panelKind === "fx"
    );
    if (
      this.panelKind === "fx" &&
      pskl.utils.LayerBlendUtils.isBlend(operation)
    ) {
      all.checked = true;
      all.disabled = true;
    }
    if (this.panelKind === "fx" && this.editingEffectId) {
      var remove = el("button", "", "Remove effect");
      remove.onclick = function () {
        if (layer.isLocked()) {
          return;
        }
        layer.rowState.effects = pskl.utils.LayerEffects.list(layer).filter(
          function (entry) {
            return entry.id !== this.editingEffectId;
          }.bind(this)
        );
        if (
          !layer.rowState.effects.some(function (entry) {
            return pskl.utils.LayerBlendUtils.isBlend(entry.operation);
          })
        ) {
          layer.rowState.effectOnly = false;
        }
        this.commit();
        this.closePreview();
      }.bind(this);
      pane.append(remove);
    }
    this.ensurePreviewWindow();
    var error = el("p", "layer-error");
    error.setAttribute("role", "status");
    pane.append(error);
    pane.append(
      el(
        "p",
        "",
        "Draw and adjust settings while the preview updates. Use the FX or − tab to compare with Normal; Apply or Cancel beneath the preview."
      )
    );
    pane.querySelectorAll("[data-option]").forEach(
      function (n) {
        if (n.dataset.option !== "opacity") {
          n.addEventListener("input", this.preview.bind(this));
        }
      }.bind(this)
    );
    this.preview();
    scroller.scrollTop = scroll;
    pane.scrollTop = innerScroll;
  };
  proto.options = function () {
    var values = {};
    this.pane.querySelectorAll("[data-option]").forEach(function (n) {
      values[n.dataset.option] = n.type === "checkbox" ? n.checked : n.value;
    });
    if (values.operation === "lcd" && this.lcdPreviewOptions) {
      Object.assign(values, this.lcdPreviewOptions);
    }
    return values;
  };
  proto.result = function (frame, other, o) {
    if (this.panelKind === "subtract") {
      return pskl.utils.LayerPixelOps.manipulate(frame, other, o.operation);
    }
    if (o.operation === "mask" || o.operation === "maskInverse") {
      return pskl.utils.LayerPixelOps.manipulate(
        frame,
        other,
        o.operation === "mask" ? "intersect" : "subtract"
      );
    }
    return pskl.utils.LayerPixelOps.effect(
      frame,
      other,
      o.operation,
      Number(o.amount),
      o.color,
      o
    );
  };
  proto.reference = function (o) {
    var c = this.piskelController;
    if (
      this.panelKind === "fx" &&
      pskl.utils.LayerBlendUtils.isBlend(o.operation) &&
      o.effectOnly
    ) {
      return pskl.utils.LayerEffects.targetBelow(
        c.getCurrentLayer(),
        c.getLayers()
      );
    }
    if (this.panelKind === "fx") {
      return pskl.utils.LayerEffects.referenceLayer(
        c.getCurrentLayer(),
        o,
        c.getLayers()
      );
    }
    return c.getLayers()[
      c.getCurrentLayerIndex() + (o.direction === "above" ? 1 : -1)
    ];
  };
  proto.needsReference = function (o) {
    return (
      this.panelKind === "subtract" ||
      o.operation === "mask" ||
      o.operation === "maskInverse" ||
      (this.panelKind === "fx" &&
        pskl.utils.LayerBlendUtils.isBlend(o.operation) &&
        o.effectOnly)
    );
  };
  proto.updateEffectEditingState = function () {
    this.layersListEl
      .querySelectorAll(".layer-effect-draft")
      .forEach(function (dot) {
        dot.remove();
      });
    var active = this.panelKind === "fx" && !this.pane.hidden,
      layerIndex = this.piskelController.getCurrentLayerIndex(),
      operation = active ? this.options().operation : null;
    this.layersListEl.querySelectorAll(".layer-effect-marker").forEach(
      function (dot) {
        var editing =
          active &&
          dot.dataset.effectId === this.editingEffectId &&
          Number(dot.closest("[data-layer-index]").dataset.layerIndex) ===
            layerIndex;
        dot.dataset.editing = String(editing);
        dot.setAttribute(
          "aria-description",
          editing ? "Editing effect. Apply to save, or Cancel." : ""
        );
      }.bind(this)
    );
    if (
      active &&
      !this.editingEffectId &&
      operation !== "none" &&
      operation !== "lcd"
    ) {
      var line = this.layersListEl.querySelector(
        '[data-layer-index="' + layerIndex + '"] .layer-row'
      );
      if (line) {
        var draft = el("span", "layer-effect-icon layer-effect-draft");
        draft.title =
          "Editing " +
          (effects[operation] || operation) +
          ". Apply to save, or Cancel.";
        draft.setAttribute("role", "img");
        draft.setAttribute("aria-label", draft.title);
        draft.innerHTML =
          '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="3" fill="currentColor" stroke="none"/></svg>';
        line.insertBefore(draft, line.querySelector(".layer-lock"));
      }
    }
  };
  proto.preview = function () {
    if (!this.panelKind) {
      return;
    }
    this.updateEffectEditingState();
    var c = this.piskelController,
      o = this.options(),
      frame = c.getCurrentFrame(),
      other = this.reference(o),
      error = this.pane.querySelector(".layer-error");
    try {
      if (this.needsReference(o) && !other) {
        throw new Error(
          this.panelKind === "fx"
            ? o.effectOnly
              ? "Place this source above the layer or group you want to affect."
              : "Choose a mask layer, or use Create & paint mask."
            : "No layer " +
                o.direction +
                ". Choose the other direction or add a layer."
        );
      }
      if (this.panelKind === "fx") {
        pskl.utils.LayerEffectDefinitions.validate(o.operation, o);
      }
      var result =
        this.panelKind === "fx" && o.operation !== "lcd"
          ? frame
          : this.result(
              frame,
              other ? other.getFrameAt(c.getCurrentFrameIndex()) : frame,
              o
            );
      var canvas = this.previewWindow.querySelector("canvas");
      canvas.width = result.getWidth();
      canvas.height = result.getHeight();
      var artBounds = document
        .querySelector("#animated-preview-canvas-container")
        .getBoundingClientRect();
      var previewBounds = document
        .querySelector("#animated-preview-container")
        .getBoundingClientRect();
      canvas.style.left = artBounds.left - previewBounds.left + "px";
      canvas.style.top = artBounds.top - previewBounds.top + "px";
      canvas.style.width = artBounds.width + "px";
      canvas.style.height = artBounds.height + "px";
      var views = c.getLayers().map(
        function (layer, index) {
          var frames = layer.getFrames().slice(),
            view = pskl.utils.LayerEffects.view(
              layer,
              frames,
              index === c.getCurrentLayerIndex() && this.panelKind === "fx"
                ? o
                : null
            );
          if (o.operation === "lcd" && this.panelKind === "fx") {
            view.frames[c.getCurrentFrameIndex()] =
              index === c.getCurrentLayerIndex()
                ? result
                : pskl.utils.SpriteEffectsUtils.scale(
                    frames[c.getCurrentFrameIndex()],
                    Number(o.lcdSize || 4)
                  );
          } else if (index === c.getCurrentLayerIndex()) {
            if (this.panelKind === "fx") {
              if (pskl.utils.LayerBlendUtils.isBlend(o.operation)) {
                view.rowState.effectOnly = !!o.effectOnly;
              }
              view.rowState.effects = pskl.utils.LayerEffects.proposed(
                layer,
                o,
                this.editingEffectId,
                c.getCurrentFrameIndex()
              );
            } else {
              view.frames[c.getCurrentFrameIndex()] =
                o.operation === "lift" ? frame : result;
            }
          }
          return view;
        }.bind(this)
      );
      canvas
        .getContext("2d")
        .drawImage(
          pskl.utils.LayerUtils.flattenFrameAt(
            views,
            c.getCurrentFrameIndex(),
            true,
            views,
            result
          ),
          0,
          0
        );
      this.previewWindow.querySelector(".layer-result-title").textContent =
        (this.panelKind === "fx" ? "FX preview · " : "Manipulation · ") +
        c.getCurrentLayer().getName();
      this.previewWindow.querySelector(".layer-result-status").textContent =
        "Live · " +
        result.getWidth() +
        " × " +
        result.getHeight() +
        " · Frame " +
        (c.getCurrentFrameIndex() + 1);
      error.textContent = c.getCurrentLayer().isLocked()
        ? "Unlock this layer before applying changes."
        : "";
      this.previewWindow.querySelector(".layer-apply").textContent =
        o.operation === "lcd" ? "LCD settings…" : "Apply";
      this.previewWindow.querySelector(".layer-apply").disabled = c
        .getCurrentLayer()
        .isLocked();
    } catch (e) {
      error.textContent = e.message;
      this.previewWindow.querySelector(".layer-result-status").textContent =
        e.message;
      this.previewWindow
        .querySelector("canvas")
        .getContext("2d")
        .clearRect(
          0,
          0,
          this.previewWindow.querySelector("canvas").width,
          this.previewWindow.querySelector("canvas").height
        );
      this.previewWindow.querySelector(".layer-apply").disabled = true;
    }
  };
  proto.apply = function () {
    var c = this.piskelController,
      layer = c.getCurrentLayer(),
      o = this.options(),
      other = this.reference(o);
    if (layer.isLocked()) {
      return;
    }
    if (this.panelKind === "fx" && o.operation === "lcd") {
      this.openLCD();
      return;
    }
    try {
      if (this.needsReference(o) && !other) {
        throw new Error("Choose an existing reference layer.");
      }
      if (this.panelKind === "fx") {
        pskl.utils.LayerEffectDefinitions.validate(o.operation, o);
        if (pskl.utils.LayerBlendUtils.isBlend(o.operation)) {
          layer.rowState.effectOnly = !!o.effectOnly;
        }
        layer.rowState.effects = pskl.utils.LayerEffects.proposed(
          layer,
          o,
          this.editingEffectId,
          c.getCurrentFrameIndex()
        );
        layer.setOpacity(Number(o.opacity) / 100);
        var entries = pskl.utils.LayerEffects.list(layer),
          reveal =
            this.editingEffectId ||
            (entries.length ? entries[entries.length - 1].id : null);
        this.commit();
        this.closePreview();
        if (reveal) {
          Array.from(this.layersListEl.querySelectorAll(".layer-effect-marker"))
            .filter(function (marker) {
              return marker.dataset.effectId === reveal;
            })
            .slice(-1)
            .forEach(
              function (marker) {
                this.scrollWithin_(this.layersListEl, marker);
              }.bind(this)
            );
        }
        return;
      }
      var indices = o.all
        ? layer.getFrames().map(function (_, i) {
            return i;
          })
        : [c.getCurrentFrameIndex()];
      // Calculate all results before changing anything, keeping validation atomic.
      var outputs = indices.map(
        function (i) {
          return this.result(
            layer.getFrameAt(i),
            other ? other.getFrameAt(i) : layer.getFrameAt(i),
            o
          );
        }.bind(this)
      );
      if (this.panelKind === "subtract" && o.operation === "lift") {
        var lifted = pskl.model.Layer.fromFrames(
          layer.getName() + " · lifted",
          layer.getFrames().map(function (f) {
            return pskl.model.Frame.createEmptyFromFrame(f);
          })
        );
        indices.forEach(function (i, j) {
          lifted.frames[i] = outputs[j];
          layer.frames[i] = pskl.utils.LayerPixelOps.manipulate(
            layer.getFrameAt(i),
            other.getFrameAt(i),
            "subtract"
          );
        });
        c.getPiskel().addLayerAt(lifted, c.getCurrentLayerIndex() + 1);
      } else {
        indices.forEach(function (i, j) {
          layer.frames[i] = outputs[j];
        });
      }
      if (this.panelKind === "fx") {
        layer.setOpacity(Number(o.opacity) / 100);
      }
      this.commit();
      this.closePreview();
    } catch (e) {
      this.pane.querySelector(".layer-error").textContent = e.message;
    }
  };
  proto.editEffect = function (index, id) {
    var c = this.piskelController;
    c.setCurrentLayerIndex(index);
    this.editingEffectId = id;
    this.loadEffectSettings = true;
    this.panelKind = "fx";
    this.requestedPreviewMode = "fx";
    this.refreshPane();
    this.revealPane_();
  };
  proto.createPaintMask = function () {
    var c = this.piskelController,
      target = c.getCurrentLayer(),
      project = c.getPiskel(),
      o = this.options();
    if (target.isLocked()) {
      return;
    }
    try {
      pskl.utils.LayerEffectDefinitions.validate(o.operation, o);
      var mask = pskl.model.Layer.fromFrames(
        target.getName() + " · mask",
        target.getFrames().map(function (frame) {
          return pskl.model.Frame.createEmptyFromFrame(frame);
        })
      );
      // hideMask suppresses its artwork in the composite. Keep the source
      // layer itself enabled so the normal drawing tools can paint it.
      var isGroup = pskl.utils.LayerGroupUtils.isGroup(target);
      mask.rowState.parentGroup = isGroup
        ? pskl.utils.LayerGroupUtils.id(target)
        : target.rowState.parentGroup || null;
      o.maskId = pskl.utils.LayerGroupUtils.id(mask);
      o.direction = "above";
      o.hideMask = true;
      project.addLayerAt(mask, c.getCurrentLayerIndex() + (isGroup ? 0 : 1));
      target.rowState.effects = pskl.utils.LayerEffects.proposed(
        target,
        o,
        this.editingEffectId,
        c.getCurrentFrameIndex()
      );
      target.setOpacity(Number(o.opacity) / 100);
      c.setCurrentLayerIndex(c.getLayers().indexOf(mask));
      this.commit();
      this.closePreview();
      $.publish(Events.SELECT_TOOL, ["tool-pen"]);
    } catch (error) {
      this.pane.querySelector(".layer-error").textContent = error.message;
    }
  };
  proto.closePreview = function () {
    this.panelKind = null;
    this.lastPanelKind = null;
    this.pendingLayer = null;
    this.editingEffectId = null;
    this.lcdPreviewOptions = null;
    this.pane.hidden = true;
    this.updateEffectEditingState();
    if (this.previewWindow) {
      this.previewWindow.hidden = true;
    }
    this.setPreviewMode("normal");
  };
  proto.positionPreviewTabs = function () {
    if (!this.previewTabs) {
      return;
    }
    var rect = document
      .querySelector("#animated-preview-container")
      .getBoundingClientRect();
    this.previewTabs.style.left =
      Math.min(window.innerWidth - 30, rect.right + 2) + "px";
    this.previewTabs.style.top = Math.max(4, rect.top + 4) + "px";
  };
  proto.ensurePreviewTabs = function () {
    if (this.previewTabs) {
      return;
    }
    var tabs = el("div", "layer-preview-tabs");
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "Preview mode");
    tabs.setAttribute("aria-orientation", "vertical");
    [
      ["normal", "◉", "Normal preview"],
      ["fx", "FX", "FX preview"],
      ["subtract", "−", "Manipulation preview"]
    ].forEach(
      function (item) {
        var button = el("button", "", item[1]);
        button.type = "button";
        button.dataset.mode = item[0];
        button.setAttribute("role", "tab");
        button.setAttribute("aria-label", item[2]);
        button.title = item[2] + " (click the active tab for Normal)";
        button.onclick = function () {
          if (item[0] === "normal" || this.previewMode === item[0]) {
            this.setPreviewMode("normal");
            return;
          }
          if (this.panelKind !== item[0]) {
            this.panelKind = item[0];
            this.requestedPreviewMode = item[0];
            this.refreshPane();
            this.revealPane_();
          } else {
            this.setPreviewMode(item[0]);
            this.preview();
          }
        }.bind(this);
        tabs.append(button);
      }.bind(this)
    );
    document.body.append(tabs);
    this.previewTabs = tabs;
    this.setPreviewMode("normal");
    this.positionPreviewTabs();
    window.addEventListener("resize", this.positionPreviewTabs.bind(this));
  };
  proto.setPreviewMode = function (mode) {
    this.previewMode = mode;
    if (this.previewWindow) {
      this.previewWindow.classList.toggle("preview-normal", mode === "normal");
    }
    if (this.previewTabs) {
      this.previewTabs.querySelectorAll("button").forEach(function (button) {
        button.setAttribute("aria-selected", button.dataset.mode === mode);
      });
    }
  };
  proto.ensurePreviewWindow = function () {
    if (!this.previewWindow) {
      var node = el("div", "layer-result-preview");
      node.setAttribute("aria-label", "Pending layer result");
      node.innerHTML =
        '<span class="layer-result-title">Live result</span><canvas aria-label="Live layer result"></canvas><p class="layer-result-status" role="status"></p><div class="layer-result-actions"><button type="button" class="layer-apply">Apply</button><button type="button" class="layer-cancel">Cancel</button></div>';
      node.querySelector(".layer-apply").onclick = this.apply.bind(this);
      node.querySelector(".layer-cancel").onclick =
        this.closePreview.bind(this);
      document.querySelector("#animated-preview-container").append(node);
      this.previewWindow = node;
    }
    this.previewWindow.hidden = false;
    if (this.requestedPreviewMode) {
      this.setPreviewMode(this.requestedPreviewMode);
      this.requestedPreviewMode = null;
    }
    this.positionPreviewTabs();
    this.lastPreviewHash = null;
  };
  proto.renderPreview = function () {
    if (!this.panelKind || !this.previewWindow || this.previewWindow.hidden) {
      return;
    }
    if (Date.now() - (this.lastPreviewAt || 0) < 80) {
      return;
    }
    this.lastPreviewAt = Date.now();
    var c = this.piskelController,
      o = this.options(),
      other = this.reference(o);
    var hash =
      pskl.utils.LayerUtils.getFrameHashAt(
        c.getLayers(),
        c.getCurrentFrameIndex()
      ) +
      ":" +
      (other ? other.getFrameAt(c.getCurrentFrameIndex()).getHash() : "") +
      ":" +
      JSON.stringify(o) +
      ":" +
      c.getCurrentLayerIndex() +
      ":" +
      c.getCurrentFrameIndex();
    if (hash !== this.lastPreviewHash) {
      this.lastPreviewHash = hash;
      this.preview();
    }
  };
})();

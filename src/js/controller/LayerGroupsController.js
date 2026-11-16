(function () {
  var proto = pskl.controller.LayersListController.prototype,
    groups = pskl.utils.LayerGroupUtils,
    originalInit = proto.init,
    originalRender = proto.renderLayerList_;
  var makeButton = function (label, parent, fn) {
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.className = "button layer-group-action";
    b.setAttribute("aria-label", label);
    b.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      fn();
    });
    parent.append(b);
    return b;
  };
  proto.groupCommit = function () {
    groups.normalize(this.piskelController.getLayers());
    $.publish(Events.PISKEL_RESET);
    $.publish(Events.PISKEL_SAVE_STATE, {
      type: pskl.service.HistoryService.SNAPSHOT
    });
  };
  proto.init = function () {
    originalInit.apply(this, arguments);
    $(this.layersListEl).sortable("destroy");
    this.bindGroupDrag_();
    var bar = document.createElement("div");
    bar.className = "layer-group-bar";
    makeButton(
      "+ Group",
      bar,
      function () {
        var c = this.piskelController,
          p = c.getPiskel(),
          current = c.getCurrentLayer(),
          parent = groups.parent(c.getLayers(), current),
          frames = Array.from({ length: p.getFrameCount() }, function () {
            return new pskl.model.Frame(p.getWidth(), p.getHeight());
          }),
          folder = pskl.model.Layer.fromFrames("Group", frames);
        groups.state(folder).isGroup = true;
        groups.state(folder).parentGroup = parent ? groups.id(parent) : null;
        p.getLayers().push(folder);
        groups.state(current).parentGroup = groups.id(folder);
        groups.normalize(p.getLayers());
        c.setCurrentLayerIndex(p.getLayers().indexOf(folder));
        this.groupCommit();
      }.bind(this)
    );
    this.groupParentPicker = document.createElement("select");
    this.groupParentPicker.setAttribute("aria-label", "Parent layer group");
    bar.append(this.groupParentPicker);
    makeButton(
      "Nest",
      bar,
      function () {
        var c = this.piskelController,
          l = c.getCurrentLayer(),
          target = c.getLayers().find(
            function (v) {
              return (
                groups.state(v).groupNodeId === this.groupParentPicker.value
              );
            }.bind(this)
          );
        try {
          groups.assign(c.getLayers(), l, target);
          c.getWrappedPiskelController().selectLayer(l);
          this.groupCommit();
        } catch (e) {
          this.groupParentPicker.title = e.message;
        }
      }.bind(this)
    );
    makeButton(
      "Unnest",
      bar,
      function () {
        var c = this.piskelController,
          l = c.getCurrentLayer(),
          parent = groups.parent(c.getLayers(), l);
        groups.assign(
          c.getLayers(),
          l,
          parent ? groups.parent(c.getLayers(), parent) : null
        );
        c.getWrappedPiskelController().selectLayer(l);
        this.groupCommit();
      }.bind(this)
    );
    [
      ["↑ Group", 1],
      ["↓ Group", -1]
    ].forEach(
      function (pair) {
        makeButton(
          pair[0],
          bar,
          function () {
            var c = this.piskelController,
              l = c.getCurrentLayer();
            groups.move(c.getLayers(), l, pair[1]);
            c.getWrappedPiskelController().selectLayer(l);
            this.groupCommit();
          }.bind(this)
        );
      }.bind(this)
    );
    this.rootEl.insertBefore(bar, this.layersListEl);
    this.decorateGroups();
    // Folder rows are containers; group deletion unwraps surviving children.
    this.rootEl.addEventListener(
      "click",
      function (e) {
        var b = e.target.closest("button"),
          c = this.piskelController,
          l = c.getCurrentLayer();
        if (!b) {
          return;
        }
        var row = b.closest("[data-layer-index]");
        if (row) {
          l = c.getLayers()[Number(row.dataset.layerIndex)];
        }
        var action = b.dataset.action;
        if (
          action === "add" &&
          !e.shiftKey &&
          (groups.isGroup(l) || groups.parent(c.getLayers(), l))
        ) {
          e.preventDefault();
          e.stopImmediatePropagation();
          var parent = groups.isGroup(l) ? l : groups.parent(c.getLayers(), l);
          c.createLayer();
          var added = c.getCurrentLayer();
          groups.assign(c.getLayers(), added, parent);
          c.getWrappedPiskelController().selectLayer(added);
          this.groupCommit();
          return;
        }
        if (!groups.isGroup(l)) {
          return;
        }
        if (action === "delete") {
          groups
            .descendants(c.getLayers(), l)
            .filter(function (child) {
              return groups.parent(c.getLayers(), child) === l;
            })
            .forEach(function (child) {
              groups.state(child).parentGroup =
                groups.state(l).parentGroup || null;
            });
        }
        if (action === "merge" || action === "subtract") {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      }.bind(this),
      true
    );
  };
  proto.renderLayerList_ = function () {
    var selected = this.piskelController.getCurrentLayer();
    groups.normalize(this.piskelController.getLayers());
    if (selected) {
      this.piskelController.getWrappedPiskelController().selectLayer(selected);
    }
    originalRender.apply(this, arguments);
  };
  proto.decorateGroups = function () {
    var c = this.piskelController,
      layers = c.getLayers(),
      selected = c.getCurrentLayer();
    this.layersListEl.querySelectorAll("[data-layer-index]").forEach(
      function (row) {
        var layer = layers[Number(row.dataset.layerIndex)];
        if (!layer) {
          return;
        }
        var ancestors = groups.ancestors(layers, layer),
          line = row.querySelector(".layer-row") || row,
          name = row.querySelector(".layer-name");
        row.hidden = ancestors.some(function (p) {
          return !!groups.state(p).collapsed;
        });
        row.dataset.layerDepth = ancestors.length;
        row.classList.toggle("layer-is-group", groups.isGroup(layer));
        if (name) {
          name.style.paddingLeft = 8 + ancestors.length * 14 + "px";
        }
        if (groups.isGroup(layer)) {
          var toggle = makeButton(
            groups.state(layer).collapsed ? "▸" : "▾",
            line,
            function () {
              groups.state(layer).collapsed = !groups.state(layer).collapsed;
              this.groupCommit();
            }.bind(this)
          );
          toggle.classList.add("layer-group-toggle");
          toggle.setAttribute(
            "aria-label",
            (groups.state(layer).collapsed ? "Expand" : "Collapse") +
              " group " +
              layer.getName()
          );
          toggle.setAttribute(
            "aria-expanded",
            String(!groups.state(layer).collapsed)
          );
          line.insertBefore(toggle, name || line.firstChild);
        }
        var handle = row.querySelector(".layer-drag");
        handle.draggable = true;
        handle.title =
          "Drag above or below a row to reorder; onto a group to nest";
      }.bind(this)
    );
    if (this.groupParentPicker) {
      this.groupParentPicker.replaceChildren(new Option("No group", ""));
      layers
        .filter(function (l) {
          return (
            groups.isGroup(l) &&
            l !== selected &&
            groups.ancestors(layers, l).indexOf(selected) === -1
          );
        })
        .forEach(
          function (l) {
            this.groupParentPicker.append(
              new Option(
                groups
                  .ancestors(layers, l)
                  .reverse()
                  .concat(l)
                  .map(function (node) {
                    return node.getName();
                  })
                  .join(" / "),
                groups.id(l)
              )
            );
          }.bind(this)
        );
      this.groupParentPicker.value = groups.state(selected).parentGroup || "";
    }
  };
})();

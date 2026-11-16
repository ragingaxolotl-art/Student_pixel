(function () {
  var proto = pskl.controller.LayersListController.prototype,
    g = pskl.utils.LayerGroupUtils;
  proto.bindGroupDrag_ = function () {
    var list = this.layersListEl,
      dragged = null;
    var clear = function () {
      list.querySelectorAll("[data-layer-drop]").forEach(function (row) {
        delete row.dataset.layerDrop;
        row.removeAttribute("data-drop-label");
      });
    };
    var targetFor = function (event) {
      var row = event.target.closest("[data-layer-index]");
      if (!row) {
        return { layer: null, position: "below", row: null };
      }
      var target =
          this.piskelController.getLayers()[Number(row.dataset.layerIndex)],
        rect = row.getBoundingClientRect(),
        fraction = (event.clientY - rect.top) / rect.height;
      return {
        layer: target,
        position:
          g.isGroup(target) && fraction > 0.25 && fraction < 0.75
            ? "inside"
            : fraction < 0.5
              ? "above"
              : "below",
        row: row
      };
    }.bind(this);
    list.addEventListener(
      "dragstart",
      function (event) {
        var handle = event.target.closest(".layer-drag"),
          row = handle && handle.closest("[data-layer-index]");
        if (!row) {
          event.preventDefault();
          return;
        }
        dragged =
          this.piskelController.getLayers()[Number(row.dataset.layerIndex)];
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("application/x-piskel-layer", g.id(dragged));
      }.bind(this)
    );
    list.addEventListener(
      "dragover",
      function (event) {
        if (!dragged) {
          return;
        }
        event.stopPropagation();
        var target = targetFor(event);
        clear();
        if (
          target.layer === dragged ||
          (target.layer &&
            g
              .ancestors(this.piskelController.getLayers(), target.layer)
              .indexOf(dragged) !== -1)
        ) {
          event.dataTransfer.dropEffect = "none";
          return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        if (target.row) {
          target.row.dataset.layerDrop = target.position;
          target.row.dataset.dropLabel =
            target.position === "inside"
              ? "Move into " + target.layer.getName()
              : "Move " + target.position + " " + target.layer.getName();
        }
        var bounds = list.getBoundingClientRect();
        if (event.clientY < bounds.top + 18) {
          list.scrollTop -= 8;
        } else if (event.clientY > bounds.bottom - 18) {
          list.scrollTop += 8;
        }
      }.bind(this)
    );
    list.addEventListener(
      "drop",
      function (event) {
        if (!dragged) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        var target = targetFor(event),
          layer = dragged;
        dragged = null;
        clear();
        var c = this.piskelController;
        if (g.moveTo(c.getLayers(), layer, target.layer, target.position)) {
          c.getWrappedPiskelController().selectLayer(layer);
          this.lastSelectedLayer = null;
          this.groupCommit();
        }
      }.bind(this)
    );
    list.addEventListener("dragend", function () {
      dragged = null;
      clear();
    });
  };
})();

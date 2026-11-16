(function () {
  var p = pskl.controller.dialogs.PuppetStudioControls.prototype,
    r = pskl.utils.RigStudioUtils;
  p.handleConnectorPointer_ = function (event, canvas, rig, o, point) {
    if (o.editMode !== "connector" && o.editMode !== "connect") {
      return false;
    }
    event.preventDefault();
    this.owner.stopPreview_();
    var segment = r.nearestSegment(rig, point),
      tolerance = Math.max(2, (8 * canvas.width) / canvas.clientWidth);
    if (!segment || segment.distance > tolerance) {
      throw new Error("Click a body or limb segment line.");
    }
    var selected;
    if (o.editMode === "connector") {
      selected = r.addConnector(rig, segment.id, segment.point).id;
    } else {
      r.connectTo(rig, segment.id, o.bone);
      selected = o.bone;
    }
    this.savePuppetDraft(rig, selected)
      .then(
        function () {
          this.form("rig").querySelector('[role="status"]').textContent =
            o.editMode === "connector"
              ? "Connector added. Choose Attach limb, then click each arm or leg segment. Body motion carries them; limbs bend independently."
              : "Limb attached without moving its artwork or changing the layer order.";
        }.bind(this)
      )
      .catch(
        function (error) {
          this.form("rig").querySelector('[role="status"]').textContent =
            error.message;
        }.bind(this)
      );
    return true;
  };
})();

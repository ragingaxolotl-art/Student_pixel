(function () {
  const p = pskl.controller.dialogs.PuppetStudioControls.prototype,
    r = pskl.utils.RigStudioUtils,
    clone = pskl.utils.ToolStateUtils.clone;
  p.handleConnectionPointer = function (event) {
    const mode = this.read().editMode,
      line = event.target.closest("[data-rig-unlink]");
    if (line && mode === "unlink") {
      event.preventDefault();
      const rig = this.puppetRig();
      this.loadRigBone(line.dataset.rigUnlink, rig);
      this.changeAnimatorParent(null);
      return true;
    }
    const canvas = event.target.closest('[data-art-preview="after"]');
    if (!canvas || !["link", "unlink"].includes(mode)) {
      return false;
    }
    event.preventDefault();
    if (mode === "unlink") {
      this.animatorStatus(
        "Click a highlighted connection line, or select a joint and Disconnect selected."
      );
      return true;
    }
    const rig = this.puppetRig(),
      world = r.world(rig, {}),
      point = this.animatorPoint(event, canvas),
      picked = r.pickJoint(rig, world, point, this.read().bone);
    if (!picked || (picked.distance * canvas.clientWidth) / canvas.width > 12) {
      this.animatorStatus(
        "Drag a child's joint onto the parent joint you want to connect it to."
      );
      return true;
    }
    const bone = rig.bones.find((b) => b.id === picked.id);
    if (bone.deformSource) {
      this.animatorStatus(
        "Connect the start of this limb so its split joints stay together."
      );
      return true;
    }
    this.owner.stopPreview_();
    this.loadRigBone(bone.id, rig);
    this.editorDrag = {
      type: "connect",
      id: bone.id,
      rig: clone(rig),
      world,
      point: world[bone.id].start,
      to: point,
      canvas,
      target: null
    };
    this.owner.wrapper.setPointerCapture(event.pointerId);
    this.owner.resizeWorkspacePreview_();
    return true;
  };
  p.moveConnectionPointer = function (event) {
    const d = this.editorDrag,
      point = this.animatorPoint(event, d.canvas),
      hit = r.pickJoint(d.rig, d.world, point),
      id =
        hit && (hit.distance * d.canvas.clientWidth) / d.canvas.width <= 14
          ? hit.id
          : null;
    d.to = point;
    if (id !== d.target) {
      d.target = id;
      d.candidate = null;
      d.error = null;
      if (id) {
        try {
          const trial = clone(d.rig);
          r.reparent(trial, d.id, id);
          d.candidate = trial;
          this.animatorStatus(
            "Release to connect to " +
              d.rig.bones.find((b) => b.id === id).name +
              ". Poses keep their positions."
          );
        } catch (e) {
          d.error = e.message;
          this.animatorStatus(e.message);
        }
      } else {
        this.animatorStatus(
          "Move onto a parent joint. Escape cancels the connection."
        );
      }
    }
    this.owner.resizeWorkspacePreview_();
  };
  p.finishConnectionPointer = function (event) {
    const d = this.editorDrag;
    if (event.type === "pointerup") {
      this.moveConnectionPointer(event);
    }
    this.editorDrag = null;
    if (event.type !== "pointerup" || !d.candidate) {
      this.owner.resizeWorkspacePreview_();
      return;
    }
    this.savePuppetDraft(d.candidate, d.id)
      .then(() =>
        this.animatorStatus(
          "Joints connected. Current and saved poses keep their positions."
        )
      )
      .catch((e) => this.animatorStatus(e.message));
  };
  p.drawConnectionOverlay = function (svg, element, sx, sy, rig, world) {
    const mode = this.read().editMode;
    if (!["link", "unlink"].includes(mode)) {
      return;
    }
    rig.bones
      .filter((b) => b.parent && !b.deformSource)
      .forEach((b) => {
        const a = world[b.parent].end,
          c = world[b.id].start,
          dx = (c.x - a.x) * sx,
          dy = (c.y - a.y) * sy;
        const start = { x: a.x * sx, y: a.y * sy },
          end = { x: c.x * sx, y: c.y * sy };
        const path =
          Math.hypot(dx, dy) < 8
            ? `M ${start.x} ${start.y} C ${start.x + 24} ${start.y - 24}, ${end.x - 24} ${end.y - 24}, ${end.x} ${end.y}`
            : `M ${start.x} ${start.y} Q ${(start.x + end.x) / 2 + 10} ${(start.y + end.y) / 2 - 10} ${end.x} ${end.y}`;
        element("path", {
          d: path,
          fill: "none",
          stroke: "#f6c55a",
          "stroke-width": 1.5,
          "stroke-dasharray": "4 2"
        });
        if (mode === "unlink") {
          const hit = element("path", {
            d: path,
            fill: "none",
            stroke: "transparent",
            "stroke-width": 10,
            "data-rig-unlink": b.id,
            role: "button",
            tabindex: 0,
            "aria-label": "Disconnect joint " + b.name
          });
          hit.style.pointerEvents = "stroke";
          const title = document.createElementNS(svg.namespaceURI, "title");
          title.textContent = "Disconnect " + b.name + " · keep its poses";
          hit.append(title);
        }
      });
    const d = this.editorDrag;
    if (d?.type === "connect") {
      element("line", {
        x1: d.point.x * sx,
        y1: d.point.y * sy,
        x2: d.to.x * sx,
        y2: d.to.y * sy,
        stroke: d.candidate ? "#77e3a0" : d.error ? "#ef7777" : "#ffe600",
        "stroke-width": 2,
        "stroke-dasharray": "4 3",
        "data-connection-preview": "true"
      });
      if (d.target) {
        const w = world[d.target];
        element("circle", {
          cx: w.start.x * sx,
          cy: w.start.y * sy,
          r: 8,
          fill: "none",
          stroke: d.candidate ? "#77e3a0" : "#ef7777",
          "stroke-width": 2
        });
      }
    }
  };
  const init = p.initAnimatorGestures;
  p.initAnimatorGestures = function () {
    init.call(this);
    this.owner.addEventListener(
      this.owner.wrapper,
      "keydown",
      function (event) {
        const target = event.target.closest("[data-rig-unlink]");
        if (!target || !["Enter", " "].includes(event.key)) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        this.loadRigBone(target.dataset.rigUnlink, this.puppetRig());
        this.changeAnimatorParent(null);
      }.bind(this)
    );
  };
})();

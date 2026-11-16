(function () {
  const p = pskl.controller.dialogs.PuppetStudioControls.prototype,
    u = pskl.utils,
    r = u.RigStudioUtils,
    E = u.RigEditorUtils,
    clone = u.ToolStateUtils.clone;
  const labels = {
    move: "Move selected part",
    rotate: "Rotate selected part",
    scale: "Scale selected part",
    "scale-x": "Scale selected part horizontally",
    "scale-y": "Scale selected part vertically",
    shear: "Shear selected part"
  };
  p.animatorPoint = function (event, canvas) {
    const b = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - b.left) * canvas.width) / b.width,
      y: ((event.clientY - b.top) * canvas.height) / b.height
    };
  };
  p.selectAnimatorArt = function (hit, rig, pose) {
    this.selectedArt = {
      key: E.key(hit.layer),
      name: hit.layer.getName(),
      unbound: !hit.bone,
      boneId: hit.bone && hit.bone.id
    };
    if (hit.bone) {
      rig.workingPose = clone(pose);
      this.loadRigBone(hit.bone.id, rig);
      this.partTransforms = true;
    }
    this.refreshPuppet();
    this.owner.refreshWorkspacePreview_();
    this.animatorStatus(
      hit.bone
        ? "Selected " +
            hit.layer.getName() +
            ". Drag its transform handles, or use the joint tools."
        : hit.layer.getName() +
            " is unbound. In Setup, choose a joint and Bind selected art."
    );
  };
  p.handleAnimatorPointer = function (event) {
    if (this.motionPathDraft) {
      return false;
    }
    try {
      if (this.handleConnectionPointer(event)) {
        return true;
      }
      const handle = event.target.closest("[data-rig-transform]"),
        canvas = this.owner.wrapper.querySelector('[data-art-preview="after"]');
      if (handle) {
        this.beginPartTransform(event, handle.dataset.rigTransform, canvas);
        return true;
      }
      if (event.target !== canvas) {
        return false;
      }
      const o = this.read();
      if (!["pose", "select", "rest"].includes(o.editMode)) {
        return false;
      }
      const plan = this.owner.previewSession;
      if (!plan) {
        return false;
      }
      const rig = clone(plan.rig),
        pose = this.puppetShownPose(rig),
        point = this.animatorPoint(event, canvas),
        joint = r.pickJoint(rig, r.world(rig, pose), point, o.bone);
      if (joint && (joint.distance * canvas.clientWidth) / canvas.width <= 7) {
        return false;
      }
      const hit = E.hit(
        plan.rigRenderer,
        pose,
        rig.referenceFrame - 1,
        point,
        this.animatorViewOptions()
      );
      if (!hit) {
        return false;
      }
      event.preventDefault();
      this.owner.stopPreview_();
      if (o.previewAnimation) {
        const frame = Number(
          this.owner.wrapper.querySelector(
            '[aria-label="Preview animation frame"]'
          ).value
        );
        this.write("rig", { keyFrame: frame + 1, previewAnimation: false });
      }
      this.selectAnimatorArt(hit, rig, pose);
      return true;
    } catch (e) {
      this.animatorStatus(e.message);
      return true;
    }
  };
  p.beginPartTransform = function (event, kind, canvas) {
    const o = this.read(),
      rig = this.puppetRig(),
      pose = clone(this.puppetShownPose(rig));
    if (r.isSetupMode(o.editMode) || !rig.bones.some((b) => b.id === o.bone)) {
      return;
    }
    this.owner.stopPreview_();
    if (o.previewAnimation) {
      this.write("rig", {
        keyFrame:
          Number(
            this.owner.wrapper.querySelector(
              '[aria-label="Preview animation frame"]'
            ).value
          ) + 1
      });
    }
    this.write("rig", { previewAnimation: false });
    rig.workingPose = pose;
    this.editorDrag = {
      type: "transform",
      kind,
      id: o.bone,
      rig: clone(rig),
      pose,
      point: this.animatorPoint(event, canvas),
      canvas,
      box: this.editorGeometry.box,
      moved: false
    };
    this.rigDrag = null;
    this.rigDragDraft = clone(rig);
    this.owner.wrapper.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  p.initAnimatorGestures = function () {
    const wrapper = this.owner.wrapper;
    this.owner.addEventListener(
      wrapper,
      "pointermove",
      function (event) {
        const d = this.editorDrag;
        if (!d) {
          return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        if (d.type === "connect") {
          this.moveConnectionPointer(event);
          return;
        }
        try {
          const point = this.animatorPoint(event, d.canvas),
            rig = clone(d.rig);
          if (Math.hypot(point.x - d.point.x, point.y - d.point.y) < 0.01) {
            return;
          }
          rig.workingPose = E.transform(
            rig,
            d.pose,
            d.id,
            d.kind,
            d.point,
            point,
            d.box
          );
          r.validate(rig);
          this.rigDragDraft = rig;
          d.moved = true;
          this.loadRigBone(d.id, rig);
          this.owner.queueWorkspacePreview_();
        } catch (e) {
          this.animatorStatus(e.message);
        }
      }.bind(this)
    );
    ["pointerup", "pointercancel", "lostpointercapture"].forEach((type) =>
      this.owner.addEventListener(
        wrapper,
        type,
        function (event) {
          const d = this.editorDrag;
          if (!d) {
            return;
          }
          event.stopImmediatePropagation();
          if (d.type === "connect") {
            this.finishConnectionPointer(event);
            return;
          }
          this.editorDrag = null;
          if (type !== "pointerup" || !d.moved) {
            this.rigDragDraft = null;
            this.refreshRig(true, d.id);
            this.owner.refreshWorkspacePreview_();
            return;
          }
          this.commitAnimatorPose(this.rigDragDraft, d.id).catch((e) =>
            this.animatorStatus(e.message)
          );
        }.bind(this)
      )
    );
    this.owner.addEventListener(
      wrapper,
      "keydown",
      function (event) {
        if (event.key === "Escape" && this.editorDrag) {
          event.preventDefault();
          event.stopImmediatePropagation();
          this.editorDrag = null;
          this.rigDragDraft = null;
          this.refreshRig(true);
          this.owner.refreshWorkspacePreview_();
          return;
        }
        const handle = event.target.closest("[data-rig-transform]");
        if (
          !handle ||
          !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
            event.key
          )
        ) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        const kind = handle.dataset.rigTransform,
          geometry = this.editorGeometry,
          rig = this.puppetRig(),
          id = this.read().bone,
          step = event.shiftKey ? 0.1 : 1,
          negative = ["ArrowLeft", "ArrowUp"].includes(event.key),
          amount = step * (negative ? -1 : 1),
          from = { ...geometry.points[kind] },
          to = { ...from };
        if (kind === "move") {
          if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
            to.x += amount;
          } else {
            to.y += amount;
          }
        } else if (kind === "rotate") {
          const pivot = r.world(rig, rig.workingPose)[id].start,
            a = (amount * Math.PI) / 180,
            v = { x: from.x - pivot.x, y: from.y - pivot.y };
          to.x = pivot.x + v.x * Math.cos(a) - v.y * Math.sin(a);
          to.y = pivot.y + v.x * Math.sin(a) + v.y * Math.cos(a);
        } else if (kind === "scale-y") {
          to.y += (amount * geometry.box.height) / 100;
        } else {
          to.x += (amount * geometry.box.width) / 100;
        }
        try {
          rig.workingPose = E.transform(
            rig,
            rig.workingPose,
            id,
            kind,
            from,
            to,
            geometry.box
          );
          this.commitAnimatorPose(rig, id)
            .then(() => {
              this.owner.wrapper
                .querySelector('[data-rig-transform="' + kind + '"]')
                ?.focus({ preventScroll: true });
            })
            .catch((e) => this.animatorStatus(e.message));
        } catch (e) {
          this.animatorStatus(e.message);
        }
      }.bind(this)
    );
  };
  p.drawAnimatorOverlay = function (svg, element, sx, sy) {
    const plan = this.owner.previewSession;
    if (!plan || !this.editorHint || this.motionPathDraft) {
      return;
    }
    const rig = plan.rig,
      id = plan.options.bone,
      bone = rig.bones.find((b) => b.id === id),
      pose = this.puppetShownPose(rig),
      world = r.world(rig, pose);
    this.drawConnectionOverlay(svg, element, sx, sy, rig, world);
    if (!bone) {
      return;
    }
    const part = E.part(
      plan.rigRenderer,
      pose,
      id,
      this.selectedArt?.unbound ? this.selectedArt.key : null
    );
    let box = E.bounds(part);
    if (!box) {
      const w = world[id];
      box = {
        x: Math.min(w.start.x, w.end.x) - 2,
        y: Math.min(w.start.y, w.end.y) - 2,
        width: Math.max(4, Math.abs(w.start.x - w.end.x)),
        height: Math.max(4, Math.abs(w.start.y - w.end.y))
      };
    }
    const left = box.x * sx,
      top = box.y * sy,
      width = box.width * sx,
      height = box.height * sy;
    if (this.partTransforms || this.selectedArt) {
      element("rect", {
        x: left,
        y: top,
        width,
        height,
        fill: "none",
        stroke: "#ffe600",
        "stroke-width": 1,
        "stroke-dasharray": "4 3",
        "data-selected-art": bone.id
      });
    }
    if (
      !this.partTransforms ||
      r.isSetupMode(this.read().editMode) ||
      this.selectedArt?.unbound
    ) {
      return;
    }
    const canvas = this.owner.wrapper.querySelector(
        '[data-art-preview="after"]'
      ),
      pivot = world[id].start;
    const clamp = (v, max) => Math.max(8, Math.min(max - 8, v));
    const points = {
      move: { x: left + width / 2, y: top + height / 2 },
      rotate: { x: pivot.x * sx + 28, y: pivot.y * sy - 28 },
      "scale-x": { x: left + width + 7, y: top + height / 2 },
      "scale-y": { x: left + width / 2, y: top + height + 7 },
      scale: { x: left + width + 7, y: top + height + 7 },
      shear: { x: left + width + 7, y: top - 7 }
    };
    element("circle", {
      cx: pivot.x * sx,
      cy: pivot.y * sy,
      r: 39.6,
      fill: "none",
      stroke: "#ffe600",
      "stroke-opacity": 0.5,
      "stroke-width": 1,
      "stroke-dasharray": "2 3"
    });
    const modelPoints = {};
    Object.entries(points).forEach(([kind, point]) => {
      point.x = clamp(point.x, canvas.clientWidth);
      point.y = clamp(point.y, canvas.clientHeight);
      modelPoints[kind] = { x: point.x / sx, y: point.y / sy };
      const h = element(
        kind === "rotate" ? "circle" : "rect",
        kind === "rotate"
          ? { cx: point.x, cy: point.y, r: 5 }
          : {
              x: point.x - 5,
              y: point.y - 5,
              width: 10,
              height: 10,
              rx: kind === "move" ? 5 : 1
            }
      );
      Object.entries({
        fill: kind === "move" ? "#ffe600" : "#252525",
        stroke: "#ffe600",
        "stroke-width": 1.5,
        "data-rig-transform": kind,
        role: "button",
        tabindex: 0,
        "aria-label": labels[kind]
      }).forEach(([k, v]) => h.setAttribute(k, v));
      h.style.pointerEvents = "all";
      const title = document.createElementNS(svg.namespaceURI, "title");
      title.textContent = labels[kind] + " · drag or use arrow keys";
      h.append(title);
    });
    this.editorGeometry = { box, points: modelPoints };
  };
})();

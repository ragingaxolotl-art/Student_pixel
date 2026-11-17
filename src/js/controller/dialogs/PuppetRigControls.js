(function () {
  var proto = pskl.controller.dialogs.PuppetStudioControls.prototype,
    r = pskl.utils.RigStudioUtils,
    clone = pskl.utils.ToolStateUtils.clone;
  proto.loadRigBone = function (id, rig, kind) {
    if (
      this.selectedArt &&
      !this.selectedArt.unbound &&
      this.selectedArt.boneId !== id
    ) {
      this.selectedArt = null;
    }
    rig = rig || r.config(pskl.app.piskelController.getPiskel());
    var b = rig.bones.find(function (b) {
      return b.id === id;
    });
    if (!b) {
      return;
    }
    var previousHandle = this.rigSelectedHandle;
    this.rigSelectedHandle = {
      id: id,
      kind:
        kind ||
        (previousHandle && previousHandle.id === id
          ? previousHandle.kind
          : "start")
    };
    if (this.segmentArticulation && b.articulation) {
      this.segmentArticulation.value = b.articulation;
    }
    var pose = r.pose(rig.workingPose[b.id]),
      p = pskl.app.piskelController.getPiskel(),
      binding =
        b.layerId && b.layerId.indexOf("index:") === 0
          ? Number(b.layerId.substring(6))
          : p.getLayers().findIndex(function (l) {
              return l.toolState.id === b.layerId;
            });
    this.write("rig", {
      bone: b.id,
      boneName: b.name,
      parent: b.parent || "",
      restX: b.x,
      restY: b.y,
      restAngle: b.angle,
      length: b.length,
      radius: b.radius,
      radiusEnd: b.radiusEnd,
      bulge: b.bulge,
      skinColor: b.color,
      group: b.group,
      binding: binding,
      rotation: pose.rotation,
      poseX: pose.x,
      poseY: pose.y,
      scaleX: pose.scaleX * 100,
      scaleY: pose.scaleY * 100,
      shear: pose.shear * 100,
      visible: pose.visible,
      order: pose.order
    });
    var form = this.form("rig");
    form.elements["rig-order"].disabled = !!b.layerId || !!b.connector;
    form.elements["rig-order"].title =
      "Bound artwork always follows the layer stack";
    form.elements["rig-length"].disabled = !!b.connector;
    form.elements["rig-binding"].disabled = !!b.connector;
    this.form("rig")
      .querySelectorAll("[data-rig-bone-id]")
      .forEach(function (button) {
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.rigBoneId === id)
        );
      });
  };
  proto.refreshRig = function (force, selected) {
    var p = pskl.app.piskelController.getPiskel(),
      rig = r.config(p),
      form = this.form("rig"),
      key =
        JSON.stringify(rig) +
        p
          .getLayers()
          .map(function (l) {
            return l.getName() + l.toolState.id;
          })
          .join("|") +
        p.getFrameCount();
    if (!form || (!force && key === this.rigKey)) {
      return;
    }
    this.rigKey = key;
    var boneSelect = form.elements["rig-bone"],
      previous = selected || boneSelect.value;
    boneSelect.replaceChildren();
    rig.bones.forEach(function (b) {
      boneSelect.appendChild(new Option(b.name, b.id));
    });
    if (
      rig.bones.some(function (b) {
        return b.id === previous;
      })
    ) {
      boneSelect.value = previous;
    }
    var parents = form.elements["rig-parent"];
    parents.replaceChildren(new Option("Root / no parent", ""));
    rig.bones.forEach(function (b) {
      parents.appendChild(new Option(b.name, b.id));
    });
    var binding = form.elements["rig-binding"];
    binding.replaceChildren(new Option("No layer assigned", -1));
    p.getLayers().forEach(function (l, i) {
      if (
        !(l.toolState.communityOwned && l.toolState.kind === "community-rig")
      ) {
        binding.appendChild(new Option(l.getName(), i));
      }
    });
    var poseSelect = form.elements["rig-pose"],
      oldPose = poseSelect.value;
    poseSelect.replaceChildren(new Option("Working pose / save as new", ""));
    rig.poses.forEach(function (pose) {
      poseSelect.appendChild(new Option(pose.name, pose.id));
    });
    if (
      rig.poses.some(function (pose) {
        return pose.id === oldPose;
      })
    ) {
      poseSelect.value = oldPose;
    }
    var clips = form.elements["rig-clip"],
      oldClip = rig.activeClip || clips.value;
    clips.replaceChildren(new Option("Choose clip", ""));
    rig.clips.forEach(function (c) {
      clips.appendChild(
        new Option(c.name + " · " + c.keys.length + " keys", c.id)
      );
    });
    if (
      rig.clips.some(function (c) {
        return c.id === oldClip;
      })
    ) {
      clips.value = oldClip;
    }
    var clip = rig.clips.find(function (c) {
      return c.id === clips.value;
    });
    this.write("rig", {
      skin: rig.skin,
      outline: rig.outline,
      outlineColor: rig.outlineColor,
      referenceFrame: rig.referenceFrame
    });
    if (clip) {
      this.write("rig", {
        clipName: clip.name,
        frames: clip.frames,
        pingpong: clip.pingpong,
        loop: clip.loop
      });
    }
    this.loadRigBone(boneSelect.value, rig);
    var content = form.querySelector("[data-community-content]");
    content.className = "community-rig-tree";
    if (this.puppetTree) {
      this.puppetTree.querySelector("h4").after(content);
    } else {
      boneSelect.closest("label").after(content);
    }
    content.replaceChildren();
    if (!rig.bones.length) {
      var empty = document.createElement("p");
      empty.textContent = "No joints. Choose Add joint or + Joint to start.";
      content.append(empty);
    }
    rig.bones.forEach(
      function (b) {
        var button = document.createElement("button"),
          depth = 0,
          parent = b.parent;
        while (parent) {
          depth++;
          var found = rig.bones.find(function (v) {
            return v.id === parent;
          });
          parent = found && found.parent;
        }
        button.type = "button";
        button.textContent =
          (r.jointPin(b, rig.workingPose) ? "▣ " : "· ") +
          b.name +
          (b.layerName ? " · " + b.layerName : "");
        button.setAttribute("aria-pressed", String(b.id === boneSelect.value));
        button.style.paddingLeft = 6 + depth * 8 + "px";
        button.setAttribute("aria-label", "Select bone " + b.name);
        button.dataset.rigBoneId = b.id;
        button.addEventListener(
          "click",
          function () {
            this.loadRigBone(b.id, rig, "start");
            this.refreshRig(true, b.id);
            this.refreshPuppet();
            this.owner.queueWorkspacePreview_();
          }.bind(this)
        );
        content.appendChild(button);
      }.bind(this)
    );
    if (this.puppetStudioReady) {
      this.refreshPuppet();
    }
  };
  proto.rigPlan = function (p, o, plan) {
    var rig = this.rigDragDraft ? clone(this.rigDragDraft) : r.config(p, o);
    r.validate(rig);
    var renderer = new pskl.utils.RigStudioRenderer(p, rig),
      clip = rig.clips.find(function (c) {
        return c.id === rig.activeClip;
      }),
      animate =
        o.previewAnimation &&
        !r.isSetupMode(o.editMode) &&
        clip &&
        clip.keys.length;
    plan.count = animate
      ? clip.pingpong
        ? clip.frames * 2 - 2
        : clip.frames
      : 1;
    plan.rig = rig;
    plan.rigRenderer = renderer;
    plan.guidePose = function (index) {
      return r.isSetupMode(o.editMode)
        ? {}
        : animate
          ? r.poseAt(rig, clip, index)
          : rig.workingPose;
    };
    plan.render = function (index, view) {
      var pose = r.isSetupMode(o.editMode)
          ? {}
          : animate
            ? r.poseAt(rig, clip, index)
            : rig.workingPose,
        ghosts =
          o.onion && animate
            ? [-1, 1].map(function (offset) {
                return {
                  pose: r.poseAt(rig, clip, index + offset),
                  color: offset < 0 ? "#49cce0" : "#ee70b5"
                };
              })
            : [];
      var sourceFrame = animate
        ? Math.min(index, p.getFrameCount() - 1)
        : Math.min(rig.referenceFrame - 1, p.getFrameCount() - 1);
      return renderer.scene(pose, sourceFrame, ghosts, view);
    };
    return plan;
  };
  proto.drawRigOverlay = function () {
    var owner = this.owner,
      plan = owner.previewSession;
    owner.wrapper
      .querySelectorAll(".rig-vector-overlay")
      .forEach(function (svg) {
        svg.remove();
      });
    if (!plan || plan.id !== "rig") {
      return;
    }
    var canvas = owner.wrapper.querySelector('[data-art-preview="after"]'),
      width = canvas.clientWidth,
      height = canvas.clientHeight;
    if (!width || !height) {
      return;
    }
    var svgNS = "http://www.w3.org/2000/svg",
      svg = document.createElementNS(svgNS, "svg"),
      index = Number(
        owner.wrapper.querySelector('[aria-label="Preview animation frame"]')
          .value
      ),
      shown = plan.guidePose(index),
      world = r.world(plan.rig, shown),
      sx = width / canvas.width,
      sy = height / canvas.height;
    var guideStyle = this.animatorView || {
      jointSize: 5,
      lineWidth: 1.25,
      color: "#55e1df"
    };
    svg.classList.add("rig-vector-overlay");
    svg.setAttribute("viewBox", "0 0 " + width + " " + height);
    svg.setAttribute("aria-label", "Skeleton guides and bone names");
    Object.assign(svg.style, {
      left: canvas.offsetLeft + "px",
      top: canvas.offsetTop + "px",
      width: width + "px",
      height: height + "px"
    });
    var element = function (tag, attrs) {
      var el = document.createElementNS(svgNS, tag);
      Object.keys(attrs).forEach(function (k) {
        el.setAttribute(k, attrs[k]);
      });
      svg.appendChild(el);
      return el;
    };
    if (this.drawPuppetExtras) {
      this.drawPuppetExtras(svg, element, sx, sy);
    }
    plan.rig.bones
      .filter(function (bone) {
        return (
          plan.options.skeleton &&
          (world[bone.id].visible || bone.id === plan.options.bone)
        );
      })
      .forEach(function (b) {
        var w = world[b.id],
          pin = r.jointPin(b, shown),
          selected = b.id === plan.options.bone,
          color = selected ? "#ffe600" : guideStyle.color,
          x = w.end.x * sx,
          y = w.end.y * sy;
        var parentBone = plan.rig.bones.find(function (parent) {
          return parent.id === b.parent;
        });
        if (parentBone && parentBone.connector) {
          var hub = world[parentBone.id];
          element("line", {
            x1: hub.end.x * sx,
            y1: hub.end.y * sy,
            x2: w.start.x * sx,
            y2: w.start.y * sy,
            stroke: color,
            "stroke-width": guideStyle.lineWidth,
            "stroke-dasharray": "3 2",
            "data-connector-link": b.id,
            "vector-effect": "non-scaling-stroke"
          });
        }
        if (!b.connector) {
          element("line", {
            x1: w.start.x * sx,
            y1: w.start.y * sy,
            x2: x,
            y2: y,
            stroke: color,
            "stroke-width": guideStyle.lineWidth,
            "vector-effect": "non-scaling-stroke"
          });
        }
        element("circle", {
          cx: w.start.x * sx,
          cy: w.start.y * sy,
          r: b.connector
            ? Math.max(5, guideStyle.jointSize / 2)
            : guideStyle.jointSize / 2,
          fill: b.connector ? "#252525" : pin ? "#d998ff" : color,
          stroke: pin ? "#ffffff" : b.connector ? color : "#202020",
          "stroke-width": pin || b.connector ? 2 : 1,
          "data-joint-id": b.id,
          "data-joint-locked": String(!!pin),
          "data-joint-type": b.connector ? "connector" : "joint"
        });
        if (pin) {
          element("rect", {
            x: w.start.x * sx - 5,
            y: w.start.y * sy - 5,
            width: 10,
            height: 10,
            fill: "none",
            stroke: "#d998ff",
            "stroke-width": 1.5
          });
        }
        if (!b.connector) {
          element("rect", {
            x: x - 3,
            y: y - 3,
            width: 6,
            height: 6,
            fill: "#202020",
            stroke: color,
            "stroke-width": 1.25
          });
        }
        if (plan.options.labels) {
          var left = x < width * 0.45,
            text = element("text", {
              x: x + (left ? -7 : 7),
              y: y - 6,
              "text-anchor": left ? "end" : "start",
              fill: selected ? "#ffe600" : "#ffffff",
              stroke: "#171717",
              "stroke-width": 3,
              "paint-order": "stroke fill",
              "font-family": "Arial, sans-serif",
              "font-size": 11,
              "font-weight": 600
            });
          text.textContent = b.name;
        }
      });
    if (this.drawAnimatorOverlay) {
      this.drawAnimatorOverlay(svg, element, sx, sy);
    }
    canvas.parentElement.appendChild(svg);
  };
  proto.initRigUI = function () {
    var owner = this.owner,
      form = this.form("rig");
    owner.addEventListener(
      form,
      "change",
      function (event) {
        var field = event.target.dataset.field;
        if (field === "bone") {
          this.loadRigBone(event.target.value, null, "start");
          this.refreshPuppet();
        }
        if (field === "pose") {
          var pose = r
            .config(pskl.app.piskelController.getPiskel())
            .poses.find(function (p) {
              return p.id === event.target.value;
            });
          if (pose) {
            form.elements["rig-poseName"].value = pose.name;
          }
        }
        if (field === "clip") {
          var clip = r
            .config(pskl.app.piskelController.getPiskel())
            .clips.find(function (c) {
              return c.id === event.target.value;
            });
          if (clip) {
            this.write("rig", {
              clipName: clip.name,
              frames: clip.frames,
              pingpong: clip.pingpong,
              loop: clip.loop
            });
          }
        }
        if (
          [
            "rotation",
            "poseX",
            "poseY",
            "scaleX",
            "scaleY",
            "shear",
            "visible",
            "order"
          ].indexOf(field) !== -1
        ) {
          form.elements["rig-previewAnimation"].checked = false;
        }
      }.bind(this)
    );
    this.initPuppetStudio();
    if (this.initAnimatorUI) {
      this.initAnimatorUI();
    }
    var coordinate = function (event, canvas) {
      var rect = canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) * canvas.width) / rect.width,
        y: ((event.clientY - rect.top) * canvas.height) / rect.height
      };
    };
    owner.addEventListener(
      owner.wrapper,
      "pointerdown",
      function (event) {
        if (
          event.button !== 0 ||
          owner.wrapper.querySelector("#extra-tool-picker").value !== "rig"
        ) {
          return;
        }
        if (
          this.handleMotionPointerDown &&
          this.handleMotionPointerDown(event)
        ) {
          return;
        }
        if (this.handleAnimatorPointer && this.handleAnimatorPointer(event)) {
          return;
        }
        var canvas = event.target.closest('[data-art-preview="after"]');
        if (!canvas) {
          return;
        }
        try {
          var o = this.read("rig"),
            rig = r.config(pskl.app.piskelController.getPiskel(), o),
            clip = rig.clips.find(function (c) {
              return c.id === rig.activeClip;
            }),
            shownFrame = Number(
              owner.wrapper.querySelector(
                "[aria-label='Preview animation frame']"
              ).value
            ),
            shownPose =
              o.previewAnimation && clip && clip.keys.length
                ? r.poseAt(rig, clip, shownFrame)
                : rig.workingPose,
            pose = r.isSetupMode(o.editMode) ? {} : shownPose,
            world = r.world(rig, pose),
            point = coordinate(event, canvas),
            best = null;
          if (o.editMode === "root") {
            event.preventDefault();
            owner.stopPreview_();
            var independent = r.addJoint(rig, null, point);
            independent.name = "Unconnected joint " + rig.bones.length;
            independent.length = Math.max(2, Math.min(24, Math.round(canvas.width / 8)));
            this.savePuppetDraft(rig, independent.id)
              .then(function () {
                form.querySelector('[role="status"]').textContent =
                  "Unconnected joint added. It has no parent. Use Fit bones to adjust it, or Connect joints to attach it later.";
              })
              .catch(function (error) {
                form.querySelector('[role="status"]').textContent =
                  error.message;
              });
            return;
          }
          best = r.pickJoint(rig, world, point, o.bone);
          if (this.handleConnectorPointer_(event, canvas, rig, o, point)) {
            return;
          }
          if (o.editMode === "add" || o.editMode === "split") {
            var segment = r.nearestSegment(rig, point),
              tolerance = Math.max(1, (7 * canvas.width) / canvas.clientWidth);
            if (
              segment &&
              segment.distance <= tolerance &&
              segment.t > 0.02 &&
              segment.t < 0.98
            ) {
              if (o.editMode === "split") {
                var split = r.splitSegment(
                  rig,
                  segment.id,
                  segment.t,
                  this.segmentArticulation.value
                );
                this.savePuppetDraft(rig, split.id).catch(function (error) {
                  form.querySelector('[role="status"]').textContent =
                    error.message;
                });
                return;
              }
              event.preventDefault();
              owner.stopPreview_();
              owner.wrapper.setPointerCapture(event.pointerId);
              this.rigAttach = {
                parent: segment.id,
                start: segment.point,
                point: point,
                canvas: canvas,
                rig: rig
              };
              form.querySelector('[role="status"]').textContent =
                "Drag to the new joint endpoint. Parent artwork stays solid.";
              return;
            }
            if (o.editMode === "split") {
              form.querySelector('[role="status"]').textContent =
                "Click inside a segment to split it. Choose Hinge or Flexible.";
              return;
            }
            if (best && best.distance <= Math.max(2.5, canvas.width * 0.025)) {
              this.loadRigBone(best.id, rig, best.kind);
              owner.queueWorkspacePreview_();
              return;
            }
            var added = r.addJoint(rig, o.bone, point);
            this.savePuppetDraft(rig, added.id).catch(function (error) {
              form.querySelector('[role="status"]').textContent = error.message;
            });
            return;
          }
          if (!best || best.distance > Math.max(2.5, canvas.width * 0.025)) {
            return;
          }
          if (o.editMode !== "rest") {
            rig.workingPose = clone(shownPose);
          }
          this.loadRigBone(best.id, rig, best.kind);
          if (this.puppetStudioReady) {
            this.refreshPuppet();
          }
          if (
            (o.editMode === "rest" ||
              o.editMode === "add" ||
              o.editMode === "split") &&
            r.jointPin(
              rig.bones.find(function (b) {
                return b.id === best.id;
              }),
              pose
            )
          ) {
            form.querySelector('[role="status"]').textContent =
              "Unlock this pivot before fitting its bones.";
            return;
          }
          if (o.editMode === "select") {
            return;
          }
          owner.stopPreview_();
          if (this.autoKey && o.previewAnimation) {
            this.write("rig", { keyFrame: shownFrame + 1 });
          }
          form.elements["rig-previewAnimation"].checked = false;
          event.preventDefault();
          owner.wrapper.setPointerCapture(event.pointerId);
          this.rigDrag = {
            canvas: canvas,
            id: best.id,
            kind: best.kind,
            mode: o.editMode,
            point: point,
            moved: false,
            bend: Number(o.bend)
          };
          this.rigDragDraft = clone(rig);
        } catch (error) {
          form.querySelector('[role="status"]').textContent = error.message;
        }
      }.bind(this)
    );
    owner.addEventListener(
      owner.wrapper,
      "pointermove",
      function (event) {
        if (this.rigAttach) {
          var attach = this.rigAttach,
            target = coordinate(event, attach.canvas);
          this.rigDragDraft = clone(attach.rig);
          var bone = r.attachJoint(
            this.rigDragDraft,
            attach.parent,
            attach.start,
            target
          );
          attach.target = target;
          attach.selected = bone.id;
          this.loadRigBone(bone.id, this.rigDragDraft);
          owner.queueWorkspacePreview_();
          return;
        }
        var drag = this.rigDrag;
        if (!drag) {
          return;
        }
        var point = coordinate(event, drag.canvas),
          rig = this.rigDragDraft,
          b = rig.bones.find(function (b) {
            return b.id === drag.id;
          });
        if (
          Math.hypot(point.x - drag.point.x, point.y - drag.point.y) < 0.1 &&
          !drag.moved
        ) {
          return;
        }
        try {
          var world = r.world(rig, drag.mode === "rest" ? {} : rig.workingPose),
            parent = b.parent ? world[b.parent].endMatrix : r.identity(),
            local = r.point(r.inverse(parent), point.x, point.y);
          if (drag.mode === "rest") {
            if (drag.kind === "end") {
              b.angle =
                (Math.atan2(local.y - b.y, local.x - b.x) * 180) / Math.PI;
              b.length = Math.max(1, Math.hypot(local.x - b.x, local.y - b.y));
            } else {
              b.x = local.x;
              b.y = local.y;
            }
          } else {
            rig.workingPose = r.dragJoint(
              rig,
              rig.workingPose,
              b.id,
              drag.kind,
              point,
              drag.bend
            );
          }
          drag.moved = true;
          this.loadRigBone(b.id, rig);
          owner.queueWorkspacePreview_();
        } catch (error) {
          form.querySelector('[role="status"]').textContent = error.message;
        }
      }.bind(this)
    );
    var finish = function (event) {
      if (this.rigAttach) {
        var attach = this.rigAttach;
        this.rigAttach = null;
        if (
          event.type === "pointercancel" ||
          !attach.target ||
          Math.hypot(
            attach.target.x - attach.start.x,
            attach.target.y - attach.start.y
          ) < 1
        ) {
          this.rigDragDraft = null;
          this.refreshRig(true, attach.parent);
          owner.refreshWorkspacePreview_();
          return;
        }
        this.savePuppetDraft(this.rigDragDraft, attach.selected).catch(
          function (error) {
            form.querySelector('[role="status"]').textContent = error.message;
          }
        );
        return;
      }
      var drag = this.rigDrag;
      if (!drag) {
        return;
      }
      this.rigDrag = null;
      if (event.type === "pointercancel" || !drag.moved) {
        this.rigDragDraft = null;
        this.refreshRig(true, drag.id);
        return;
      }
      this.commitAnimatorPose(this.rigDragDraft, drag.id)
        .then(
          function (message) {
            form.querySelector('[role="status"]').textContent = message;
          }.bind(this)
        )
        .catch(
          function (error) {
            this.rigDragDraft = null;
            this.refreshRig(true, drag.id);
            form.querySelector('[role="status"]').textContent = error.message;
          }.bind(this)
        );
    }.bind(this);
    owner.addEventListener(
      owner.wrapper,
      "dblclick",
      function (event) {
        if (this.motionPathDraft) {
          event.preventDefault();
          return;
        }
        var canvas = owner.wrapper.querySelector('[data-art-preview="after"]');
        if (
          !canvas ||
          owner.wrapper.querySelector("#extra-tool-picker").value !== "rig"
        ) {
          return;
        }
        // Pointer capture routes the preceding clicks to the wrapper. Locate
        // the actual canvas by coordinates so double-clicking a joint works.
        var bounds = canvas.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        ) {
          return;
        }
        var rig = this.puppetRig(),
          point = coordinate(event, canvas),
          world = r.world(rig, this.puppetShownPose(rig)),
          picked = null;
        rig.bones.forEach(function (b) {
          var distance = Math.hypot(
            world[b.id].start.x - point.x,
            world[b.id].start.y - point.y
          );
          if (!picked || distance < picked.distance) {
            picked = { id: b.id, distance: distance };
          }
        });
        if (picked && picked.distance <= Math.max(2.5, canvas.width * 0.025)) {
          this.loadRigBone(picked.id, rig, "start");
          this.togglePuppetLock().catch(function (error) {
            form.querySelector('[role="status"]').textContent = error.message;
          });
        }
      }.bind(this)
    );
    owner.addEventListener(owner.wrapper, "pointerup", finish);
    owner.addEventListener(owner.wrapper, "pointercancel", finish);
  };
})();

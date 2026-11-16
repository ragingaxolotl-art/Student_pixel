(function () {
  var p = pskl.controller.dialogs.PuppetStudioControls.prototype,
    m = pskl.utils.JointMotionPathUtils,
    r = pskl.utils.RigStudioUtils,
    clone = pskl.utils.ToolStateUtils.clone;
  function node(tag, text) {
    var n = document.createElement(tag);
    if (text !== undefined) {
      n.textContent = text;
    }
    return n;
  }
  var arrange = p.arrangePuppetStudio,
    refresh = p.refreshPuppet,
    seek = p.seekPuppet,
    plan = p.rigPlan;
  p.arrangePuppetStudio = function () {
    arrange.apply(this, arguments);
    this.initJointPathUI();
  };
  p.refreshPuppet = function () {
    refresh.apply(this, arguments);
    if (this.motionPanel) {
      this.refreshJointPathUI();
    }
  };
  p.seekPuppet = function (at) {
    if (!this.motionPathDraft) {
      return seek.apply(this, arguments);
    }
    this.owner.stopPreview_();
    this.setJointPathTime(at);
  };
  p.rigPlan = function (project, options, result) {
    if (!this.motionPathDraft) {
      return plan.apply(this, arguments);
    }
    var draft = clone(r.config(project, options)),
      clip = draft.clips.find(
        function (c) {
          return c.id === this.motionPathClip;
        }.bind(this)
      );
    m.put(clip, this.motionPathDraft);
    r.validate(draft);
    var previous = this.rigDragDraft;
    this.rigDragDraft = draft;
    try {
      return plan.call(
        this,
        project,
        Object.assign({}, options, {
          previewAnimation: true,
          editMode: "motion-path"
        }),
        result
      );
    } finally {
      this.rigDragDraft = previous;
    }
  };
  p.initJointPathUI = function () {
    var panel = node("details");
    panel.className = "puppet-details joint-path-panel";
    panel.append(node("summary", "Joint motion path"));
    this.motionPanel = panel;
    this.motionBone = node("p");
    panel.append(this.motionBone);
    var field = function (label) {
      var wrapper = node("label", label),
        input = node("select");
      input.setAttribute("aria-label", label);
      wrapper.append(input);
      panel.append(wrapper);
      return input;
    };
    this.motionFrom = field("Path from pose");
    this.motionTo = field("Path to pose");
    this.motionKind = field("Path joint target");
    this.motionKind.append(
      new Option("Tip / hand / foot", "end"),
      new Option("Free root pivot", "start")
    );
    [this.motionFrom, this.motionTo, this.motionKind].forEach(
      function (input) {
        input.addEventListener(
          "change",
          function () {
            this.motionSelectionChanged = true;
            this.refreshJointPathUI();
            this.drawMotionPathOverlay();
          }.bind(this)
        );
      }.bind(this)
    );
    var actions = node("div");
    actions.className = "joint-path-actions";
    this.motionDraw = this.puppetButton(
      "Draw path",
      this.beginJointPath,
      actions
    );
    this.motionApply = this.puppetButton(
      "Apply path",
      this.applyJointPath,
      actions
    );
    this.motionCancel = this.puppetButton(
      "Cancel path",
      this.cancelJointPath,
      actions
    );
    this.motionRemove = this.puppetButton(
      "Remove path",
      this.removeJointPath,
      actions
    );
    panel.append(actions);
    var scrub = node("label", "Path preview frame"),
      range = node("input");
    range.type = "range";
    range.min = 0;
    range.max = 0;
    range.value = 0;
    range.step = 1;
    range.setAttribute("aria-label", "Path preview frame");
    scrub.append(range);
    panel.append(scrub);
    this.motionScrub = range;
    range.addEventListener(
      "input",
      function () {
        this.setJointPathTime(Number(range.value));
      }.bind(this)
    );
    this.motionInfo = node("p");
    this.motionInfo.className = "joint-path-info";
    this.motionInfo.setAttribute("aria-live", "polite");
    panel.append(this.motionInfo);
    panel.append(
      node(
        "p",
        "Draw from the start joint toward its end pose, or click to add a bend. Drag interior dots to edit; arrow keys move a focused dot. Ctrl/Cmd+Z undoes path edits; Escape cancels. White endpoints stay on saved poses. Cyan is your route; orange shows limited reach."
      )
    );
    this.puppetSide.querySelector(".puppet-options").prepend(panel);
    var tools = this.puppetTimeline.querySelector(".puppet-timeline-tools"),
      button = this.puppetButton("⌁", this.openJointPath, tools);
    button.setAttribute("aria-label", "Joint motion path");
    button.title = "Guide a joint between two saved poses";
    button.classList.add("joint-path-entry");
    button.innerHTML =
      '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M3 15C2 4 18 17 17 4" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="3" cy="15" r="2" fill="currentColor"/><circle cx="17" cy="4" r="2" fill="currentColor"/></svg>';
    var menu = Array.from(this.puppetTop.querySelectorAll(".puppet-menu")).find(
      function (d) {
        return d.querySelector("summary").textContent === "Poses";
      }
    );
    this.puppetButton(
      "Joint motion path…",
      function () {
        menu.open = false;
        this.openJointPath();
      },
      menu.querySelector(".puppet-menu-items")
    );
    this.owner.addEventListener(
      this.owner.wrapper,
      "pointermove",
      this.moveJointPathPointer.bind(this)
    );
    this.owner.addEventListener(
      this.owner.wrapper,
      "pointerup",
      this.endJointPathPointer.bind(this)
    );
    this.owner.addEventListener(
      this.owner.wrapper,
      "pointercancel",
      this.endJointPathPointer.bind(this)
    );
    this.owner.addEventListener(
      this.owner.wrapper,
      "keydown",
      function (event) {
        var key = event.key.toLowerCase();
        if (
          this.motionPathDraft &&
          (event.metaKey || event.ctrlKey) &&
          (key === "z" || key === "y")
        ) {
          event.preventDefault();
          event.stopPropagation();
          this.undoJointPath(key === "y" || event.shiftKey);
          return;
        }
        if (this.motionPathDraft && event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          this.cancelJointPath();
          return;
        }
        var index = Number(event.target.dataset.motionPoint),
          directions = {
            ArrowLeft: [-1, 0],
            ArrowRight: [1, 0],
            ArrowUp: [0, -1],
            ArrowDown: [0, 1]
          },
          delta = directions[event.key];
        if (
          !this.motionPathDraft ||
          !delta ||
          !Number.isInteger(index) ||
          index <= 0 ||
          index >= this.motionPathDraft.points.length - 1
        ) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        this.pushJointPathUndo(this.motionPathDraft.points);
        var point = this.motionPathDraft.points[index],
          step = event.shiftKey ? 0.1 : 1;
        point.x = Math.max(-8192, Math.min(8192, point.x + delta[0] * step));
        point.y = Math.max(-8192, Math.min(8192, point.y + delta[1] * step));
        this.owner.refreshWorkspacePreview_();
      }.bind(this)
    );
    this.puppetTrack.addEventListener(
      "click",
      function (event) {
        if (event.target !== this.puppetTrack) {
          return;
        }
        var context = this.jointPathContext();
        if (!context.clip) {
          return;
        }
        var rect = this.puppetTrack.getBoundingClientRect(),
          at = Math.max(
            0,
            Math.min(
              context.clip.frames - 1,
              Math.round(
                ((event.clientX - rect.left) / rect.width) *
                  (context.clip.frames - 1)
              )
            )
          );
        this.seekPuppet(at);
      }.bind(this)
    );
    this.refreshJointPathUI();
  };
  p.jointPathContext = function () {
    var rig = r.config(pskl.app.piskelController.getPiskel(), this.read()),
      clip = rig.clips.find(function (c) {
        return c.id === rig.activeClip;
      });
    return { rig: rig, clip: clip };
  };
  p.selectedJointPath = function (context) {
    return ((context.clip && context.clip.paths) || []).find(
      function (path) {
        return (
          path.bone === this.read().bone &&
          path.kind === this.motionKind.value &&
          path.from === Number(this.motionFrom.value) &&
          path.to === Number(this.motionTo.value)
        );
      }.bind(this)
    );
  };
  p.openJointPath = function () {
    this.motionPanel.open = true;
    if (this.motionPathDraft) {
      this.motionPanel.scrollIntoView({ block: "nearest" });
      this.drawMotionPathOverlay();
      return;
    }
    this.motionSelectionChanged = false;
    this.motionLastContext = null;
    this.motionFrom.value = "";
    this.refreshJointPathUI();
    this.motionPanel.scrollIntoView({ block: "nearest" });
    this.drawMotionPathOverlay();
  };
  p.refreshJointPathUI = function () {
    var context = this.jointPathContext(),
      clip = context.clip,
      rig = context.rig,
      o = this.read(),
      keys = clip
        ? clip.keys.slice().sort(function (a, b) {
            return a.at - b.at;
          })
        : [],
      bone = m.bone(rig, o.bone);
    this.motionBone.textContent =
      "Joint: " + (bone ? bone.name : "Select a joint");
    if (!this.motionPathDraft) {
      var previous = this.motionFrom.value,
        index = keys.findIndex(function (k) {
          return k.at === Number(previous);
        });
      if (previous === "" || index < 0 || index === keys.length - 1) {
        index = Math.max(
          0,
          keys.findIndex(function (k, i) {
            return (
              i < keys.length - 1 &&
              k.at <= o.keyFrame - 1 &&
              keys[i + 1].at > o.keyFrame - 1
            );
          })
        );
      }
      if (
        previous === "" &&
        keys.length > 1 &&
        o.keyFrame - 1 >= keys[keys.length - 1].at
      ) {
        index = keys.length - 2;
      }
      this.motionFrom.replaceChildren();
      this.motionTo.replaceChildren();
      keys.slice(0, -1).forEach(
        function (k) {
          var pose = rig.poses.find(function (p) {
            return p.id === k.pose;
          });
          this.motionFrom.append(
            new Option("Frame " + (k.at + 1) + " · " + pose.name, k.at)
          );
        }.bind(this)
      );
      if (keys.length >= 2) {
        this.motionFrom.value = keys[Math.min(index, keys.length - 2)].at;
        var next = keys[Math.min(index + 1, keys.length - 1)],
          pose = rig.poses.find(function (p) {
            return p.id === next.pose;
          });
        this.motionTo.append(
          new Option("Frame " + (next.at + 1) + " · " + pose.name, next.at)
        );
      }
    }
    var signature = clip
      ? clip.id +
        "|" +
        o.bone +
        "|" +
        this.motionFrom.value +
        "|" +
        this.motionTo.value
      : "";
    if (!this.motionPathDraft && clip && signature !== this.motionLastContext) {
      var existing = (clip.paths || []).find(
        function (path) {
          return (
            path.bone === o.bone &&
            path.from === Number(this.motionFrom.value) &&
            path.to === Number(this.motionTo.value)
          );
        }.bind(this)
      );
      if (existing) {
        this.motionKind.value = existing.kind;
      }
      this.motionLastContext = signature;
    }
    var path =
      this.motionPathDraft || (clip && this.selectedJointPath(context));
    this.motionDraw.disabled =
      !!this.motionPathDraft || keys.length < 2 || !bone;
    this.motionDraw.textContent =
      path && !this.motionPathDraft ? "Edit saved path" : "Draw path";
    this.motionApply.disabled = !this.motionPathDraft;
    this.motionCancel.disabled = !this.motionPathDraft;
    this.motionRemove.disabled = !!this.motionPathDraft || !path;
    this.motionFrom.disabled =
      this.motionTo.disabled =
      this.motionKind.disabled =
        !!this.motionPathDraft;
    this.motionScrub.min = path ? path.from : 0;
    this.motionScrub.max = path
      ? path.to
      : Math.max(0, clip ? clip.frames - 1 : 0);
    this.motionScrub.disabled = !path;
    if (!this.motionPathDraft) {
      this.motionInfo.textContent =
        keys.length < 2
          ? "Save at least two poses first. A path guides one interval between adjacent poses."
          : path
            ? "Saved editable path. Edit it, scrub the interval, or remove it."
            : "Choose two neighboring poses and draw a path. Your saved poses stay exact.";
    }
    this.puppetTrack
      .querySelectorAll(".joint-path-span")
      .forEach(function (span) {
        span.remove();
      });
    if (clip) {
      var visible = (clip.paths || []).filter(
        function (p) {
          return !this.motionPathDraft || p.id !== this.motionPathDraft.id;
        }.bind(this)
      );
      if (this.motionPathDraft) {
        visible.push(this.motionPathDraft);
      }
      visible.forEach(
        function (path) {
          var span = node("span");
          span.className = "joint-path-span";
          span.style.left = (path.from / (clip.frames - 1)) * 100 + "%";
          span.style.width =
            ((path.to - path.from) / (clip.frames - 1)) * 100 + "%";
          span.setAttribute("role", "img");
          span.setAttribute(
            "aria-label",
            "Joint path from frame " + (path.from + 1) + " to " + (path.to + 1)
          );
          this.puppetTrack.append(span);
        }.bind(this)
      );
    }
    this.freezeJointPathControls();
  };
  p.freezeJointPathControls = function () {
    if (!this.motionPathDraft) {
      if (this.motionDisabled) {
        this.motionDisabled.forEach(function (disabled, control) {
          control.disabled = disabled;
        });
        this.motionDisabled = null;
      }
      return;
    }
    this.motionDisabled = this.motionDisabled || new Map();
    this.form()
      .querySelectorAll("button,[data-field],.puppet-key-type")
      .forEach(
        function (control) {
          var label = control.getAttribute("aria-label"),
            allowed =
              this.motionPanel.contains(control) ||
              control.closest(".puppet-mini") ||
              control.classList.contains("puppet-key") ||
              control.classList.contains("joint-path-entry") ||
              label === "Previous pose frame" ||
              label === "Next pose frame" ||
              label === "Previous guide step" ||
              label === "Next guide step";
          if (!allowed) {
            if (!this.motionDisabled.has(control)) {
              this.motionDisabled.set(control, control.disabled);
            }
            control.disabled = true;
          }
        }.bind(this)
      );
    this.puppetTrack.querySelectorAll(".puppet-key").forEach(function (b) {
      b.draggable = false;
    });
    if (!this.motionDisabled.has(this.puppetKeyType)) {
      this.motionDisabled.set(this.puppetKeyType, this.puppetKeyType.disabled);
    }
    this.puppetKeyType.disabled = true;
  };
  p.beginJointPath = function () {
    var context = this.jointPathContext(),
      o = this.read(),
      existing = this.selectedJointPath(context),
      path = existing
        ? clone(existing)
        : m.create(
            context.rig,
            context.clip,
            o.bone,
            this.motionKind.value,
            Number(this.motionFrom.value),
            Number(this.motionTo.value)
          );
    var candidate = clone(context.rig),
      clip = candidate.clips.find(function (c) {
        return c.id === context.clip.id;
      });
    m.put(clip, path);
    r.validate(candidate);
    this.motionPrevious = {
      editMode: o.editMode,
      previewAnimation: o.previewAnimation,
      keyFrame: o.keyFrame
    };
    this.motionSavedStatus =
      this.form().querySelector('[role="status"]').textContent;
    this.form().querySelector('[role="status"]').textContent =
      "Motion path pending. Apply or Cancel in Joint motion path.";
    this.motionPathDraft = path;
    this.motionUndoStack = [];
    this.motionRedoStack = [];
    this.motionPathClip = context.clip.id;
    this.form().elements["rig-editMode"].append(
      new Option("Motion path", "motion-path")
    );
    this.write("rig", { editMode: "motion-path", previewAnimation: true });
    this.owner.stopPreview_();
    this.owner.refreshWorkspacePreview_();
    this.refreshJointPathUI();
    this.setJointPathTime(path.from);
    this.motionScrub.focus();
    this.motionInfo.textContent =
      "Pending path · draw on the canvas, drag dots, or scrub. Apply saves; Cancel keeps the previous rig.";
  };
  p.setJointPathTime = function (at) {
    var context = this.jointPathContext(),
      path = this.motionPathDraft || this.selectedJointPath(context);
    if (!path) {
      return;
    }
    at = Math.max(path.from, Math.min(path.to, Math.round(at)));
    this.owner.stopPreview_();
    if (!this.motionPathDraft) {
      this.write("rig", { previewAnimation: true, editMode: "pose" });
      this.owner.refreshWorkspacePreview_();
    }
    this.write("rig", { keyFrame: at + 1 });
    this.motionScrub.value = at;
    this.owner.wrapper.querySelector(
      '[aria-label="Preview animation frame"]'
    ).value = at;
    this.puppetFrameLabel.textContent =
      "Frame " + (at + 1) + " / " + context.clip.frames;
    this.owner.drawWorkspacePreview_();
  };
  p.finishJointPathDraft = function (restore) {
    this.motionPathDraft = null;
    this.motionPointer = null;
    this.freezeJointPathControls();
    if (restore && this.motionPrevious) {
      this.write("rig", this.motionPrevious);
    } else {
      this.write("rig", { editMode: "pose", previewAnimation: true });
    }
    this.motionPrevious = null;
    this.form().querySelector('[role="status"]').textContent = restore
      ? this.motionSavedStatus || ""
      : "Applying joint path…";
    this.refreshJointPathUI();
  };
  p.cancelJointPath = function () {
    this.finishJointPathDraft(true);
    this.owner.refreshWorkspacePreview_();
  };
  p.applyJointPath = async function () {
    if (!this.motionPathDraft) {
      return;
    }
    var context = this.jointPathContext(),
      clip = context.rig.clips.find(
        function (c) {
          return c.id === this.motionPathClip;
        }.bind(this)
      );
    m.put(clip, this.motionPathDraft);
    r.validate(context.rig);
    this.finishJointPathDraft(false);
    await this.savePuppetDraft(context.rig);
    this.motionInfo.textContent =
      "Path applied. It remains editable and is included in generated frames.";
    this.form().querySelector('[role="status"]').textContent =
      "Joint path applied. Save Rig or Generate Frames when ready.";
  };
  p.removeJointPath = async function () {
    var context = this.jointPathContext(),
      path = this.selectedJointPath(context);
    if (!path) {
      return;
    }
    context.clip.paths = context.clip.paths.filter(function (p) {
      return p.id !== path.id;
    });
    await this.savePuppetDraft(context.rig);
    this.motionInfo.textContent =
      "Path removed. The saved poses remain unchanged.";
    this.form().querySelector('[role="status"]').textContent =
      "Joint path removed. Saved poses unchanged.";
  };
  p.motionPoint = function (event) {
    var canvas = this.owner.wrapper.querySelector('[data-art-preview="after"]'),
      rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(
        -8192,
        Math.min(
          8192,
          ((event.clientX - rect.left) * canvas.width) / rect.width
        )
      ),
      y: Math.max(
        -8192,
        Math.min(
          8192,
          ((event.clientY - rect.top) * canvas.height) / rect.height
        )
      )
    };
  };
  p.handleMotionPointerDown = function (event) {
    if (
      !this.motionPathDraft ||
      event.button !== 0 ||
      !event.target.closest('[data-art-preview="after"],.joint-motion-overlay')
    ) {
      return false;
    }
    event.preventDefault();
    this.owner.stopPreview_();
    this.owner.wrapper.setPointerCapture(event.pointerId);
    var index = Number(event.target.dataset.motionPoint),
      path = this.motionPathDraft,
      point = this.motionPoint(event);
    this.motionPointer = {
      id: event.pointerId,
      before: clone(path.points),
      index:
        Number.isInteger(index) && index > 0 && index < path.points.length - 1
          ? index
          : -1
    };
    if (this.motionPointer.index >= 0) {
      event.target.focus();
    }
    if (this.motionPointer.index < 0) {
      path.points = [
        clone(path.points[0]),
        point,
        clone(path.points[path.points.length - 1])
      ];
    }
    this.owner.queueWorkspacePreview_();
    return true;
  };
  p.moveJointPathPointer = function (event) {
    var drag = this.motionPointer;
    if (!drag || drag.id !== event.pointerId) {
      return;
    }
    var path = this.motionPathDraft,
      point = this.motionPoint(event);
    if (drag.index >= 0) {
      path.points[drag.index] = point;
    } else {
      var last = path.points[path.points.length - 2];
      if (Math.hypot(last.x - point.x, last.y - point.y) > 0.1) {
        path.points.splice(path.points.length - 1, 0, point);
        if (path.points.length > 256) {
          path.points = path.points.filter(function (_, i, array) {
            return i === 0 || i === array.length - 1 || i % 2 === 0;
          });
        }
      }
    }
    this.owner.queueWorkspacePreview_();
  };
  p.endJointPathPointer = function (event) {
    var drag = this.motionPointer;
    if (!drag || drag.id !== event.pointerId) {
      return;
    }
    if (event.type === "pointercancel") {
      this.motionPathDraft.points = drag.before;
    } else {
      this.motionPathDraft.points = m.compact(this.motionPathDraft.points);
      if (
        JSON.stringify(drag.before) !==
        JSON.stringify(this.motionPathDraft.points)
      ) {
        this.pushJointPathUndo(drag.before);
      }
    }
    this.motionPointer = null;
    if (this.owner.wrapper.hasPointerCapture(event.pointerId)) {
      this.owner.wrapper.releasePointerCapture(event.pointerId);
    }
    this.owner.refreshWorkspacePreview_();
  };
  p.pushJointPathUndo = function (points) {
    this.motionUndoStack = this.motionUndoStack || [];
    this.motionUndoStack.push(clone(points));
    if (this.motionUndoStack.length > 32) {
      this.motionUndoStack.shift();
    }
    this.motionRedoStack = [];
  };
  p.undoJointPath = function (redo) {
    if (this.motionPointer) {
      var drag = this.motionPointer;
      this.motionPathDraft.points = drag.before;
      this.motionPointer = null;
      if (this.owner.wrapper.hasPointerCapture(drag.id)) {
        this.owner.wrapper.releasePointerCapture(drag.id);
      }
      this.owner.refreshWorkspacePreview_();
      return;
    }
    var source = redo ? this.motionRedoStack : this.motionUndoStack,
      target = redo ? this.motionUndoStack : this.motionRedoStack;
    if (!source || !source.length) {
      return;
    }
    target.push(clone(this.motionPathDraft.points));
    this.motionPathDraft.points = source.pop();
    this.owner.refreshWorkspacePreview_();
  };
  p.drawMotionPathOverlay = function () {
    var focused =
      document.activeElement &&
      document.activeElement.closest(".joint-motion-overlay")
        ? document.activeElement.dataset.motionPoint
        : null;
    this.owner.wrapper
      .querySelectorAll(".joint-motion-overlay")
      .forEach(function (svg) {
        svg.remove();
      });
    if (
      !this.motionPanel ||
      (!this.motionPanel.open && !this.motionPathDraft) ||
      !this.owner.previewSession
    ) {
      return;
    }
    try {
      var context = this.jointPathContext(),
        path = this.motionPathDraft || this.selectedJointPath(context);
      if (!path) {
        return;
      }
      var canvas = this.owner.wrapper.querySelector(
          '[data-art-preview="after"]'
        ),
        sx = canvas.clientWidth / canvas.width,
        sy = canvas.clientHeight / canvas.height,
        diagnostics = m.diagnostics(context.rig, context.clip, path),
        ns = "http://www.w3.org/2000/svg",
        svg = document.createElementNS(ns, "svg");
      svg.classList.add("joint-motion-overlay");
      svg.setAttribute("aria-label", "Joint motion path and editing handles");
      svg.setAttribute(
        "viewBox",
        "0 0 " + canvas.clientWidth + " " + canvas.clientHeight
      );
      Object.assign(svg.style, {
        left: canvas.offsetLeft + "px",
        top: canvas.offsetTop + "px",
        width: canvas.clientWidth + "px",
        height: canvas.clientHeight + "px"
      });
      var element = function (tag, attrs) {
          var n = document.createElementNS(ns, tag);
          Object.keys(attrs).forEach(function (key) {
            n.setAttribute(key, attrs[key]);
          });
          svg.append(n);
          return n;
        },
        coordinates = function (points) {
          return points
            .map(function (p) {
              return p.x * sx + "," + p.y * sy;
            })
            .join(" ");
        };
      element("polyline", {
        points: coordinates(diagnostics.points),
        fill: "none",
        stroke: "#58dce8",
        "stroke-width": 2,
        "stroke-dasharray": "5 3"
      });
      if (diagnostics.maxError > 0.5) {
        element("polyline", {
          points: coordinates(diagnostics.actual),
          fill: "none",
          stroke: "#ffad57",
          "stroke-width": 2
        });
      }
      diagnostics.points.forEach(
        function (point, i, array) {
          var end = i === 0 || i === array.length - 1;
          var c = element("circle", {
            cx: point.x * sx,
            cy: point.y * sy,
            r: end ? 4 : 5,
            fill: end ? "#fff" : "#58dce8",
            stroke: "#202020",
            "stroke-width": 1.5,
            "data-motion-point": i
          });
          if (this.motionPathDraft && !end) {
            c.style.pointerEvents = "all";
            c.style.cursor = "move";
            c.setAttribute("tabindex", "0");
            c.setAttribute("role", "button");
            c.setAttribute("aria-label", "Path control point " + i);
          }
          if (end) {
            var text = element("text", {
              x: point.x * sx + 7,
              y:
                point.y * sy +
                (i === array.length - 1 &&
                Math.hypot(
                  (point.x - array[0].x) * sx,
                  (point.y - array[0].y) * sy
                ) < 14
                  ? 16
                  : -7),
              fill: "#fff",
              stroke: "#222",
              "stroke-width": 2,
              "paint-order": "stroke fill",
              "font-family": "Arial, sans-serif",
              "font-size": 11
            });
            text.textContent = "Frame " + ((i === 0 ? path.from : path.to) + 1);
          }
        }.bind(this)
      );
      canvas.parentElement.append(svg);
      if (focused !== null) {
        var active = svg.querySelector('[data-motion-point="' + focused + '"]');
        if (active) {
          active.focus();
        }
      }
      if (this.motionPathDraft) {
        this.motionInfo.textContent =
          diagnostics.maxError > 0.5
            ? "Pending path · parts of this route exceed the joint's reach. Orange shows actual motion; bones keep their length."
            : "Pending path · preview follows this route. Apply saves; Cancel keeps the previous rig.";
      }
    } catch (error) {
      this.motionInfo.textContent = error.message;
    }
  };
})();

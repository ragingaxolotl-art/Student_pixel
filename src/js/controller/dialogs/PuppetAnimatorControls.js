(function () {
  const p = pskl.controller.dialogs.PuppetStudioControls.prototype,
    u = pskl.utils,
    r = u.RigStudioUtils,
    E = u.RigEditorUtils;
  const node = (tag, text) => {
    const n = document.createElement(tag);
    if (text !== undefined) {
      n.textContent = text;
    }
    return n;
  };
  const setupFields = [
    "parent",
    "restX",
    "restY",
    "restAngle",
    "length",
    "binding",
    "group"
  ];
  const poseFields = [
    "rotation",
    "poseX",
    "poseY",
    "scaleX",
    "scaleY",
    "shear",
    "targetX",
    "targetY",
    "bend",
    "order"
  ];
  p.initAnimatorUI = function () {
    this.autoKey = false;
    this.partTransforms = false;
    const saved =
      pskl.UserSettings.get(pskl.UserSettings.PUPPET_STUDIO_VIEW) || {};
    this.animatorView = {
      focus: ["all", "dim", "solo"].includes(saved.focus) ? saved.focus : "all",
      jointSize: Math.max(3, Math.min(10, Number(saved.jointSize) || 5)),
      lineWidth: Math.max(0.5, Math.min(3, Number(saved.lineWidth) || 1.25)),
      color: /^#[a-f\d]{6}$/i.test(saved.color) ? saved.color : "#55e1df"
    };
    const bar = node("div");
    bar.className = "puppet-editor-bar";
    const tabs = node("div");
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "Rig editing stage");
    this.animatorTabs = {};
    [
      ["setup", "Setup rig", "rest"],
      ["pose", "Pose / animate", "pose"]
    ].forEach(([stage, label, mode]) => {
      const b = this.puppetButton(
        label,
        function () {
          this.write("rig", { editMode: mode, previewAnimation: false });
          this.refreshPuppet();
          this.owner.refreshWorkspacePreview_();
        },
        tabs
      );
      b.setAttribute("role", "tab");
      this.animatorTabs[stage] = b;
    });
    bar.append(tabs);
    this.editorHint = node("span");
    this.editorHint.className = "puppet-editor-hint";
    this.editorHint.setAttribute("aria-live", "polite");
    bar.append(this.editorHint);
    this.puppetTools.prepend(bar);
    this.partButton = this.puppetButton(
      "Transform part",
      function () {
        this.partTransforms = !this.partTransforms;
        this.refreshPuppet();
        this.owner.resizeWorkspacePreview_();
      },
      this.puppetTools
    );
    this.partButton.title =
      "Show move, rotate, scale and shear handles for the selected artwork";
    ["link", "unlink"].forEach((mode) => {
      this.form().elements["rig-editMode"].append(
        new Option(
          mode === "link" ? "Connect joints" : "Disconnect joints",
          mode
        )
      );
      const b = this.puppetButton(
        mode === "link" ? "Connect joints" : "Disconnect joints",
        function () {
          this.write("rig", { editMode: mode, previewAnimation: false });
          this.refreshPuppet();
          this.owner.refreshWorkspacePreview_();
        },
        this.puppetTools
      );
      b.dataset.rigMode = mode;
    });
    const autoLabel = node("label", "Auto-key ");
    this.autoKeyInput = node("input");
    this.autoKeyInput.type = "checkbox";
    this.autoKeyInput.setAttribute("aria-label", "Auto-key poses");
    autoLabel.append(this.autoKeyInput);
    this.puppetTimeline
      .querySelector(".puppet-timeline-tools")
      .append(autoLabel);
    this.owner.addEventListener(
      this.autoKeyInput,
      "change",
      function () {
        this.autoKey = this.autoKeyInput.checked;
        this.refreshPuppet();
      }.bind(this)
    );
    const selection = node("div");
    selection.className = "puppet-art-selection";
    this.selectionLabel = node("span");
    selection.append(this.selectionLabel);
    this.bindArtButton = this.puppetButton(
      "Bind selected art",
      this.bindSelectedArt,
      selection
    );
    this.detachButton = this.puppetButton(
      "Disconnect selected",
      function () {
        this.changeAnimatorParent(null);
      },
      selection
    );
    this.detachButton.setAttribute("aria-label", "Disconnect selected joint");
    this.puppetTree.before(selection);
    const display = this.form()
      .querySelector('[name="rig-skeleton"]')
      .closest("details");
    const field = (label, type, initial) => {
      const wrap = node("label", label),
        input = node(type === "select" ? "select" : "input");
      if (type !== "select") {
        input.type = type;
      }
      input.setAttribute("aria-label", label);
      wrap.append(input);
      display.append(wrap);
      if (initial !== undefined) {
        input.value = initial;
      }
      return input;
    };
    const focus = field("Preview focus", "select");
    [
      ["all", "All artwork"],
      ["dim", "Dim other parts"],
      ["solo", "Only selected part"]
    ].forEach(([v, t]) => focus.append(new Option(t, v)));
    focus.value = this.animatorView.focus;
    const size = field(
      "Joint handle size",
      "range",
      this.animatorView.jointSize
    );
    size.min = 3;
    size.max = 10;
    size.step = 1;
    const width = field(
      "Guide line width",
      "range",
      this.animatorView.lineWidth
    );
    width.min = 0.5;
    width.max = 3;
    width.step = 0.25;
    const color = field("Guide color", "color", this.animatorView.color);
    [
      [focus, "focus"],
      [size, "jointSize"],
      [width, "lineWidth"],
      [color, "color"]
    ].forEach(([input, key]) =>
      this.owner.addEventListener(
        input,
        "input",
        function () {
          this.animatorView[key] = ["jointSize", "lineWidth"].includes(key)
            ? Number(input.value)
            : input.value;
          pskl.UserSettings.set(pskl.UserSettings.PUPPET_STUDIO_VIEW, {
            ...this.animatorView
          });
          this.owner.refreshWorkspacePreview_();
        }.bind(this)
      )
    );
    this.owner.addEventListener(
      this.form(),
      "change",
      function (event) {
        const key = event.target.dataset.field;
        if (key === "parent") {
          this.changeAnimatorParent(event.target.value || null);
          return;
        }
        if (
          this.autoKey &&
          poseFields.includes(key) &&
          !r.isSetupMode(this.read().editMode) &&
          this.form().checkValidity()
        ) {
          this.commitAnimatorPose(
            r.config(pskl.app.piskelController.getPiskel(), this.read()),
            this.read().bone
          ).catch((e) => this.animatorStatus(e.message));
        }
      }.bind(this)
    );
    this.initAnimatorGestures();
  };
  p.animatorStatus = function (text) {
    this.form().querySelector('[role="status"]').textContent = text;
    return text;
  };
  p.animatorPose = function (rig) {
    return this.puppetShownPose(rig);
  };
  p.animatorViewOptions = function () {
    return {
      ...this.animatorView,
      bone: this.read().bone,
      layer:
        this.selectedArt && this.selectedArt.unbound
          ? this.selectedArt.key
          : null
    };
  };
  p.bindSelectedArt = function () {
    const layers = pskl.app.piskelController.getLayers(),
      index = layers.findIndex((l) => E.key(l) === this.selectedArt?.key);
    if (index < 0) {
      throw new Error("Click artwork to select its source layer.");
    }
    this.write("rig", { binding: index });
    return this.puppetAction("save").then(() => {
      this.selectedArt.unbound = false;
      this.selectedArt.boneId = this.read().bone;
      this.refreshPuppet();
      this.owner.refreshWorkspacePreview_();
    });
  };
  p.changeAnimatorParent = function (parent) {
    try {
      const original = r.config(pskl.app.piskelController.getPiskel()),
        o = this.read(),
        bone = original.bones.find((b) => b.id === o.bone);
      if (!bone) {
        throw new Error("Select a joint first.");
      }
      const rig = r.config(pskl.app.piskelController.getPiskel(), {
        ...o,
        parent: bone.parent || ""
      });
      r.reparent(rig, bone.id, parent);
      this.owner.stopPreview_();
      return this.savePuppetDraft(rig, bone.id).then(() =>
        this.animatorStatus(
          parent
            ? "Connected. Current and saved poses keep their positions."
            : "Disconnected. Current and saved poses keep their positions."
        )
      );
    } catch (e) {
      this.refreshRig(true);
      this.animatorStatus(e.message);
      return Promise.resolve();
    }
  };
  p.commitAnimatorPose = function (rig, id) {
    try {
      const o = this.read(),
        clip = rig.clips.find((c) => c.id === rig.activeClip);
      if (this.autoKey && !r.isSetupMode(o.editMode) && clip) {
        const at = Math.max(0, Math.min(clip.frames - 1, o.keyFrame - 1)),
          existing = clip.keys.find((k) => k.at === at);
        const pose = r.recordPose(
          rig,
          clip,
          at,
          rig.workingPose,
          existing
            ? undefined
            : { type: this.puppetKeyType.value, easing: o.easing, hold: o.hold }
        );
        r.validate(rig);
        this.write("rig", { pose: pose.id });
      }
      return this.savePuppetDraft(rig, id).then(() =>
        this.animatorStatus(
          this.autoKey
            ? "Pose saved on frame " +
                this.read().keyFrame +
                ". One undo restores the edit."
            : "Pose updated. Use + Pose / replace to record it on the timeline."
        )
      );
    } catch (e) {
      this.rigDragDraft = null;
      this.refreshRig(true, id);
      this.owner.refreshWorkspacePreview_();
      return Promise.reject(e);
    }
  };
  const refresh = p.refreshPuppet;
  p.refreshPuppet = function () {
    refresh.apply(this, arguments);
    if (!this.editorHint) {
      return;
    }
    const o = this.read(),
      setup = r.isSetupMode(o.editMode),
      rig = r.config(pskl.app.piskelController.getPiskel()),
      bone = rig.bones.find((b) => b.id === o.bone);
    this.animatorStage = setup ? "setup" : "pose";
    this.form().dataset.rigStage = this.animatorStage;
    Object.entries(this.animatorTabs).forEach(([stage, b]) =>
      b.setAttribute("aria-selected", String(stage === this.animatorStage))
    );
    this.editorHint.textContent =
      (setup
        ? "Setup · changes the rig across poses"
        : "Pose · Frame " +
          o.keyFrame +
          (this.autoKey ? " · Auto-key on" : " · Record with + Pose")) +
      (bone ? " · " + bone.name : "");
    setupFields.forEach(
      (key) =>
        (this.form().elements["rig-" + key].closest("label").hidden = !setup)
    );
    poseFields.forEach(
      (key) =>
        (this.form().elements["rig-" + key].closest("label").hidden = setup)
    );
    this.puppetSources.closest("details").hidden = !setup;
    this.partButton.disabled = setup || !bone;
    this.partButton.setAttribute(
      "aria-pressed",
      String(this.partTransforms && !setup)
    );
    this.autoKeyInput.disabled = setup;
    this.detachButton.disabled = !bone || !bone.parent || !!bone.deformSource;
    this.bindArtButton.hidden = !setup;
    this.bindArtButton.disabled =
      !bone || !!bone.connector || !this.selectedArt;
    this.selectionLabel.textContent = this.selectedArt?.unbound
      ? this.selectedArt.name + " · unbound"
      : bone
        ? (bone.layerName || bone.name) +
          " · " +
          (bone.parent ? "attached" : "root")
        : "Click artwork or a joint to select it";
    this.owner.resizeWorkspacePreview_();
  };
  const plan = p.rigPlan;
  p.rigPlan = function (project, options, result) {
    const built = plan.apply(this, arguments),
      old = built.render;
    built.render = (index) => {
      if (!this.animatorView || this.animatorView.focus === "all") {
        return old(index);
      }
      return old(index, this.animatorViewOptions());
    };
    return built;
  };
})();

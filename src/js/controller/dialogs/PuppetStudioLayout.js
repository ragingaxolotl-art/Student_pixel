(function () {
  var proto = pskl.controller.dialogs.PuppetStudioControls.prototype,
    r = pskl.utils.RigStudioUtils,
    clone = pskl.utils.ToolStateUtils.clone;
  var node = function (tag, cls, text) {
    var n = document.createElement(tag);
    n.className = cls || "";
    if (text !== undefined) {
      n.textContent = text;
    }
    return n;
  };
  proto.puppetAction = async function (action) {
    var status = this.form("rig").querySelector('[role="status"]');
    try {
      status.textContent = await this.service.performRig(
        action,
        this.read("rig"),
        this
      );
      this.owner.queueWorkspacePreview_();
      this.refreshPuppet();
    } catch (error) {
      status.textContent = error.message;
    }
  };
  proto.savePuppetDraft = async function (rig, selected) {
    try {
      r.validate(rig);
      this.rigDragDraft = rig;
      await this.service.performRig("save-draft", this.read("rig"), this);
      this.refreshRig(true, selected);
      this.refreshPuppet();
      this.owner.refreshWorkspacePreview_();
    } catch (error) {
      this.rigDragDraft = null;
      this.refreshRig(true, selected);
      this.owner.refreshWorkspacePreview_();
      throw error;
    }
  };
  proto.puppetRig = function () {
    return (
      this.rigDragDraft ||
      r.config(pskl.app.piskelController.getPiskel(), this.read("rig"))
    );
  };
  proto.puppetButton = function (label, action, parent) {
    var b = node("button", "button", label);
    b.type = "button";
    b.addEventListener(
      "click",
      function (event) {
        Promise.resolve()
          .then(
            function () {
              return action.call(this, event);
            }.bind(this)
          )
          .catch(
            function (error) {
              this.form("rig").querySelector('[role="status"]').textContent =
                error.message;
            }.bind(this)
          );
      }.bind(this)
    );
    parent.append(b);
    return b;
  };
  proto.initPuppetStudio = function () {
    var form = this.form("rig"),
      owner = this.owner;
    form.classList.add("puppet-form");
    var labels = Array.from(form.children).filter(function (n) {
        return n.tagName === "LABEL";
      }),
      actions = form.querySelector(".extra-tools-actions"),
      content = form.querySelector("[data-community-content]"),
      status = form.querySelector('[role="status"]');
    form.querySelector("h4").hidden = true;
    form.querySelector("p").hidden = true;
    this.puppetTop = node("div", "puppet-top");
    var title = node("strong", "", "Puppet Studio");
    this.puppetTop.append(title);
    this.puppetButton(
      "All tools",
      function () {
        var picker = owner.wrapper.querySelector("#extra-tool-picker");
        picker.value = "outline";
        picker.dispatchEvent(new Event("change", { bubbles: true }));
      },
      this.puppetTop
    );
    this.puppetButton(
      "Starting frame…",
      this.choosePuppetFrame,
      this.puppetTop
    );
    var template = form.elements["rig-template"].closest("label");
    this.puppetTop.append(template);
    this.puppetButton(
      "Load template",
      function () {
        this.puppetAction("template");
      },
      this.puppetTop
    );
    this.puppetButton(
      "Custom rig",
      function () {
        var p = pskl.app.piskelController.getPiskel(),
          rig = r.config(p);
        rig.bones = [];
        rig.workingPose = {};
        rig.poses = [];
        rig.clips = [
          {
            id: "default",
            name: "Walk",
            frames: 24,
            keys: [],
            loop: true,
            pingpong: false
          }
        ];
        rig.activeClip = "default";
        rig.skin = false;
        var root = r.addJoint(rig, null, {
          x: p.getWidth() / 2,
          y: p.getHeight() / 2
        });
        root.name = "Character";
        this.savePuppetDraft(rig, root.id);
      },
      this.puppetTop
    );
    this.puppetTools = node("div", "puppet-tools");
    var modes = [
      ["pose", "Pose", "Move limbs without stretching bones"],
      ["rest", "Fit bones", "Move pivots and change bone lengths"],
      ["select", "Select", "Select a joint without moving it"],
      [
        "root",
        "Add unconnected joint",
        "Click anywhere to place an independent joint with no parent, even over another bone. Use Fit bones to adjust its length."
      ],
      [
        "connector",
        "Connector",
        "Click a body segment to place a shoulder or pelvis attachment"
      ],
      [
        "connect",
        "Attach limb",
        "Select a connector, then click a limb segment to attach it"
      ],
      [
        "add",
        "Add joint",
        "Drag from anywhere on a segment to attach a joint; click empty space to extend the selected bone"
      ]
    ];
    modes.forEach(
      function (mode) {
        var b = this.puppetButton(
          mode[1],
          function () {
            form.elements["rig-editMode"].value = mode[0];
            form.elements["rig-previewAnimation"].checked = false;
            owner.queueWorkspacePreview_();
            this.refreshPuppet();
          },
          this.puppetTools
        );
        b.dataset.rigMode = mode[0];
        b.title = mode[2];
        if (mode[0] === "connect") {
          this.puppetConnectButton = b;
        }
      }.bind(this)
    );
    form.elements["rig-editMode"].append(
      new Option("Add joints", "add"),
      new Option("Add unconnected joint", "root"),
      new Option("Connector", "connector"),
      new Option("Attach limb", "connect"),
      new Option("Split segment", "split")
    );
    this.puppetButton(
      "Split segment",
      function () {
        this.write("rig", { editMode: "split", previewAnimation: false });
        this.refreshPuppet();
        owner.refreshWorkspacePreview_();
      },
      this.puppetTools
    ).dataset.rigMode = "split";
    var bendingLabel = node("label", "", "Bending "),
      bending = node("select");
    bending.setAttribute("aria-label", "Segment articulation");
    bending.add(new Option("Hinge", "hinge"));
    bending.add(new Option("Flexible", "flexible"));
    bending.title =
      "Used by Split segment. Add joint keeps the parent artwork solid.";
    bendingLabel.append(bending);
    this.puppetTools.append(bendingLabel);
    this.segmentArticulation = bending;
    bending.addEventListener(
      "change",
      function () {
        var rig = this.puppetRig(),
          bone = rig.bones.find(
            function (b) {
              return b.id === this.read("rig").bone;
            }.bind(this)
          );
        if (bone && bone.deformSource) {
          bone.articulation = bending.value;
          this.savePuppetDraft(rig, bone.id);
        }
      }.bind(this)
    );
    this.puppetLock = this.puppetButton(
      "Lock joint",
      this.togglePuppetLock,
      this.puppetTools
    );
    this.puppetLock.title =
      "Pin the selected pivot in place; connected bones can rotate. Double-click a joint to toggle.";
    this.puppetSide = node("aside", "puppet-side");
    var preview = node("section", "puppet-mini");
    preview.append(node("h4", "", "Animation preview"));
    this.puppetMini = node("canvas");
    this.puppetMini.setAttribute("aria-label", "Puppet animation preview");
    preview.append(this.puppetMini);
    this.puppetButton(
      "▶ / Ⅱ",
      function () {
        if (owner.previewInterval) {
          owner.stopPreview_();
          return;
        }
        form.elements["rig-previewAnimation"].checked = true;
        form.elements["rig-editMode"].value = "pose";
        owner.refreshWorkspacePreview_();
        owner.wrapper.querySelector('[data-action="play-preview"]').click();
      },
      preview
    ).setAttribute("aria-label", "Play or pause puppet animation");
    var speed = node("label", "", "Speed "),
      fps = node("input");
    fps.type = "range";
    fps.min = 1;
    fps.max = 60;
    fps.value = pskl.app.piskelController.getPiskel().getFPS() || 12;
    fps.setAttribute("aria-label", "Puppet playback FPS");
    this.puppetFPS = fps;
    speed.append(fps);
    preview.append(speed);
    this.puppetSide.append(preview);
    var scroll = node("div", "puppet-options");
    this.puppetTree = node("section", "puppet-hierarchy");
    this.puppetTree.append(node("h4", "", "Character hierarchy"), content);
    var treeButtons = node("div", "puppet-small-actions");
    this.puppetButton(
      "+ Joint",
      function () {
        this.puppetAction(this.puppetRig().bones.length ? "add" : "root");
      },
      treeButtons
    );
    this.puppetButton(
      "+ Group",
      function () {
        this.puppetAction("root");
      },
      treeButtons
    );
    this.puppetButton(
      "− Joint",
      function () {
        this.puppetAction("delete");
      },
      treeButtons
    );
    this.puppetTree.append(treeButtons);
    this.puppetClearButton = this.puppetButton(
      "Clear joints",
      async function () {
        var empty = r.clearJoints(clone(this.puppetRig()));
        await this.savePuppetDraft(empty);
        this.write("rig", { editMode: "add", previewAnimation: false });
        this.refreshPuppet();
        form.querySelector('[role="status"]').textContent =
          "Joints cleared. Artwork and frames are kept. Undo restores the rig.";
      },
      treeButtons
    );
    this.puppetClearButton.title =
      "Clear all joints and pose keys. Artwork is kept; Undo restores the rig.";
    scroll.append(this.puppetTree);
    var sections = {};
    [
      ["bone", "Joint & layer"],
      ["pose", "Pose & cycle"],
      ["skin", "Display"],
      ["file", "Rig files"]
    ].forEach(function (s) {
      var details = node("details", "puppet-details");
      details.append(node("summary", "", s[1]));
      sections[s[0]] = details;
      scroll.append(details);
    });
    sections.bone.open = true;
    var sourceDetails = node("details", "puppet-details");
    sourceDetails.append(node("summary", "", "Source layers & groups"));
    this.puppetSources = node("div", "puppet-source-list");
    sourceDetails.append(this.puppetSources);
    scroll.insertBefore(sourceDetails, sections.bone);
    labels.forEach(function (label) {
      var key = label.querySelector("[data-field]").dataset.field;
      if (key === "template") {
        return;
      }
      var section =
        [
          "poseName",
          "pose",
          "clip",
          "clipName",
          "frames",
          "keyFrame",
          "easing",
          "hold",
          "loop",
          "pingpong",
          "previewAnimation"
        ].indexOf(key) !== -1
          ? "pose"
          : [
                "skin",
                "outline",
                "outlineColor",
                "skeleton",
                "labels",
                "onion"
              ].indexOf(key) !== -1
            ? "skin"
            : key === "files"
              ? "file"
              : "bone";
      sections[section].append(label);
    });
    this.puppetGuides = node("details", "puppet-details puppet-guides");
    this.puppetGuides.append(node("summary", "", "Walking guides"));
    this.puppetGuideList = node("div");
    this.puppetGuides.append(this.puppetGuideList);
    this.puppetButton(
      "+ Guide",
      function () {
        var rig = this.puppetRig(),
          p = pskl.app.piskelController.getPiskel();
        rig.guides = rig.guides || [];
        if (rig.guides.length >= 32) {
          return;
        }
        rig.guides.push({
          name: "Guide " + (rig.guides.length + 1),
          axis: "horizontal",
          position: p.getHeight() / 2,
          color: "#f0bd59",
          visible: true
        });
        this.savePuppetDraft(rig);
      },
      this.puppetGuides
    );
    scroll.prepend(this.puppetGuides);
    this.puppetSide.append(scroll);
    this.puppetFooter = node("div", "puppet-footer");
    // Keep the existing action container as the ancestor of every action button.
    var primary = node("div", "puppet-primary"),
      more = node("details", "puppet-more-actions");
    more.append(node("summary", "", "Poses, clips & rig files"));
    Array.from(actions.children).forEach(function (b) {
      var id = b.dataset.communityAction;
      if (id === "save") {
        b.textContent = "Save Rig";
        b.classList.remove("button-primary");
        primary.append(b);
      } else if (id === "bake") {
        b.textContent = "Generate Frames";
        b.classList.add("button-primary");
        primary.append(b);
      } else {
        more.append(b);
      }
    });
    actions.append(primary, more);
    this.puppetFooter.append(actions, status);
    this.puppetSide.append(this.puppetFooter);
    this.puppetTimeline = node("section", "puppet-timeline");
    var timelineTools = node("div", "puppet-timeline-tools");
    this.puppetButton(
      "◀",
      function () {
        this.stepPuppet(-1);
      },
      timelineTools
    ).setAttribute("aria-label", "Previous pose frame");
    this.puppetFrameLabel = node("span", "", "Frame 1");
    timelineTools.append(this.puppetFrameLabel);
    this.puppetButton(
      "▶",
      function () {
        this.stepPuppet(1);
      },
      timelineTools
    ).setAttribute("aria-label", "Next pose frame");
    this.puppetButton("+ Pose / replace", this.recordPuppetPose, timelineTools);
    this.puppetKeyType = node("select");
    this.puppetKeyType.setAttribute("aria-label", "Pose marker type");
    [
      ["key", "Key pose"],
      ["breakdown", "Breakdown"],
      ["inbetween", "In-between"],
      ["anticipation", "Anticipation"],
      ["overshoot", "Overshoot"],
      ["settle", "Settle"]
    ].forEach(
      function (v) {
        this.puppetKeyType.append(new Option(v[1], v[0]));
      }.bind(this)
    );
    this.puppetKeyType.title =
      "Choose the purpose of this pose. Change an existing marker's type without changing its pose. Exaggerate a pose by pushing its joints further.";
    this.puppetKeyType.addEventListener(
      "change",
      function () {
        var rig = this.puppetRig(),
          clip = rig.clips.find(function (c) {
            return c.id === rig.activeClip;
          }),
          at = this.read("rig").keyFrame - 1,
          key =
            clip &&
            clip.keys.find(function (k) {
              return k.at === at;
            });
        if (key) {
          key.type = this.puppetKeyType.value;
          this.savePuppetDraft(rig);
        }
      }.bind(this)
    );
    timelineTools.append(this.puppetKeyType);
    this.puppetTimeline.append(timelineTools);
    this.puppetTrack = node("div", "puppet-track");
    this.puppetTrack.setAttribute("aria-label", "Pose timeline");
    this.puppetTimeline.append(this.puppetTrack);
    this.puppetTrack.addEventListener(
      "dblclick",
      function (e) {
        if (e.target !== this.puppetTrack) {
          return;
        }
        var clip = this.activePuppetClip(),
          rect = this.puppetTrack.getBoundingClientRect();
        this.write("rig", {
          keyFrame: Math.min(
            clip.frames,
            Math.max(
              1,
              Math.round(
                ((e.clientX - rect.left) / rect.width) * (clip.frames - 1)
              ) + 1
            )
          )
        });
        this.recordPuppetPose();
      }.bind(this)
    );
    form.append(
      this.puppetTop,
      this.puppetTools,
      this.puppetSide,
      this.puppetTimeline
    );
    this.puppetStudioReady = true;
  };
  proto.activePuppetClip = function () {
    var rig = this.puppetRig();
    return rig.clips.find(function (c) {
      return c.id === rig.activeClip;
    });
  };
  proto.setPuppetActive = function (active) {
    if (!this.puppetStudioReady) {
      return;
    }
    var wrapper = this.owner.wrapper,
      viewer = wrapper.querySelector(".extra-tools-viewer"),
      form = this.form("rig");
    wrapper.classList.toggle("puppet-studio", active);
    if (active) {
      form.append(viewer);
      if (!this.puppetEntered) {
        this.puppetEntered = true;
        this.choosePuppetFrame();
      }
      this.refreshPuppet();
    } else {
      wrapper
        .querySelector(".extra-workspace-grid")
        .insertBefore(viewer, wrapper.querySelector(".extra-tools-settings"));
      if (this.puppetChooser) {
        this.puppetChooser.remove();
        this.puppetChooser = null;
      }
    }
  };
  proto.choosePuppetFrame = function () {
    if (this.puppetChooser) {
      return;
    }
    var p = pskl.app.piskelController.getPiskel(),
      rig = r.config(p),
      chooser = node("section", "puppet-start"),
      panel = node("div", "puppet-start-panel");
    chooser.setAttribute("role", "dialog");
    chooser.setAttribute("aria-modal", "true");
    chooser.setAttribute("aria-label", "Choose starting frame");
    panel.append(
      node("h3", "", "Choose your starting frame"),
      node(
        "p",
        "",
        "Use a character with its body parts on separate layers. Choose the pose to rig; your source artwork stays intact."
      )
    );
    var label = node("label", "", "Starting frame "),
      input = node("input");
    input.type = "number";
    input.min = 1;
    input.max = p.getFrameCount();
    input.value = Math.min(rig.referenceFrame, p.getFrameCount());
    input.setAttribute("aria-label", "Starting frame");
    label.append(input);
    panel.append(label);
    var image = node("canvas");
    image.setAttribute("aria-label", "Starting frame artwork");
    panel.append(image);
    var draw = function () {
      var f =
          Math.min(p.getFrameCount(), Math.max(1, Number(input.value) || 1)) -
          1,
        canvas = pskl.utils.LayerUtils.flattenFrameAt(p.getLayers(), f, true);
      image.width = canvas.width;
      image.height = canvas.height;
      image.getContext("2d").drawImage(canvas, 0, 0);
    };
    input.addEventListener("input", draw);
    draw();
    panel.append(
      node(
        "p",
        "",
        p.getLayers().length +
          " layers · Add joints to fit your character, or optionally load a template."
      )
    );
    var start = this.puppetButton(
      "Start rigging",
      async function () {
        var frame = Number(input.value);
        if (
          !Number.isInteger(frame) ||
          frame < 1 ||
          frame > p.getFrameCount()
        ) {
          input.reportValidity();
          return;
        }
        var setup = r.config(p);
        setup.referenceFrame = frame;
        setup.skin = false;
        if (!p.toolState.rigStudio) {
          setup.bones = [];
          setup.workingPose = {};
          setup.poses = [];
          var root = r.addJoint(setup, null, {
            x: p.getWidth() / 2,
            y: p.getHeight() / 2
          });
          root.name = "Character";
        }
        setup.guides = setup.guides || [
          {
            name: "Floor",
            axis: "horizontal",
            position: p.getHeight() * 0.93,
            color: "#66d29a",
            visible: true
          },
          {
            name: "Head high",
            axis: "horizontal",
            position: p.getHeight() * 0.12,
            color: "#e6b959",
            visible: true
          },
          {
            name: "Head bob low",
            axis: "horizontal",
            position: p.getHeight() * 0.18,
            color: "#e6b959",
            visible: true
          }
        ];
        start.disabled = true;
        try {
          this.write("rig", {
            referenceFrame: frame,
            skin: false,
            editMode: p.toolState.rigStudio ? "pose" : "rest",
            previewAnimation: false
          });
          var world = r.world(setup, setup.workingPose),
            selected =
              setup.bones.find(function (bone) {
                return world[bone.id].visible;
              }) || setup.bones[0];
          await this.savePuppetDraft(setup, selected ? selected.id : null);
          chooser.remove();
          this.puppetChooser = null;
        } catch (e) {
          start.disabled = false;
          panel.append(node("p", "", e.message));
        }
      },
      panel
    );
    start.classList.add("button-primary");
    this.puppetButton(
      "Cancel",
      function () {
        chooser.remove();
        this.puppetChooser = null;
        wrapperClose(this.owner);
      },
      panel
    );
    chooser.append(panel);
    this.owner.wrapper.append(chooser);
    this.puppetChooser = chooser;
    input.focus();
  };
  function wrapperClose(owner) {
    owner.wrapper.querySelector(".dialog-close").click();
  }
  proto.puppetShownPose = function (rig) {
    var options = this.read("rig"),
      clip = rig.clips.find(function (c) {
        return c.id === rig.activeClip;
      }),
      frame = Number(
        this.owner.wrapper.querySelector(
          '[aria-label="Preview animation frame"]'
        ).value
      );
    return r.isSetupMode(options.editMode)
      ? {}
      : options.previewAnimation && clip && clip.keys.length
        ? r.poseAt(rig, clip, frame)
        : rig.workingPose;
  };
  proto.puppetLockTarget = function (rig, pose) {
    var id = this.read("rig").bone,
      selected = this.rigSelectedHandle;
    return r.pinTarget(
      rig,
      pose,
      id,
      selected && selected.id === id ? selected.kind : "start"
    );
  };
  proto.togglePuppetLock = function () {
    var options = this.read("rig"),
      keyFrame = options.previewAnimation
        ? Number(
            this.owner.wrapper.querySelector(
              '[aria-label="Preview animation frame"]'
            ).value
          )
        : options.keyFrame - 1,
      rig = this.puppetRig(),
      shown = this.puppetShownPose(rig),
      b = this.puppetLockTarget(rig, shown);
    if (!b) {
      throw new Error(
        "Select a joint circle, or choose the lower bone in the hierarchy, to lock its pivot."
      );
    }
    rig.workingPose = clone(shown);
    this.write("rig", { previewAnimation: false, editMode: "pose" });
    var pin = r.jointPin(b, shown);
    if (pin) {
      var world = r.world(rig, rig.workingPose),
        parent = b.parent ? world[b.parent].endMatrix : r.identity(),
        local = r.point(r.inverse(parent), pin.x, pin.y);
      rig.workingPose[b.id] = Object.assign(r.pose(rig.workingPose[b.id]), {
        x: local.x - b.x,
        y: local.y - b.y,
        pin: null
      });
    } else {
      rig.workingPose[b.id] = Object.assign({}, rig.workingPose[b.id], {
        pin: clone(r.world(rig, rig.workingPose)[b.id].start)
      });
    }
    var clip = rig.clips.find(function (c) {
      return c.id === rig.activeClip;
    });
    if (clip) {
      var at = Math.max(0, Math.min(clip.frames - 1, keyFrame));
      var saved = r.recordPose(rig, clip, at, rig.workingPose);
      this.write("rig", { pose: saved.id, keyFrame: at + 1 });
    }
    return this.savePuppetDraft(rig, b.id);
  };
  proto.stepPuppet = function (delta) {
    var clip = this.activePuppetClip();
    if (!clip) {
      return;
    }
    this.seekPuppet(
      Math.max(
        0,
        Math.min(clip.frames - 1, this.read("rig").keyFrame - 1 + delta)
      )
    );
  };
  proto.seekPuppet = function (at) {
    var rig = this.puppetRig(),
      clip = rig.clips.find(function (c) {
        return c.id === rig.activeClip;
      });
    this.owner.stopPreview_();
    rig.workingPose = r.poseAt(rig, clip, at);
    this.write("rig", {
      keyFrame: at + 1,
      previewAnimation: false,
      editMode: "pose"
    });
    var key = clip.keys.find(function (k) {
      return k.at === at;
    });
    if (key) {
      this.write("rig", { pose: key.pose });
      this.puppetKeyType.value = key.type || "key";
    } else {
      rig.workingPose = r.releasePins(rig, rig.workingPose);
      this.write("rig", { pose: "" });
    }
    this.savePuppetDraft(rig, this.read("rig").bone);
  };
  proto.recordPuppetPose = function () {
    var rig = this.puppetRig(),
      clip = rig.clips.find(function (c) {
        return c.id === rig.activeClip;
      });
    if (!clip) {
      return;
    }
    var at = Math.max(
      0,
      Math.min(clip.frames - 1, this.read("rig").keyFrame - 1)
    );
    var pose = r.recordPose(rig, clip, at, rig.workingPose, {
      easing: this.read("rig").easing,
      hold: this.read("rig").hold,
      type: this.puppetKeyType.value
    });
    this.write("rig", { pose: pose.id });
    this.savePuppetDraft(rig, this.read("rig").bone);
  };
  proto.refreshPuppet = function () {
    if (!this.puppetStudioReady) {
      return;
    }
    var rig = r.config(pskl.app.piskelController.getPiskel()),
      o = this.read("rig");
    var selectedBone = rig.bones.find(function (b) {
      return b.id === o.bone;
    });
    if (this.puppetConnectButton) {
      this.puppetConnectButton.disabled = !(
        selectedBone && selectedBone.connector
      );
    }
    if (this.puppetClearButton) {
      this.puppetClearButton.disabled = !rig.bones.length;
    }
    this.puppetTools.querySelectorAll("[data-rig-mode]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.rigMode === o.editMode));
    });
    var shownPose = this.puppetShownPose(rig),
      lockTarget = this.puppetLockTarget(rig, shownPose),
      locked = lockTarget && r.jointPin(lockTarget, shownPose);
    this.puppetLock.textContent = locked ? "Unlock joint" : "Lock joint";
    this.puppetLock.setAttribute("aria-pressed", String(!!locked));
    this.puppetLock.disabled = !lockTarget;
    this.puppetLock.title = lockTarget
      ? "Hold " +
        lockTarget.name +
        " pivot in this pose. Saves this frame only; its limb can still rotate."
      : "Select a joint circle or a lower bone in the hierarchy to lock its pivot.";
    this.puppetSources.replaceChildren();
    var project = pskl.app.piskelController.getPiskel(),
      layers = project.getLayers(),
      g = pskl.utils.LayerGroupUtils;
    layers
      .slice()
      .reverse()
      .forEach(
        function (layer) {
          if (
            layer.toolState.communityOwned &&
            layer.toolState.kind === "community-rig"
          ) {
            return;
          }
          var bound = rig.bones.find(function (b) {
            return (
              b.layerId === layer.toolState.id ||
              b.layerId === "index:" + layers.indexOf(layer)
            );
          });
          var b = this.puppetButton(
            (g.isGroup(layer) ? "▾ " : "· ") +
              layer.getName() +
              (bound ? " → " + bound.name : ""),
            function () {
              if (bound && bound.id !== o.bone) {
                this.loadRigBone(bound.id, rig);
                this.refreshRig(true, bound.id);
                return;
              }
              this.write("rig", { binding: layers.indexOf(layer) });
              this.puppetAction("save");
            },
            this.puppetSources
          );
          b.style.paddingLeft =
            6 + g.ancestors(layers, layer).length * 12 + "px";
          b.title = bound
            ? "Bound to " + bound.name
            : "Bind " + layer.getName() + " to the selected joint";
          b.setAttribute("aria-label", "Bind layer " + layer.getName());
          b.disabled = !selectedBone || !!selectedBone.connector;
        }.bind(this)
      );
    this.puppetGuideList.replaceChildren();
    (rig.guides || []).forEach(
      function (guide, index) {
        var row = node("div", "puppet-guide-row");
        [
          ["visible", "checkbox"],
          ["name", "text"],
          ["axis", "select"],
          ["position", "number"],
          ["color", "color"]
        ].forEach(
          function (pair) {
            var input = node(pair[1] === "select" ? "select" : "input");
            if (pair[1] === "select") {
              input.append(
                new Option("↔", "horizontal"),
                new Option("↕", "vertical")
              );
            } else {
              input.type = pair[1];
            }
            input.value = guide[pair[0]];
            input.checked = guide.visible !== false;
            if (pair[1] === "number") {
              input.min = -4096;
              input.max = 4096;
              input.step = "any";
            }
            input.setAttribute("aria-label", guide.name + " " + pair[0]);
            input.addEventListener(
              "change",
              function () {
                var draft = this.puppetRig();
                draft.guides[index][pair[0]] =
                  pair[1] === "checkbox"
                    ? input.checked
                    : pair[1] === "number"
                      ? Number(input.value)
                      : input.value;
                this.savePuppetDraft(draft);
              }.bind(this)
            );
            row.append(input);
          }.bind(this)
        );
        this.puppetButton(
          "×",
          function () {
            var draft = this.puppetRig();
            draft.guides.splice(index, 1);
            this.savePuppetDraft(draft);
          },
          row
        ).setAttribute("aria-label", "Remove guide " + guide.name);
        this.puppetGuideList.append(row);
      }.bind(this)
    );
    var clip = rig.clips.find(function (c) {
      return c.id === rig.activeClip;
    });
    this.puppetTrack.replaceChildren();
    this.puppetFrameLabel.textContent =
      "Frame " + o.keyFrame + " / " + (clip ? clip.frames : 0);
    if (!clip) {
      return;
    }
    this.puppetTrack.style.setProperty("--rig-frames", clip.frames);
    clip.keys.forEach(
      function (key) {
        var b = this.puppetButton(
          String(key.at + 1),
          function () {
            this.seekPuppet(key.at);
          },
          this.puppetTrack
        );
        b.classList.add("puppet-key");
        b.dataset.keyType = key.type || "key";
        b.setAttribute(
          "aria-current",
          key.at === o.keyFrame - 1 ? "step" : "false"
        );
        b.style.left = (key.at / (clip.frames - 1)) * 100 + "%";
        b.setAttribute(
          "aria-label",
          (key.type || "key") + " pose at frame " + (key.at + 1)
        );
        b.title =
          "Frame " +
          (key.at + 1) +
          " · " +
          (key.type || "key") +
          " · Drag to change timing. Arrow keys move one frame.";
        b.draggable = true;
        b.addEventListener("dragstart", function (e) {
          e.dataTransfer.setData("text/plain", String(key.at));
        });
        b.addEventListener(
          "keydown",
          function (e) {
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
              e.preventDefault();
              this.retimePuppet(
                key.at,
                key.at + (e.key === "ArrowLeft" ? -1 : 1)
              );
            }
          }.bind(this)
        );
      }.bind(this)
    );
    if (!this.puppetDropReady) {
      this.puppetDropReady = true;
      this.puppetTrack.addEventListener("dragover", function (e) {
        e.preventDefault();
      });
      this.puppetTrack.addEventListener(
        "drop",
        function (e) {
          e.preventDefault();
          var rect = this.puppetTrack.getBoundingClientRect(),
            c = this.activePuppetClip();
          this.retimePuppet(
            Number(e.dataTransfer.getData("text/plain")),
            Math.max(
              0,
              Math.min(
                c.frames - 1,
                Math.round(
                  ((e.clientX - rect.left) / rect.width) * (c.frames - 1)
                )
              )
            )
          );
        }.bind(this)
      );
    }
  };
  proto.retimePuppet = function (from, to) {
    var rig = this.puppetRig(),
      clip = rig.clips.find(function (c) {
        return c.id === rig.activeClip;
      });
    try {
      r.moveKey(clip, from, to);
      this.write("rig", { keyFrame: to + 1 });
      this.savePuppetDraft(rig);
    } catch (e) {
      this.form("rig").querySelector('[role="status"]').textContent = e.message;
    }
  };
  proto.drawPuppetExtras = function (svg, element, sx, sy) {
    var plan = this.owner.previewSession;
    if (!plan) {
      return;
    }
    (plan.rig.guides || [])
      .filter(function (g) {
        return g.visible !== false;
      })
      .forEach(function (g) {
        var vertical = g.axis === "vertical";
        element("line", {
          x1: vertical ? g.position * sx : 0,
          y1: vertical ? 0 : g.position * sy,
          x2: vertical ? g.position * sx : svg.viewBox.baseVal.width,
          y2: vertical ? svg.viewBox.baseVal.height : g.position * sy,
          stroke: g.color,
          "stroke-width": 1,
          "stroke-dasharray": "5 4",
          "data-walking-guide": g.name
        });
        var text = element("text", {
          x: vertical ? g.position * sx + 4 : 4,
          y: vertical ? 13 : g.position * sy - 4,
          fill: g.color,
          "font-size": 11,
          "font-family": "Arial, sans-serif",
          "paint-order": "stroke fill",
          stroke: "#222",
          "stroke-width": 2
        });
        text.textContent = g.name;
      });
  };
})();

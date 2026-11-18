(function () {
  var p = pskl.controller.dialogs.PuppetStudioControls.prototype;
  p.arrangePuppetStudio = function () {
    var top = this.puppetTop,
      form = this.form(),
      buttons = Array.from(top.querySelectorAll("button")),
      start = buttons.find(function (b) {
        return b.textContent === "Starting frame…";
      }),
      custom = buttons.find(function (b) {
        return b.textContent === "Custom rig";
      }),
      all = buttons.find(function (b) {
        return b.textContent === "All tools";
      });
    top.querySelector("strong").remove();
    if (all) {
      all.remove();
    }
    var menu = function (label) {
      var d = document.createElement("details"),
        s = document.createElement("summary");
      d.className = "puppet-menu";
      s.textContent = label;
      d.append(s);
      var items = document.createElement("div");
      items.className = "puppet-menu-items";
      d.append(items);
      top.prepend(d);
      return items;
    };
    var rig = menu("Rig"),
      poses = menu("Poses"),
      clips = menu("Clips");
    var tutorials = this.puppetButton(
      "Tutorials",
      function () {
        var dialog = document.createElement("dialog");
        dialog.className = "puppet-tutorial-dialog";
        dialog.setAttribute("aria-label", "Puppet Studio tutorials");
        var heading = document.createElement("h3");
        heading.textContent = "Puppet Studio tutorials";
        var topics = [
          {
            title: "Rigging and adjusting joints",
            description:
              "Start with separate artwork layers, choose a starting frame, place independent joints, fit pivots and bone lengths, assign layers, connect an arm through a shoulder hub, test bends and locks, and save your editable rig.",
            file: "how-to-rig-bea.mp4",
            chapters: [
              { at: 0, title: "Start with separate layers" },
              { at: 9.786, title: "Choose the starting frame" },
              { at: 17.006, title: "Make a custom rig" },
              { at: 26.466, title: "Place the body pivot" },
              { at: 33.884, title: "Fit the body bone" },
              { at: 45.922, title: "Name and assign the body" },
              { at: 60.443, title: "Place a shoulder joint" },
              { at: 69.333, title: "Assign the upper arm" },
              { at: 79.467, title: "Add the elbow and wrist" },
              { at: 92.422, title: "Assign the forearm" },
              { at: 103.229, title: "Connect the arm to the body" },
              { at: 114.036, title: "Test the connection" },
              { at: 124.994, title: "Test the elbow bend" },
              { at: 137.938, title: "Pins, knees and flexible parts" },
              { at: 153.689, title: "Save and continue" }
            ],
            duration: "2:50"
          },
          {
            title: "Joints & Layers",
            description:
              "Compare bound and unbound artwork, assign source layers to bones, fit pivots and endpoints, change parents without moving the artwork or reordering layers, adjust pose transforms and locks, and save/reopen your Piskel project. Includes step-by-step demonstrations.",
            file: "joints-layers-tutorial-bea.mp4",
            duration: "4:13",
            chapters: [
              { at: 0, title: "Setup versus posing" },
              { at: 16.544, title: "Select and name a joint" },
              { at: 34.434, title: "What happens with no layer assigned" },
              { at: 53.254, title: "Assign the correct artwork layer" },
              { at: 71.472, title: "Fit the pivot and endpoint" },
              { at: 97.28, title: "Change the parent without a jump" },
              { at: 121.115, title: "Use the source layer list" },
              { at: 143.543, title: "Rotation and position in a pose" },
              { at: 164.246, title: "Scale and shear the artwork" },
              { at: 186.709, title: "Visibility and pose locks" },
              { at: 208.094, title: "Save the editable project" },
              { at: 229.673, title: "Reopen and check your assignments" }
            ]
          },
          {
            title: "Joint motion paths and settings",
            description:
              "Guide a hand or foot between two pose keys. Draw and edit a path, scrub the in-between frames, recognize limited reach, adjust easing and Hold, edit saved paths, and save or generate the animation.",
            file: "joint-motion-path-tutorial-bea.mp4",
            chapters: [
              { at: 0, title: "What a motion path does" },
              { at: 16.022, title: "Prepare two neighboring poses" },
              { at: 32.704, title: "Select the joint" },
              { at: 44.766, title: "From and To settings" },
              { at: 62.794, title: "Joint target setting" },
              { at: 82.007, title: "Draw the route" },
              { at: 96.939, title: "Edit the control points" },
              { at: 113.4, title: "Preview individual frames" },
              { at: 130.106, title: "Orange means limited reach" },
              { at: 150.166, title: "Apply versus Cancel" },
              { at: 167.3, title: "Playback speed" },
              { at: 183.843, title: "Easing and Hold" },
              { at: 210.451, title: "Edit and remove a saved path" },
              { at: 230.847, title: "Locks and good workflow" },
              { at: 251.873, title: "Save the result" }
            ],
            duration: "4:35"
          },
          {
            title: "Connect both legs to a pelvis",
            description:
              "Place a pelvis connector on the body and attach both legs. Moving the body carries the limbs while each leg can still bend independently.",
            file: "pelvis-connector.mp4",
            chapters: [
              { at: 0, title: "Choose the body" },
              { at: 6.2, title: "Place the pelvis connector" },
              { at: 13.3, title: "Attach both legs" },
              { at: 22.2, title: "Test body movement" },
              { at: 30.6, title: "Save the rig" }
            ],
            duration: "0:33"
          },
          {
            title: "Build a walk cycle",
            description:
              "Build a 24-frame in-place practice cycle: set floor and head guides, record contact and passing poses, close the loop, preview timing and generate frames. Demonstrated on a smaller Tester working copy.",
            file: "walk-cycle-tutorial.mp4",
            voice: "Kleo",
            duration: "2:32",
            chapters: [
              { at: 0.001, title: "Start with a fitted rig" },
              { at: 15.712, title: "Set your floor and head guides" },
              { at: 32.858, title: "Make the first contact pose" },
              { at: 49.28, title: "Add a passing pose" },
              { at: 66.814, title: "Make the opposite contact" },
              { at: 82.547, title: "Add the second passing pose" },
              { at: 99.314, title: "Close the loop" },
              { at: 115.745, title: "Preview and refine the timing" },
              { at: 134.983, title: "Generate and keep an editable copy" }
            ]
          },
          {
            title: "Fix knees and elbows",
            description:
              "Compare unlocked IK and bend directions, pin a knee while rotating its foot, keep locks different in each pose, and use the same technique on an elbow. Includes explained demonstrations.",
            file: "knees-elbows-tutorial.mp4",
            voice: "Kleo",
            duration: "2:12",
            chapters: [
              { at: 0, title: "Choose the lower bone" },
              { at: 15.986, title: "See how an unlocked foot behaves" },
              { at: 31.865, title: "Choose the bend direction" },
              { at: 48.392, title: "Lift the knee, then pin it" },
              { at: 63.859, title: "Rotate the foot around the locked knee" },
              { at: 81.44, title: "Keep locks different in each pose" },
              { at: 99.828, title: "Use the same idea on an elbow" },
              { at: 115.091, title: "Check the rig before fighting it" }
            ]
          },
          {
            title: "Custom joints and segments",
            description:
              "Create independent joints, connect or detach branches, attach inside a solid segment, compare Hinge and Flexible splits, and remove or undo an inserted joint. Includes explained demonstrations.",
            file: "custom-joints-tutorial.mp4",
            voice: "Kleo",
            duration: "2:31",
            chapters: [
              { at: 0, title: "Pick the right joint tool" },
              { at: 19.851, title: "Place an independent joint" },
              { at: 37.255, title: "Connect or detach the new branch" },
              { at: 56.831, title: "Attach inside a solid segment" },
              { at: 76.01, title: "Split a segment with a hinge" },
              { at: 95.059, title: "Compare flexible bending" },
              { at: 114.319, title: "Remove a split and undo it" },
              { at: 131.49, title: "Save the custom setup" }
            ]
          }
        ];
        var topicLabel = document.createElement("label"),
          topic = document.createElement("select"),
          title = document.createElement("h4"),
          description = document.createElement("p"),
          details = document.createElement("p");
        topicLabel.textContent = "Tutorial ";
        topic.setAttribute("aria-label", "Tutorial topic");
        topics.forEach(function (item, index) {
          topic.add(new Option(item.title, index));
        });
        topicLabel.append(topic);
        description.className = "puppet-tutorial-description";
        details.className = "puppet-tutorial-details";
        var close = document.createElement("button");
        close.type = "button";
        close.textContent = "Close tutorial";
        var video = document.createElement("video");
        video.controls = true;
        video.preload = "metadata";
        var body = document.createElement("div"),
          chapters = document.createElement("nav"),
          chapterHeading = document.createElement("h4"),
          chapterList = document.createElement("ol"),
          playbackStatus = document.createElement("p"),
          pendingChapter = null;
        body.className = "puppet-tutorial-body";
        chapters.className = "puppet-tutorial-chapters";
        chapters.setAttribute("aria-label", "Tutorial chapters");
        chapterHeading.textContent = "Jump to a section";
        playbackStatus.setAttribute("role", "status");
        playbackStatus.className = "puppet-tutorial-playback-status";
        chapters.append(chapterHeading, chapterList, playbackStatus);
        body.append(video, chapters);
        var markChapter = function () {
          var items = topics[Number(topic.value)].chapters,
            current = 0;
          items.forEach(function (item, index) {
            if (video.currentTime >= item.at) {
              current = index;
            }
          });
          Array.from(chapterList.querySelectorAll("button")).forEach(
            function (button, index) {
              if (index === current) {
                button.setAttribute("aria-current", "true");
              } else {
                button.removeAttribute("aria-current");
              }
            }
          );
        };
        var jumpToChapter = function (at) {
          if (video.readyState < 1) {
            pendingChapter = at;
            return;
          }
          video.currentTime = Math.min(at, Math.max(0, video.duration - 0.1));
          markChapter();
          video.play().catch(function (error) {
            if (error.name !== "AbortError") {
              playbackStatus.textContent = "Press Play to start this section.";
            }
          });
        };
        video.addEventListener("timeupdate", markChapter);
        video.addEventListener("loadedmetadata", function () {
          if (pendingChapter !== null) {
            var at = pendingChapter;
            pendingChapter = null;
            jumpToChapter(at);
          }
        });
        var showTopic = function () {
          var item = topics[Number(topic.value)];
          video.pause();
          pendingChapter = null;
          playbackStatus.textContent = "";
          chapterList.replaceChildren();
          item.chapters.forEach(function (section) {
            var row = document.createElement("li"),
              button = document.createElement("button"),
              seconds = Math.floor(section.at),
              timestamp =
                Math.floor(seconds / 60) +
                ":" +
                String(seconds % 60).padStart(2, "0");
            button.type = "button";
            button.textContent = timestamp + "  " + section.title;
            button.dataset.chapterAt = section.at;
            button.onclick = function () {
              playbackStatus.textContent = "";
              jumpToChapter(section.at);
            };
            row.append(button);
            chapterList.append(row);
          });
          title.textContent = item.title;
          description.textContent = item.description;
          details.textContent =
            item.duration +
            " · " +
            (item.voice || "Bea") +
            " / ElevenLabs narration · Guided cursor";
          video.setAttribute("aria-label", item.title + " video tutorial");
          video.src = new URL("tutorials/" + item.file, document.baseURI).href;
          video.load();
          markChapter();
        };
        topic.addEventListener("change", showTopic);
        showTopic();
        close.onclick = function () {
          video.pause();
          dialog.close();
          dialog.remove();
        };
        dialog.addEventListener("cancel", function () {
          video.pause();
          dialog.remove();
        });
        dialog.addEventListener("keydown", function (event) {
          event.stopPropagation();
        });
        var header = document.createElement("div");
        header.className = "puppet-tutorial-header";
        header.append(heading, close);
        dialog.append(header, topicLabel, title, description, details, body);
        this.owner.wrapper.append(dialog);
        dialog.showModal();
      },
      top
    );
    top.prepend(
      rig.parentElement,
      poses.parentElement,
      clips.parentElement,
      tutorials
    );
    rig.append(start, custom);
    var proxy = function (label, id, parent) {
      this.puppetButton(
        label,
        function () {
          var original = form.querySelector(
            '[data-community-action="' + id + '"]'
          );
          original.click();
          parent.closest("details").open = false;
        },
        parent
      );
    }.bind(this);
    [
      ["Reset pose", "reset"],
      ["Mirror pose", "mirror"],
      ["Save named pose", "save-pose"],
      ["Load named pose", "load-pose"],
      ["Delete named pose", "delete-pose"]
    ].forEach(function (v) {
      proxy(v[0], v[1], poses);
    });
    [
      ["New clip", "clip"],
      ["Add pose key", "key"],
      ["Delete pose key", "delete-key"],
      ["Delete clip", "delete-clip"]
    ].forEach(function (v) {
      proxy(v[0], v[1], clips);
    });
    [
      ["Export rig file", "export"],
      ["Import chosen rig file", "import"],
      ["Remove generated frames", "remove-output"]
    ].forEach(function (v) {
      proxy(v[0], v[1], rig);
    });
    this.puppetFooter.querySelector(".puppet-more-actions").hidden = true;
    [
      "skin",
      "outline",
      "outlineColor",
      "radius",
      "radiusEnd",
      "bulge",
      "skinColor"
    ].forEach(function (key) {
      form.elements["rig-" + key].closest("label").hidden = true;
    });
    var scroll = this.puppetSide.querySelector(".puppet-options");
    this.puppetSide.insertBefore(this.puppetTree, scroll);
    this.puppetGuideBar = document.createElement("div");
    this.puppetGuideBar.className = "puppet-guide-bar";
    this.puppetButton(
      "◀",
      function () {
        this.stepPuppet(-1);
      },
      this.puppetGuideBar
    ).setAttribute("aria-label", "Previous guide step");
    this.puppetButton(
      "Walking guides…",
      function () {
        this.puppetGuides.open = !this.puppetGuides.open;
        this.puppetGuides.scrollIntoView({ block: "nearest" });
      },
      this.puppetGuideBar
    );
    this.puppetButton(
      "▶",
      function () {
        this.stepPuppet(1);
      },
      this.puppetGuideBar
    ).setAttribute("aria-label", "Next guide step");
    var hint = document.createElement("span");
    hint.textContent =
      "Red: key · Green: breakdown · Purple: in-between · Orange: overshoot";
    this.puppetGuideBar.append(hint);
    form.append(this.puppetGuideBar);
    // Hierarchy has its own scroll area; properties scroll independently below it.
    this.puppetTree.setAttribute("aria-label", "Rig hierarchy");
  };
})();

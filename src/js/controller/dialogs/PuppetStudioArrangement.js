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
        heading.textContent = "Connect both legs to a pelvis";
        var close = document.createElement("button");
        close.type = "button";
        close.textContent = "Close tutorial";
        var video = document.createElement("video");
        video.controls = true;
        video.preload = "metadata";
        video.setAttribute("aria-label", "Narrated pelvis connector tutorial");
        video.src = new URL(
          "tutorials/pelvis-connector.mp4",
          document.baseURI
        ).href;
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
        dialog.append(heading, close, video);
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

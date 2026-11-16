(function () {
  var p = pskl.controller.dialogs.PuppetStudioDialogController.prototype,
    init = p.init,
    clone = pskl.utils.ToolStateUtils.clone;
  p.init = function () {
    init.call(this);
    this.formPast = [];
    this.formFuture = [];
    var heading = this.wrapper.querySelector(".puppet-window-heading");
    ["Undo", "Redo"].forEach(
      function (name) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "button";
        button.textContent = name;
        button.title = name + " studio edit";
        this.addEventListener(button, "click", function () {
          this.undoPuppet(name === "Redo");
        });
        heading.insertBefore(button, heading.querySelector(".dialog-close"));
      }.bind(this)
    );
    this.addEventListener(
      this.communityTools.form(),
      "focusin",
      function (event) {
        var field = event.target.dataset.field;
        if (
          !field ||
          [
            "files",
            "bone",
            "pose",
            "clip",
            "editMode",
            "template",
            "previewAnimation"
          ].includes(field)
        ) {
          return;
        }
        this.finishPuppetField();
        this.fieldBefore = this.puppetFormValues();
      }
    );
    this.addEventListener(this.communityTools.form(), "focusout", function () {
      this.finishPuppetField();
    });
    this.addEventListener(
      this.communityTools.form(),
      "change",
      function (event) {
        if (event.target.dataset.field) {
          this.finishPuppetField();
        }
      }
    );
    this.addEventListener(this.wrapper, "keydown", function (event) {
      if (event.defaultPrevented) {
        return;
      }
      if (
        (event.ctrlKey || event.metaKey) &&
        ["z", "y"].includes(event.key.toLowerCase())
      ) {
        event.preventDefault();
        event.stopPropagation();
        this.undoPuppet(event.key.toLowerCase() === "y" || event.shiftKey);
      }
    });
    this.addEventListener(this.wrapper, "keyup", function (event) {
      if (
        (event.ctrlKey || event.metaKey) &&
        ["z", "y"].includes(event.key.toLowerCase())
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    });
    this.clearFormHistory = function () {
      this.formPast = [];
      this.formFuture = [];
      this.fieldBefore = null;
    }.bind(this);
    $.subscribe(Events.PISKEL_RESET, this.clearFormHistory);
  };
  p.puppetFormValues = function () {
    var values = this.communityTools.read();
    delete values.files;
    return clone(values);
  };
  p.finishPuppetField = function () {
    if (this.fieldBefore) {
      if (
        JSON.stringify(this.fieldBefore) !==
        JSON.stringify(this.puppetFormValues())
      ) {
        this.formPast.push(this.fieldBefore);
        if (this.formPast.length > 64) {
          this.formPast.shift();
        }
        this.formFuture = [];
      }
      this.fieldBefore = null;
    }
  };
  p.undoPuppet = function (redo) {
    var controls = this.communityTools;
    this.stopPreview_();
    if (controls.motionPathDraft) {
      controls.undoJointPath(redo);
      return;
    }
    this.finishPuppetField();
    var from = redo ? this.formFuture : this.formPast,
      to = redo ? this.formPast : this.formFuture;
    if (from.length) {
      to.push(this.puppetFormValues());
      controls.write("rig", from.pop());
      controls.refreshPuppet();
      this.refreshWorkspacePreview_();
    } else {
      pskl.app.historyService[redo ? "redo" : "undo"]();
    }
  };
  var destroy = p.destroy;
  p.destroy = function () {
    $.unsubscribe(Events.PISKEL_RESET, this.clearFormHistory);
    destroy.call(this);
  };
})();

(function () {
  var ns = $.namespace("pskl.controller.dialogs");
  ns.PuppetStudioDialogController = function () {};
  pskl.utils.inherit(
    ns.PuppetStudioDialogController,
    ns.AbstractDialogController
  );
  var p = ns.PuppetStudioDialogController.prototype;
  p.init = function () {
    this.wrapper = document.querySelector(".puppet-dialog");
    this.superclass.init.call(this);
    this.communityTools = new ns.PuppetStudioControls(this);
    this.communityTools.buildForm();
    this.communityTools.refreshRig(true);
    this.communityTools.initRigUI();
    this.communityTools.arrangePuppetStudio();
    this.addEventListener(
      this.communityTools.form(),
      "input",
      this.queueWorkspacePreview_
    );
    this.addEventListener(this.communityTools.form(), "change", function () {
      this.communityTools.refreshPuppet();
      this.queueWorkspacePreview_();
    });
    this.addEventListener(
      this.wrapper.querySelector('[aria-label="Preview zoom"]'),
      "change",
      this.resizeWorkspacePreview_
    );
    this.addEventListener(
      this.wrapper.querySelector('[data-action="play-preview"]'),
      "click",
      this.togglePuppetPlayback_
    );
    this.addEventListener(
      this.wrapper.querySelector('[aria-label="Preview animation frame"]'),
      "input",
      this.drawWorkspacePreview_
    );
    this.observer = new ResizeObserver(this.resizeWorkspacePreview_.bind(this));
    this.observer.observe(this.wrapper.querySelector(".extra-preview-stage"));
    this.onPuppetProjectReset = function () {
      if (this.wrapper.isConnected) {
        this.communityTools.refreshRig(true);
        this.refreshWorkspacePreview_();
      }
    }.bind(this);
    $.subscribe(Events.PISKEL_RESET, this.onPuppetProjectReset);
    this.communityTools.setPuppetActive(true);
    this.refreshWorkspacePreview_();
  };
  p.stopPreview_ = function () {
    clearInterval(this.previewInterval);
    this.previewInterval = null;
  };
  p.queueWorkspacePreview_ = function () {
    clearTimeout(this.previewTimer);
    this.previewTimer = setTimeout(
      this.refreshWorkspacePreview_.bind(this),
      50
    );
  };
  p.refreshWorkspacePreview_ = function () {
    if (!this.wrapper.isConnected) {
      return;
    }
    this.stopPreview_();
    try {
      var c = pskl.app.piskelController,
        p = c.getPiskel(),
        o = this.communityTools.read();
      this.previewSession = this.communityTools.rigPlan(p, o, {
        id: "rig",
        options: o,
        current: c.getCurrentFrameIndex()
      });
      var slider = this.wrapper.querySelector(
        '[aria-label="Preview animation frame"]'
      );
      slider.max = this.previewSession.count - 1;
      slider.value = Math.min(
        Number(slider.value),
        this.previewSession.count - 1
      );
      this.wrapper.querySelector(".extra-tools-viewer").dataset.previewState =
        "ready";
      this.drawWorkspacePreview_();
    } catch (e) {
      this.communityTools.form().querySelector('[role="status"]').textContent =
        e.message;
      this.wrapper.querySelector(".extra-tools-viewer").dataset.previewState =
        "error";
    }
  };
  p.drawWorkspacePreview_ = function () {
    if (!this.previewSession) {
      return;
    }
    var slider = this.wrapper.querySelector(
        '[aria-label="Preview animation frame"]'
      ),
      frame = this.previewSession.render(Number(slider.value)),
      canvas = this.wrapper.querySelector('[data-art-preview="after"]'),
      mini = this.communityTools.puppetMini;
    [canvas, mini].forEach(function (c) {
      c.width = frame.width;
      c.height = frame.height;
      c.getContext("2d").drawImage(frame, 0, 0);
    });
    this.resizeWorkspacePreview_();
  };
  p.resizeWorkspacePreview_ = function () {
    if (!this.wrapper || !this.wrapper.isConnected) {
      return;
    }
    var stage = this.wrapper.querySelector(".extra-preview-stage"),
      canvas = this.wrapper.querySelector('[data-art-preview="after"]'),
      zoom = this.wrapper.querySelector('[aria-label="Preview zoom"]').value,
      scale =
        zoom === "fit"
          ? Math.min(
              (stage.clientWidth - 24) / canvas.width,
              (stage.clientHeight - 24) / canvas.height
            )
          : Number(zoom);
    if (scale >= 1 && zoom === "fit") {
      scale = Math.max(1, Math.floor(scale));
    }
    canvas.style.width = Math.max(1, canvas.width * scale) + "px";
    canvas.style.height = Math.max(1, canvas.height * scale) + "px";
    this.communityTools.drawRigOverlay();
    if (this.communityTools.drawMotionPathOverlay) {
      this.communityTools.drawMotionPathOverlay();
    }
  };
  p.togglePuppetPlayback_ = function () {
    if (this.previewInterval) {
      this.stopPreview_();
      return;
    }
    if (!this.previewSession || this.previewSession.count < 2) {
      return;
    }
    this.previewInterval = setInterval(
      function () {
        var slider = this.wrapper.querySelector(
          '[aria-label="Preview animation frame"]'
        );
        slider.value = (Number(slider.value) + 1) % this.previewSession.count;
        this.drawWorkspacePreview_();
      }.bind(this),
      1000 / Number(this.communityTools.puppetFPS.value)
    );
  };
  p.destroy = function () {
    $.unsubscribe(Events.PISKEL_RESET, this.onPuppetProjectReset);
    clearTimeout(this.previewTimer);
    this.stopPreview_();
    if (this.observer) {
      this.observer.disconnect();
    }
    this.superclass.destroy.call(this);
  };
})();

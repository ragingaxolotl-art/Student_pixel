(function () {
  var u = pskl.utils;
  u.PuppetAnimationUtils = {
    ease: function (t, curve) {
      if (curve === "in") {
        return t * t;
      }
      if (curve === "out") {
        return t * (2 - t);
      }
      if (curve === "in-out") {
        return t * t * (3 - 2 * t);
      }
      if (curve !== "linear") {
        throw new Error("Choose a supported easing curve.");
      }
      return t;
    }
  };
  u.ToolStateUtils = {
    clone: function (value) {
      return JSON.parse(JSON.stringify(value || {}));
    }
  };
  u.PuppetProjectUtils = {
    cloneProject: function (project) {
      var layers = project.getLayers().map(function (layer) {
          var out = pskl.model.Layer.fromFrames(
            layer.getName(),
            layer.getFrames().map(function (f) {
              return f.clone();
            })
          );
          out.setOpacity(layer.getOpacity());
          out.rowState = u.ToolStateUtils.clone(layer.rowState);
          return out;
        }),
        out = pskl.model.Piskel.fromLayers(
          layers,
          project.getFPS(),
          u.ToolStateUtils.clone(project.getDescriptor())
        );
      out.toolState = u.ToolStateUtils.clone(project.toolState);
      out.hiddenFrames = project.hiddenFrames.slice();
      out.savePath = project.savePath;
      return out;
    }
  };
  u.PuppetColorUtils = {
    over: function (base, color) {
      var a = (color >>> 24) / 255,
        b = (base >>> 24) / 255,
        alpha = a + b * (1 - a);
      if (!alpha) {
        return 0;
      }
      if (a === 1 || !b) {
        return color >>> 0;
      }
      var out = Math.round(alpha * 255) << 24;
      [0, 8, 16].forEach(function (shift) {
        out |=
          Math.round(
            (((color >>> shift) & 255) * a +
              ((base >>> shift) & 255) * b * (1 - a)) /
              alpha
          ) << shift;
      });
      return out >>> 0;
    }
  };
  u.PuppetExportUtils = {
    json: function (value, name) {
      u.FileUtils.downloadAsFile(
        new Blob([JSON.stringify(value, null, 2)], {
          type: "application/json"
        }),
        name + ".json"
      );
    }
  };
  u.PuppetTimelineUtils = {
    edit: function (p) {
      return (
        p.toolState.timeline ||
        (p.toolState.timeline = {
          bookmarks: [],
          clips: [],
          holds: {},
          activeClip: null
        })
      );
    }
  };
  var ns = $.namespace("pskl.service");
  ns.PuppetStudioService = function (controller) {
    this.controller = controller;
  };
  ns.PuppetStudioService.prototype.save = function () {
    $.publish(Events.PISKEL_RESET);
    $.publish(Events.PISKEL_SAVE_STATE, {
      type: pskl.service.HistoryService.SNAPSHOT
    });
  };
  ns.PuppetStudioService.prototype.checkOutput = function (
    width,
    height,
    frames,
    layers
  ) {
    if (
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width < 1 ||
      height < 1 ||
      width > 4096 ||
      height > 4096 ||
      width * height * frames * layers > 16777216
    ) {
      throw new Error("Output exceeds 16 million layer/frame pixels.");
    }
  };
  ns.PuppetStudioService.prototype.replaceProject = function (project, frame) {
    this.controller.setPiskel(project, {
      preserveState: true,
      noSnapshot: true
    });
    var c = this.controller.getWrappedPiskelController();
    c.setCurrentLayerIndex(
      Math.min(c.getCurrentLayerIndex(), project.getLayers().length - 1)
    );
    c.setCurrentFrameIndex(
      Math.min(
        frame === undefined ? c.getCurrentFrameIndex() : frame,
        project.getFrameCount() - 1
      )
    );
    this.save();
  };
})();

(function () {
  var ns = pskl.service,
    u = pskl.utils;
  ns.ParticleStudioService = function (controller) {
    ns.PuppetStudioService.call(this, controller);
  };
  u.inherit(ns.ParticleStudioService, ns.PuppetStudioService);
  var p = ns.ParticleStudioService.prototype;
  p.removeOutput = function () {
    var out = u.PuppetProjectUtils.cloneProject(this.controller.getPiskel());
    out
      .getLayers()
      .slice()
      .forEach(function (layer) {
        if (
          layer.toolState.kind === "community-particles" &&
          layer.toolState.communityOwned
        ) {
          out.removeLayer(layer);
        }
      });
    if (!out.getLayers().length) {
      throw new Error("Keep at least one artwork layer.");
    }
    this.replaceProject(out);
  };
  p.commit = function (config, generate, current, palette) {
    u.ParticleStudioUtils.validate(config);
    var source = this.controller.getPiskel(),
      out = u.PuppetProjectUtils.cloneProject(source);
    config = u.ToolStateUtils.clone(config);
    out.getLayers().forEach(function (layer) {
      layer.toolState.id = layer.toolState.id || u.Uuid.generate();
    });
    config.emitters.forEach(function (e) {
      var at = e.sourceId
        ? source.getLayers().findIndex(function (l) {
            return l.toolState.id === e.sourceId;
          })
        : e.sourceLayer;
      if (at >= 0 && out.getLayerAt(at)) {
        e.sourceLayer = at;
        e.sourceId = out.getLayerAt(at).toolState.id;
      }
    });
    out.toolState.particleStudio = config;
    if (generate) {
      if (
        !config.emitters.some(function (e) {
          return e.enabled;
        })
      ) {
        throw new Error("Enable an emitter before generating frames.");
      }
      var owned = out.getLayers().find(function (l) {
          return l.toolState.kind === "community-particles";
        }),
        count = Math.max(out.getFrameCount(), config.frames);
      this.checkOutput(
        out.getWidth(),
        out.getHeight(),
        count,
        out.getLayers().length + (owned ? 0 : 1)
      );
      var engine = new u.ParticleStudioEngine(
          out,
          config,
          Math.min(current, source.getFrameCount() - 1),
          palette
        ),
        frames = Array.from({ length: config.frames }, function (_, i) {
          return engine.render(i);
        });
      out.getLayers().forEach(function (layer) {
        while (layer.getFrames().length < count) {
          layer.addFrame(
            layer.getFrameAt(layer.getFrames().length - 1).clone()
          );
        }
      });
      while (frames.length < count) {
        frames.push(new pskl.model.Frame(out.getWidth(), out.getHeight()));
      }
      if (!owned) {
        owned = pskl.model.Layer.fromFrames("Particle FX", frames);
        out.addLayer(owned);
      } else {
        owned
          .getFrames()
          .splice.apply(
            owned.getFrames(),
            [0, owned.getFrames().length].concat(frames)
          );
      }
      Object.assign(owned.toolState, {
        id: owned.toolState.id || u.Uuid.generate(),
        kind: "community-particles",
        communityOwned: true,
        locked: true
      });
    }
    this.replaceProject(out);
    return out;
  };
})();

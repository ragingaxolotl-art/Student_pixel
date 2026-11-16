(function () {
  var u = pskl.utils,
    fx = u.LayerEffects,
    g = u.LayerGroupUtils;
  function fromCanvas(canvas) {
    return u.FrameUtils.createFromCanvas(
      canvas,
      0,
      0,
      canvas.width,
      canvas.height,
      true
    );
  }
  function maskEffect(e) {
    return e.operation === "mask" || e.operation === "maskInverse";
  }
  u.LayerMaskUtils = {
    // Feather coverage rather than the painted colors. Zero takes the exact
    // original pixel path; transparent neighbors inherit premultiplied color.
    feather: function (frame, radius) {
      radius = Math.max(0, Math.min(32, Number(radius) || 0));
      if (!radius) {
        return frame;
      }
      var key = frame.getHash() + ":" + radius;
      if (frame._featherCache && frame._featherCache.key === key) {
        return frame._featherCache.frame;
      }
      var canvas = u.CanvasUtils.createCanvas(
          frame.getWidth(),
          frame.getHeight()
        ),
        ctx = canvas.getContext("2d");
      ctx.filter = "blur(" + radius + "px)";
      ctx.drawImage(u.FrameUtils.toImage(frame), 0, 0);
      var output = fromCanvas(canvas);
      for (var i = 0; i < output.pixels.length; i++) {
        if (frame.pixels[i] >>> 24) {
          output.pixels[i] =
            ((output.pixels[i] & 0xff000000) | (frame.pixels[i] & 0xffffff)) >>>
            0;
        }
      }
      frame._featherCache = { key: key, frame: output };
      return output;
    },
    effectPixel: function (target, ink, mode, strength, opacity) {
      var coverage = ((ink >>> 24) / 255) * opacity * strength;
      if (!(target >>> 24) || !coverage) {
        return target;
      }
      var b = [target & 255, (target >>> 8) & 255, (target >>> 16) & 255].map(
          function (v) {
            return v / 255;
          }
        ),
        s = [ink & 255, (ink >>> 8) & 255, (ink >>> 16) & 255].map(
          function (v) {
            return v / 255;
          }
        ),
        blend = u.LayerBlendUtils.color(b, s, mode),
        c = b.map(function (v, i) {
          return Math.round(
            Math.max(0, Math.min(1, v + coverage * (blend[i] - v))) * 255
          );
        });
      return ((target & 0xff000000) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0;
    }
  };
  fx.referenceLayer = function (layer, options, layers) {
    if (options.maskId) {
      return layers.find(function (candidate) {
        return candidate.rowState.groupNodeId === options.maskId;
      });
    }
    if (g.isGroup(layer)) {
      var siblings = layers.filter(function (candidate) {
        return g.parent(layers, candidate) === g.parent(layers, layer);
      });
      return siblings[
        siblings.indexOf(layer) + (options.direction === "above" ? 1 : -1)
      ];
    }
    return layers[
      layers.indexOf(layer) + (options.direction === "above" ? 1 : -1)
    ];
  };
  fx.maskFrame = function (reference, index, options) {
    var frame = u.LayerMaskUtils.feather(
      reference.getFrameAt(index),
      options.feather
    );
    if (reference.getOpacity() === 1) {
      return frame;
    }
    var out = frame.clone();
    for (var i = 0; i < out.pixels.length; i++) {
      out.pixels[i] =
        ((Math.round((frame.pixels[i] >>> 24) * reference.getOpacity()) << 24) |
          (frame.pixels[i] & 0xffffff)) >>>
        0;
    }
    return out;
  };
  fx.targetBelow = function (layer, layers) {
    var siblings = layers.filter(function (candidate) {
      return g.parent(layers, candidate) === g.parent(layers, layer);
    });
    for (var i = siblings.indexOf(layer) - 1; i >= 0; i--) {
      if (!siblings[i].rowState.effectOnly) {
        return siblings[i];
      }
    }
    return null;
  };
  fx.needsAdvanced = function (layers) {
    return layers.some(function (layer) {
      return (
        !!layer.rowState.effectOnly ||
        (g.isGroup(layer) && fx.list(layer).length > 0) ||
        fx.list(layer).some(function (e) {
          return (
            Number(e.params.feather) > 0 ||
            (maskEffect(e) && e.params.hideMask === true)
          );
        })
      );
    });
  };
  var originalHas = fx.has;
  fx.has = function (layers) {
    return this.needsAdvanced(layers) || originalHas.call(this, layers);
  };
  fx.renderAdvanced = function (layers, index, preserve, context, sample) {
    context = context || layers;
    sample = sample || layers[0].getFrameAt(index);
    var selected = new Set(layers),
      consumed = new Set(),
      sources = new Map(),
      children = new Map(),
      width = sample.getWidth(),
      height = sample.getHeight();
    context.forEach(function (layer) {
      var parent = g.parent(context, layer);
      if (!children.has(parent)) {
        children.set(parent, []);
      }
      children.get(parent).push(layer);
      fx.list(layer).forEach(function (e) {
        if (maskEffect(e) && e.params.hideMask === true) {
          var reference = fx.referenceLayer(layer, e.params, context);
          if (reference) {
            consumed.add(reference);
          }
        }
      });
    });
    children.forEach(function (siblings) {
      var target = null;
      siblings.forEach(function (layer) {
        if (!layer.rowState.effectOnly) {
          target = layer;
          return;
        }
        var blend = fx.blend(layer, index);
        if (
          target &&
          blend &&
          Number(blend.params.amount) > 0 &&
          (!preserve || layer.getOpacity() > 0) &&
          g.opacity(context, layer, false) > 0
        ) {
          if (!sources.has(target)) {
            sources.set(target, []);
          }
          sources.get(target).push({ layer: layer, blend: blend });
        }
      });
    });
    function included(layer) {
      return (
        selected.has(layer) ||
        g.ancestors(context, layer).some(function (p) {
          return selected.has(p);
        }) ||
        (g.isGroup(layer) &&
          g.descendants(context, layer).some(function (c) {
            return selected.has(c);
          }))
      );
    }
    function adjusted(layer, frame) {
      (sources.get(layer) || []).forEach(function (entry) {
        var source;
        if (g.isGroup(entry.layer)) {
          var inkCanvas = u.CanvasUtils.createCanvas(width, height);
          renderInto(inkCanvas, children.get(entry.layer) || [], 1);
          source = fromCanvas(inkCanvas);
        }
        var ink = u.LayerMaskUtils.feather(
            fx.frame(entry.layer, index, context, source),
            entry.blend.params.feather
          ),
          amount = Number(entry.blend.params.amount) / 100,
          opacity = preserve ? entry.layer.getOpacity() : 1,
          out = frame.clone();
        for (var i = 0; i < out.pixels.length; i++) {
          out.pixels[i] = u.LayerMaskUtils.effectPixel(
            frame.pixels[i],
            ink.pixels[i],
            entry.blend.operation,
            amount,
            opacity
          );
        }
        frame = out;
      });
      return frame;
    }
    function renderInto(canvas, siblings, ancestorOpacity) {
      var ctx = canvas.getContext("2d");
      siblings.forEach(function (layer) {
        if (
          !included(layer) ||
          layer.rowState.hidden ||
          layer.rowState.effectOnly ||
          consumed.has(layer)
        ) {
          return;
        }
        var opacity = ancestorOpacity * (preserve ? layer.getOpacity() : 1),
          blend = fx.blend(layer, index),
          frame;
        if (!opacity) {
          return;
        }
        if (g.isGroup(layer)) {
          if (!fx.enabled(layer, index).length && !sources.has(layer)) {
            renderInto(canvas, children.get(layer) || [], opacity);
            return;
          }
          var groupCanvas = u.CanvasUtils.createCanvas(width, height);
          renderInto(groupCanvas, children.get(layer) || [], opacity);
          frame = fx.frame(layer, index, context, fromCanvas(groupCanvas));
          opacity = 1;
        } else {
          frame = fx.frame(layer, index, context);
        }
        if (blend) {
          frame = u.LayerMaskUtils.feather(frame, blend.params.feather);
        }
        frame = adjusted(layer, frame);
        if (blend) {
          u.LayerBlendUtils.draw(
            canvas,
            frame,
            opacity,
            blend.operation,
            Number(blend.params.amount) / 100
          );
        } else {
          ctx.globalAlpha = opacity;
          ctx.globalCompositeOperation = "source-over";
          ctx.drawImage(u.FrameUtils.toImage(frame), 0, 0);
          ctx.globalAlpha = 1;
        }
      });
    }
    var canvas = u.CanvasUtils.createCanvas(width, height);
    renderInto(canvas, children.get(null) || [], 1);
    return canvas;
  };
})();

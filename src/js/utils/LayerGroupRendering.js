(function () {
  var g = pskl.utils.LayerGroupUtils,
    u = pskl.utils.LayerUtils,
    render = u.renderFrameAt,
    flatten = u.flattenFrameAt,
    merge = u.mergeFrameAt,
    hash = u.getFrameHashAt;
  var cloneLayer = u.clone;
  u.clone = function (layer) {
    var result = cloneLayer.apply(this, arguments);
    if (g.state(result)) {
      g.state(result).groupNodeId = pskl.utils.Uuid.generate();
      if (g.state(result).id) {
        g.state(result).id = pskl.utils.Uuid.generate();
      }
    }
    return result;
  };
  g.context = function (layers) {
    var c = pskl.app && pskl.app.piskelController,
      all = c ? c.getLayers() : [];
    return layers.some(function (l) {
      return all.indexOf(l) !== -1;
    })
      ? all
      : layers;
  };
  g.opacity = function (layers, layer, preserve) {
    var chain = [layer].concat(g.ancestors(layers, layer));
    if (
      chain.some(function (l) {
        return g.state(l).hidden;
      })
    ) {
      return 0;
    }
    return preserve
      ? chain.reduce(function (value, l) {
          return value * l.getOpacity();
        }, 1)
      : 1;
  };
  u.getFrameHashAt = function (layers, index) {
    var context = g.context(layers);
    return (
      hash.apply(this, arguments) +
      JSON.stringify(
        context.map(function (l) {
          return [
            g.state(l).parentGroup,
            g.state(l).hidden,
            l.getOpacity(),
            pskl.utils.LayerEffects.needsAdvanced(context)
              ? [
                  l.getFrameAt(index).getHash(),
                  l.rowState.effects,
                  l.rowState.effectOnly
                ]
              : null
          ];
        })
      )
    );
  };
  u.renderFrameAt = function (layer, index, preserve, context) {
    context = g.context(context || [layer]);
    var opacity = g.opacity(context, layer, preserve);
    if (!g.ancestors(context, layer).length) {
      return render.apply(this, arguments);
    }
    var frame = pskl.utils.LayerEffects
      ? pskl.utils.LayerEffects.frame(layer, index, context)
      : layer.getFrameAt(index);
    return pskl.utils.FrameUtils.toImage(frame, 1, opacity);
  };
  u.mergeFrameAt = function (layers, index) {
    var context = g.context(layers);
    if (
      layers.length &&
      context.some(function (l) {
        return !!g.state(l).parentGroup;
      })
    ) {
      return u.mergeTransparentFrameAt_(layers, index);
    }
    return merge.apply(this, arguments);
  };
  u.flattenFrameAt = function (layers, index, preserve, context, sample) {
    context = g.context(context || layers);
    if (pskl.utils.LayerEffects.needsAdvanced(context)) {
      return flatten.call(this, layers, index, preserve, context, sample);
    }
    if (
      !context.some(function (l) {
        return !!g.state(l).parentGroup;
      })
    ) {
      return flatten.apply(this, arguments);
    }
    sample = sample || layers[0].getFrameAt(index);
    var canvas = pskl.utils.CanvasUtils.createCanvas(
        sample.getWidth(),
        sample.getHeight()
      ),
      ctx = canvas.getContext("2d");
    layers.forEach(function (layer) {
      var opacity = g.opacity(context, layer, preserve);
      if (!opacity || g.isGroup(layer)) {
        return;
      }
      var frame = pskl.utils.LayerEffects
          ? pskl.utils.LayerEffects.frame(layer, index, context)
          : layer.getFrameAt(index),
        blend =
          pskl.utils.LayerEffects &&
          pskl.utils.LayerEffects.blend(layer, index);
      if (blend) {
        pskl.utils.LayerBlendUtils.draw(
          canvas,
          frame,
          opacity,
          blend.operation,
          Number(blend.params.amount) / 100
        );
      } else {
        ctx.globalAlpha = opacity;
        ctx.drawImage(pskl.utils.FrameUtils.toImage(frame), 0, 0);
      }
    });
    return canvas;
  };
})();

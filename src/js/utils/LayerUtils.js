(function () {
  var ns = $.namespace("pskl.utils");

  ns.LayerUtils = {
    clone: function (layer) {
      var clonedFrames = layer.getFrames().map(function (frame) {
        return frame.clone();
      });
      var clone = pskl.model.Layer.fromFrames(
        layer.getName() + " (clone)",
        clonedFrames
      );
      clone.setOpacity(layer.getOpacity());
      clone.rowState = JSON.parse(JSON.stringify(layer.rowState));
      return clone;
    },

    mergeLayers: function (layerA, layerB) {
      var framesA = layerA.getFrames();
      var framesB = layerB.getFrames();
      var mergedFrames = [];
      framesA.forEach(function (frame, index) {
        var otherFrame = framesB[index];
        mergedFrames.push(pskl.utils.FrameUtils.merge([otherFrame, frame]));
      });
      var mergedLayer = pskl.model.Layer.fromFrames(
        layerA.getName(),
        mergedFrames
      );
      return mergedLayer;
    },

    getFrameHashAt: function (layers, index) {
      var hashBuffer = [];
      layers.forEach(function (l) {
        var frame = l.getFrameAt(index);
        hashBuffer.push(frame.getHash());
        hashBuffer.push(
          l.getOpacity(),
          !!l.rowState.hidden,
          !!l.rowState.effectOnly,
          JSON.stringify(l.rowState.effects || [])
        );
        return frame;
      });
      return hashBuffer.join("-");
    },

    /**
     * Create a frame instance merging all the frames from the layers array at
     * the provided index.
     *
     * @param  {Array<Layer>} layers array of layers to use
     * @param  {Number} index frame index to merge
     * @return {Frame} Frame instance (can be a fake frame when using
     *         transparency)
     */
    mergeFrameAt: function (layers, index) {
      var isTransparent = layers.some(function (l) {
        return (
          l.isTransparent() ||
          pskl.utils.LayerEffects.needsAdvanced(layers) ||
          pskl.utils.LayerEffects.list(l).length > 0 ||
          l.getFrameAt(index).pixels.some(function (pixel) {
            var alpha = pixel >>> 24;
            return alpha > 0 && alpha < 255;
          })
        );
      });
      if (isTransparent) {
        return pskl.utils.LayerUtils.mergeTransparentFrameAt_(layers, index);
      } else {
        return pskl.utils.LayerUtils.mergeOpaqueFrameAt_(layers, index);
      }
    },

    mergeTransparentFrameAt_: function (layers, index) {
      var hash = pskl.utils.LayerUtils.getFrameHashAt(layers, index);
      var width = layers[0].frames[0].getWidth();
      var height = layers[0].frames[0].getHeight();
      var renderFn = function () {
        return pskl.utils.LayerUtils.flattenFrameAt(layers, index, true);
      };
      return new pskl.model.frame.RenderedFrame(renderFn, width, height, hash);
    },

    mergeOpaqueFrameAt_: function (layers, index) {
      var hash = pskl.utils.LayerUtils.getFrameHashAt(layers, index);
      var frames = layers.map(function (l) {
        return l.getFrameAt(index);
      });
      var mergedFrame = pskl.utils.FrameUtils.merge(frames);
      mergedFrame.id = hash;
      mergedFrame.version = 0;
      return mergedFrame;
    },

    renderFrameAt: function (layer, index, preserveOpacity, context) {
      var opacity = layer.rowState.hidden
        ? 0
        : preserveOpacity
          ? layer.getOpacity()
          : 1;
      context =
        context ||
        (pskl.app.piskelController
          ? pskl.app.piskelController.getLayers()
          : [layer]);
      var frame = pskl.utils.LayerEffects.frame(layer, index, context);
      return pskl.utils.FrameUtils.toImage(frame, 1, opacity);
    },

    flattenFrameAt: function (layers, index, preserveOpacity, context, sample) {
      context = context || layers;
      if (pskl.utils.LayerEffects.needsAdvanced(context)) {
        return pskl.utils.LayerEffects.renderAdvanced(
          layers,
          index,
          preserveOpacity,
          context,
          sample
        );
      }
      sample = sample || layers[0].getFrameAt(index);
      var width = sample.getWidth(),
        height = sample.getHeight(),
        canvas = pskl.utils.CanvasUtils.createCanvas(width, height),
        ctx = canvas.getContext("2d");
      layers.forEach(function (layer) {
        if (layer.rowState.hidden) {
          return;
        }
        var frame = pskl.utils.LayerEffects.frame(layer, index, context),
          blend = pskl.utils.LayerEffects.blend(layer, index),
          opacity = preserveOpacity ? layer.getOpacity() : 1;
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
          ctx.globalCompositeOperation = "source-over";
          ctx.drawImage(pskl.utils.FrameUtils.toImage(frame), 0, 0);
          ctx.globalAlpha = 1;
        }
      });
      return canvas;
    }
  };
})();

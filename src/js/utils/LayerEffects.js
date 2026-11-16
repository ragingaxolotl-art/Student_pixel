(function () {
  var ns = $.namespace("pskl.utils");
  ns.LayerEffects = {
    list: function (layer) {
      return Array.isArray(layer.rowState.effects)
        ? layer.rowState.effects
        : [];
    },
    enabled: function (layer, index) {
      return this.list(layer).filter(function (e) {
        return (
          e.enabled !== false &&
          (e.frame === null || e.frame === undefined || e.frame === index)
        );
      });
    },
    has: function (layers) {
      return layers.some(function (l) {
        return ns.LayerEffects.list(l).some(function (e) {
          return e.enabled !== false;
        });
      });
    },
    blend: function (layer, index) {
      return this.enabled(layer, index)
        .filter(function (e) {
          return ns.LayerBlendUtils.isBlend(e.operation);
        })
        .pop();
    },
    frame: function (layer, index, layers) {
      var effects = this.enabled(layer, index).filter(function (e) {
        return !ns.LayerBlendUtils.isBlend(e.operation);
      });
      var source = layer.getFrameAt(index);
      if (!effects.length) {
        return source;
      }
      var position = layers.indexOf(layer),
        key = source.getHash() + JSON.stringify(effects);
      effects.forEach(function (e) {
        var other =
          layers[position + (e.params.direction === "above" ? 1 : -1)];
        if (other) {
          key += other.getFrameAt(index).getHash();
        }
      });
      if (layer._effectCache && layer._effectCache.key === key) {
        return layer._effectCache.frame;
      }
      var output = source;
      effects.forEach(function (e) {
        var o = e.params,
          other = layers[position + (o.direction === "above" ? 1 : -1)],
          ref = other && other.getFrameAt(index);
        if (e.operation === "mask" || e.operation === "maskInverse") {
          if (ref) {
            output = ns.LayerPixelOps.manipulate(
              output,
              ref,
              e.operation === "mask" ? "intersect" : "subtract"
            );
          }
        } else {
          output = ns.LayerPixelOps.effect(
            output,
            ref,
            e.operation,
            o.amount,
            o.color,
            o
          );
        }
      });
      layer._effectCache = { key: key, frame: output };
      return output;
    },
    proposed: function (layer, o, id, index) {
      var list = JSON.parse(JSON.stringify(this.list(layer))),
        entry = {
          id: id || pskl.utils.Uuid.generate(),
          operation: o.operation,
          params: Object.assign({}, o),
          enabled: true,
          frame: ns.LayerBlendUtils.isBlend(o.operation) || o.all ? null : index
        };
      if (o.operation === "none" || o.operation === "lcd") {
        return list;
      }
      if (ns.LayerBlendUtils.isBlend(o.operation)) {
        list.forEach(function (e) {
          if (ns.LayerBlendUtils.isBlend(e.operation) && e.id !== entry.id) {
            e.enabled = false;
          }
        });
      }
      var existing = list.findIndex(function (e) {
        return e.id === entry.id;
      });
      if (existing === -1) {
        list.push(entry);
      } else {
        list[existing] = entry;
      }
      return list;
    },
    view: function (layer, frames, options) {
      var view = pskl.model.Layer.fromFrames(layer.getName(), frames);
      view.opacity =
        options && options.opacity !== undefined
          ? Number(options.opacity) / 100
          : layer.getOpacity();
      view.rowState = Object.assign({}, layer.rowState);
      return view;
    },
    mergeDown: function (layers, index, frameIndex) {
      var lower = layers[index - 1],
        upper = layers[index],
        base = ns.LayerUtils.flattenFrameAt(
          layers.slice(0, index - 1),
          frameIndex,
          true,
          layers,
          upper.getFrameAt(frameIndex)
        ),
        all = ns.LayerUtils.flattenFrameAt(
          layers.slice(0, index + 1),
          frameIndex,
          true,
          layers
        );
      var ctx = base.getContext("2d"),
        w = base.width,
        h = base.height,
        b = new Uint32Array(ctx.getImageData(0, 0, w, h).data.buffer),
        out = new Uint32Array(
          all.getContext("2d").getImageData(0, 0, w, h).data.buffer
        ),
        p = this.frame(lower, frameIndex, layers),
        q = this.frame(upper, frameIndex, layers),
        result = new Uint32Array(w * h);
      for (var i = 0; i < result.length; i++) {
        var a = lower.rowState.hidden
            ? 0
            : ((p.pixels[i] >>> 24) / 255) * lower.getOpacity(),
          s = upper.rowState.hidden
            ? 0
            : ((q.pixels[i] >>> 24) / 255) * upper.getOpacity(),
          alpha = a + s * (1 - a);
        if (!alpha) {
          continue;
        }
        var oa = (out[i] >>> 24) / 255,
          ba = (b[i] >>> 24) / 255,
          channels = [0, 8, 16].map(function (shift) {
            return Math.max(
              0,
              Math.min(
                255,
                Math.round(
                  (((out[i] >>> shift) & 255) * oa -
                    ((b[i] >>> shift) & 255) * ba * (1 - alpha)) /
                    alpha
                )
              )
            );
          });
        result[i] =
          ((Math.round(alpha * 255) << 24) |
            (channels[2] << 16) |
            (channels[1] << 8) |
            channels[0]) >>>
          0;
      }
      return pskl.model.Frame.fromPixelGrid(result, w, h);
    }
  };
})();

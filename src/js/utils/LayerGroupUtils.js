(function () {
  var ns = $.namespace("pskl.utils");
  ns.LayerGroupUtils = {
    state: function (layer) {
      return layer.rowState || layer.toolState;
    },
    id: function (layer) {
      var state = this.state(layer);
      state.groupNodeId = state.groupNodeId || ns.Uuid.generate();
      return state.groupNodeId;
    },
    isGroup: function (layer) {
      return !!this.state(layer).isGroup;
    },
    parent: function (layers, layer) {
      var id = this.state(layer).parentGroup;
      return id
        ? layers.find(function (l) {
            return (
              ns.LayerGroupUtils.state(l).groupNodeId === id &&
              ns.LayerGroupUtils.isGroup(l)
            );
          })
        : null;
    },
    ancestors: function (layers, layer) {
      var result = [],
        seen = new Set([layer]),
        parent = this.parent(layers, layer);
      while (parent && !seen.has(parent)) {
        result.push(parent);
        seen.add(parent);
        parent = this.parent(layers, parent);
      }
      return result;
    },
    descendants: function (layers, group) {
      return layers.filter(function (l) {
        return ns.LayerGroupUtils.ancestors(layers, l).indexOf(group) !== -1;
      });
    },
    assign: function (layers, layer, parent) {
      if (
        parent &&
        (!this.isGroup(parent) ||
          parent === layer ||
          this.ancestors(layers, parent).indexOf(layer) !== -1)
      ) {
        throw new Error(
          "A group cannot be nested inside itself or its children."
        );
      }
      this.state(layer).parentGroup = parent ? this.id(parent) : null;
      this.normalize(layers);
    },
    normalize: function (layers) {
      var seen = new Set();
      layers.forEach(function (l) {
        var id = ns.LayerGroupUtils.id(l);
        if (seen.has(id)) {
          ns.LayerGroupUtils.state(l).groupNodeId = ns.Uuid.generate();
        }
        seen.add(ns.LayerGroupUtils.state(l).groupNodeId);
      });
      layers.forEach(function (l) {
        if (ns.LayerGroupUtils.ancestors(layers, l).indexOf(l) !== -1) {
          ns.LayerGroupUtils.state(l).parentGroup = null;
        }
      });
      var ordered = [],
        visited = new Set();
      var visit = function (l) {
        if (visited.has(l)) {
          return;
        }
        visited.add(l);
        layers
          .filter(function (c) {
            return ns.LayerGroupUtils.parent(layers, c) === l;
          })
          .forEach(visit);
        ordered.push(l);
      };
      layers
        .filter(function (l) {
          return !ns.LayerGroupUtils.parent(layers, l);
        })
        .forEach(visit);
      layers.forEach(visit);
      layers.splice.apply(layers, [0, layers.length].concat(ordered));
    },
    duplicate: function (layers, layer) {
      if (layers.indexOf(layer) === -1) {
        return null;
      }
      this.normalize(layers);
      var branch = new Set([layer].concat(this.descendants(layers, layer))),
        source = layers.filter(function (item) {
          return branch.has(item);
        }),
        copies = source.map(function (item) {
          return ns.LayerUtils.clone(item);
        }),
        ids = new Map();
      source.forEach(function (item, index) {
        ids.set(
          ns.LayerGroupUtils.id(item),
          ns.LayerGroupUtils.id(copies[index])
        );
      });
      copies.forEach(function (copy, index) {
        var original = source[index],
          parentId = ns.LayerGroupUtils.state(original).parentGroup;
        ns.LayerGroupUtils.state(copy).parentGroup =
          ids.get(parentId) || parentId || null;
        (copy.rowState.effects || []).forEach(function (effect) {
          if (effect.params && ids.has(effect.params.maskId)) {
            effect.params.maskId = ids.get(effect.params.maskId);
          }
        });
        if (original !== layer) {
          copy.setName(original.getName());
        }
      });
      var rootCopy = copies[source.indexOf(layer)];
      layers.splice.apply(
        layers,
        [layers.indexOf(layer) + 1, 0].concat(copies)
      );
      this.normalize(layers);
      return rootCopy;
    },
    moveTo: function (layers, layer, target, position) {
      if (
        layers.indexOf(layer) === -1 ||
        layer === target ||
        (target &&
          (layers.indexOf(target) === -1 ||
            this.ancestors(layers, target).indexOf(layer) !== -1))
      ) {
        return false;
      }
      if (position === "inside" && (!target || !this.isGroup(target))) {
        return false;
      }
      var parent = !target
        ? null
        : position === "inside"
          ? target
          : this.parent(layers, target);
      var branch = new Set([layer].concat(this.descendants(layers, layer)));
      var moving = layers.filter(function (item) {
        return branch.has(item);
      });
      var kept = layers.filter(function (item) {
        return !branch.has(item);
      });
      var at = 0;
      if (target) {
        at = kept.indexOf(target);
        if (position === "above") {
          at++;
        } else if (position === "below") {
          var targetBranch = new Set(
            [target].concat(this.descendants(kept, target))
          );
          at = kept.findIndex(function (item) {
            return targetBranch.has(item);
          });
        }
      }
      this.state(layer).parentGroup = parent ? this.id(parent) : null;
      if (position === "inside") {
        this.state(target).collapsed = false;
      }
      kept.splice.apply(kept, [at, 0].concat(moving));
      layers.splice.apply(layers, [0, layers.length].concat(kept));
      this.normalize(layers);
      return true;
    },
    move: function (layers, layer, direction) {
      var parent = this.parent(layers, layer),
        siblings = layers.filter(function (l) {
          return ns.LayerGroupUtils.parent(layers, l) === parent;
        }),
        at = siblings.indexOf(layer),
        other = siblings[at + direction];
      if (!other) {
        return;
      }
      var branch = [layer].concat(this.descendants(layers, layer)),
        otherBranch = [other].concat(this.descendants(layers, other)),
        kept = layers.filter(function (l) {
          return branch.indexOf(l) === -1;
        }),
        index =
          direction > 0
            ? Math.max.apply(
                null,
                otherBranch.map(function (l) {
                  return kept.indexOf(l);
                })
              ) + 1
            : Math.min.apply(
                null,
                otherBranch.map(function (l) {
                  return kept.indexOf(l);
                })
              );
      var orderedBranch = layers.filter(function (l) {
        return branch.indexOf(l) !== -1;
      });
      kept.splice.apply(kept, [index, 0].concat(orderedBranch));
      layers.splice.apply(layers, [0, layers.length].concat(kept));
      this.normalize(layers);
    },
    hidden: function (layers, layer) {
      return [layer].concat(this.ancestors(layers, layer)).some(function (l) {
        return !!ns.LayerGroupUtils.state(l).hidden || l.getOpacity() === 0;
      });
    },
    locked: function (layers, layer) {
      return this.ancestors(layers, layer).some(function (l) {
        return !!ns.LayerGroupUtils.state(l).locked;
      });
    }
  };
})();

(function () {
  var ns = $.namespace("pskl.utils");
  var sides = ["transform", "palettes", "studios", "options"];
  var rows = ["frames", "layers"];
  var zones = ["left", "right", "top", "bottom"];
  var defaults = function () {
    return {
      version: 1,
      tools: "left",
      preview: "right",
      left: [],
      right: sides.slice(),
      top: [],
      bottom: rows.slice()
    };
  };
  var allowed = function (id) {
    return rows.indexOf(id) !== -1 ? ["top", "bottom"] : ["left", "right"];
  };
  var normalize = function (value) {
    var result = defaults();
    if (!value || value.version !== 1) {
      return result;
    }
    ["tools", "preview"].forEach(function (id) {
      if (allowed(id).indexOf(value[id]) !== -1) {
        result[id] = value[id];
      }
    });
    var seen = [];
    zones.forEach(function (zone) {
      result[zone] = [];
      (Array.isArray(value[zone]) ? value[zone] : []).forEach(function (id) {
        if (
          sides.concat(rows).indexOf(id) !== -1 &&
          allowed(id).indexOf(zone) !== -1 &&
          seen.indexOf(id) === -1
        ) {
          result[zone].push(id);
          seen.push(id);
        }
      });
    });
    sides.concat(rows).forEach(function (id) {
      if (seen.indexOf(id) === -1) {
        if (id === "studios") {
          // Older saved workspaces predate the Studios panel. Keep its new
          // launcher beside Palettes without resetting existing placements.
          var side = result.left.indexOf("palettes") !== -1 ? "left" : "right";
          result[side].splice(result[side].indexOf("palettes") + 1, 0, id);
        } else {
          result[sides.indexOf(id) !== -1 ? "right" : "bottom"].push(id);
        }
      }
    });
    return result;
  };
  ns.WorkspaceLayout = {
    storageKey: "student-pixel.workspace.v1",
    defaults: defaults,
    normalize: normalize,
    allowed: allowed,
    zone: function (state, id) {
      if (id === "tools" || id === "preview") {
        return state[id];
      }
      return zones.find(function (zone) {
        return state[zone].indexOf(id) !== -1;
      });
    },
    move: function (state, id, zone, before) {
      var next = normalize(state);
      if (
        sides.concat(rows, ["tools", "preview"]).indexOf(id) === -1 ||
        allowed(id).indexOf(zone) === -1 ||
        before === id
      ) {
        return next;
      }
      if (id === "tools" || id === "preview") {
        next[id] = zone;
      } else {
        zones.forEach(function (name) {
          next[name] = next[name].filter(function (item) {
            return item !== id;
          });
        });
        var index = next[zone].indexOf(before);
        next[zone].splice(index < 0 ? next[zone].length : index, 0, id);
      }
      return next;
    }
  };
})();

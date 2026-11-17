(function () {
  var r = pskl.utils.RigStudioUtils;
  r.isSetupMode = function (mode) {
    return [
      "rest",
      "add",
      "root",
      "split",
      "connector",
      "connect",
      "link",
      "unlink"
    ].includes(mode);
  };
  r.addConnector = function (rig, parentId, point) {
    var parent = rig.bones.find(function (b) {
      return b.id === parentId;
    });
    if (!parent || parent.connector) {
      throw new Error("Click a body segment for the connector.");
    }
    var world = r.world(rig, null),
      local = r.point(r.inverse(world[parentId].endMatrix), point.x, point.y);
    var b = r.addJoint(rig, parentId, { x: point.x + 1, y: point.y });
    Object.assign(b, {
      name:
        parent.name +
        " connector " +
        (rig.bones.filter(function (v) {
          return v.connector;
        }).length +
          1),
      connector: true,
      x: local.x,
      y: local.y,
      angle: 0,
      length: 0,
      radius: 0,
      radiusEnd: 0,
      layerId: null
    });
    return b;
  };
  r.reparent = function (rig, childId, parentId) {
    var next = pskl.utils.ToolStateUtils.clone(rig);
    r.migratePins(next);
    var child = next.bones.find(function (b) {
        return b.id === childId;
      }),
      parent = next.bones.find(function (b) {
        return b.id === parentId;
      });
    if (!child || (parentId && !parent)) {
      throw new Error("Choose an existing joint or Root / no parent.");
    }
    for (
      var p = parent;
      p;
      p = next.bones.find(function (b) {
        return b.id === p.parent;
      })
    ) {
      if (p === child) {
        throw new Error(
          "A joint cannot connect to itself or its own descendant."
        );
      }
    }
    if (child.deformSource) {
      throw new Error(
        "Attach the start of this limb, keeping its split joints together."
      );
    }
    if ((child.parent || null) === (parentId || null)) {
      return rig.bones.find(function (b) {
        return b.id === childId;
      });
    }
    var poses = [next.workingPose].concat(
      next.poses.map(function (p) {
        return p.values;
      })
    );
    var matrices = poses.map(function (p) {
      return r.world(next, p)[childId];
    });
    var rest = r.world(next, null),
      local = r.multiply(
        r.inverse(parent ? rest[parent.id].endMatrix : r.identity()),
        rest[child.id].matrix
      );
    child.parent = parent ? parent.id : null;
    child.x = local[4];
    child.y = local[5];
    child.angle = (Math.atan2(local[1], local[0]) * 180) / Math.PI;
    poses.forEach(function (p, index) {
      var base = parent ? r.world(next, p)[parent.id].endMatrix : r.identity(),
        m = r.multiply(r.inverse(base), matrices[index].matrix);
      var sx = Math.hypot(m[0], m[1]),
        sy = (m[0] * m[3] - m[1] * m[2]) / sx;
      if (sx < 1e-6 || Math.abs(sy) < 1e-6) {
        throw new Error(
          "Restore a non-zero part scale before changing its parent."
        );
      }
      // Matrix decomposition can cross an exact allowed boundary by a few ulps.
      // Normalize only rounding noise; actual out-of-range poses still fail.
      var boundary = function (value, limits) {
        return (
          limits.find(function (limit) {
            return Math.abs(value - limit) < 1e-10;
          }) ?? value
        );
      };
      p[child.id] = Object.assign({}, p[child.id], {
        x: m[4] - child.x,
        y: m[5] - child.y,
        rotation: (Math.atan2(m[1], m[0]) * 180) / Math.PI - child.angle,
        scaleX: boundary(sx, [0.05, 4]),
        scaleY: boundary(sy, [-4, -0.05, 0.05, 4]),
        shear: boundary((m[0] * m[2] + m[1] * m[3]) / (sx * sy), [-2, 2]),
        visible: matrices[index].visible
      });
    });
    // Reject incompatible paths or out-of-range transforms without partially
    // changing the original rig. A successful edit preserves authored matrices.
    r.validate(next);
    Object.assign(rig, next);
    return rig.bones.find(function (b) {
      return b.id === childId;
    });
  };
  r.connectTo = function (rig, childId, connectorId) {
    var hub = rig.bones.find(function (b) {
      return b.id === connectorId;
    });
    if (!hub || !hub.connector) {
      throw new Error("Select a connector, then click a limb segment.");
    }
    return r.reparent(rig, childId, connectorId);
  };
  r.clearJoints = function (rig) {
    rig.bones = [];
    rig.workingPose = {};
    rig.poses = [];
    rig.empty = true;
    rig.skin = false;
    rig.clips.forEach(function (clip) {
      clip.keys = [];
      clip.paths = [];
    });
    return rig;
  };
})();

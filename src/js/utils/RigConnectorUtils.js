(function () {
  var r = pskl.utils.RigStudioUtils;
  r.isSetupMode = function (mode) {
    return ["rest", "add", "split", "connector", "connect"].includes(mode);
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
  r.connectTo = function (rig, childId, connectorId) {
    var child = rig.bones.find(function (b) {
        return b.id === childId;
      }),
      hub = rig.bones.find(function (b) {
        return b.id === connectorId;
      });
    if (!child || !hub || !hub.connector || child === hub) {
      throw new Error("Select a connector, then click a limb segment.");
    }
    for (
      var p = hub;
      p;
      p = rig.bones.find(function (b) {
        return b.id === p.parent;
      })
    ) {
      if (p === child) {
        throw new Error("A connector cannot attach its own parent branch.");
      }
    }
    if (child.deformSource) {
      throw new Error(
        "Attach the start of this limb, keeping its split joints together."
      );
    }
    var poses = [rig.workingPose].concat(
      rig.poses.map(function (p) {
        return p.values;
      })
    );
    var matrices = poses.map(function (p) {
      return r.world(rig, p)[childId].matrix.slice();
    });
    var rest = r.world(rig, null),
      local = r.multiply(
        r.inverse(rest[hub.id].endMatrix),
        rest[child.id].matrix
      );
    child.parent = hub.id;
    child.x = local[4];
    child.y = local[5];
    child.angle = (Math.atan2(local[1], local[0]) * 180) / Math.PI;
    poses.forEach(function (p, index) {
      var parent = r.world(rig, p)[hub.id].endMatrix,
        m = r.multiply(r.inverse(parent), matrices[index]);
      var sx = Math.hypot(m[0], m[1]),
        sy = (m[0] * m[3] - m[1] * m[2]) / sx;
      if (sx < 1e-6 || Math.abs(sy) < 1e-6) {
        throw new Error("Restore a non-zero part scale before attaching it.");
      }
      p[child.id] = Object.assign({}, p[child.id], {
        x: m[4] - child.x,
        y: m[5] - child.y,
        rotation: (Math.atan2(m[1], m[0]) * 180) / Math.PI - child.angle,
        scaleX: sx,
        scaleY: sy,
        shear: (m[0] * m[2] + m[1] * m[3]) / (sx * sy)
      });
    });
    return child;
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

describe("Position-preserving rig parent changes", function () {
  var r = pskl.utils.RigStudioUtils,
    clone = pskl.utils.ToolStateUtils.clone;
  function make() {
    var rig = r.template("humanoid", 32, 32);
    rig.bones = rig.bones.slice(0, 3);
    rig.bones.forEach(function (b, i) {
      b.id = "b" + i;
      b.parent = i ? "b" + (i - 1) : null;
      b.layerId = null;
    });
    rig.workingPose = {
      b0: { rotation: 35, scaleX: 1.2, scaleY: 0.8, shear: 0.1 },
      b1: { rotation: -20, x: 2, scaleX: 0.9, scaleY: 1.1, shear: 0.2 }
    };
    rig.poses = [
      { id: "first", name: "First", values: clone(rig.workingPose) },
      {
        id: "second",
        name: "Second",
        values: {
          b0: { rotation: -45, scaleX: -1 },
          b1: { rotation: 60, y: 3 }
        }
      }
    ];
    return rig;
  }
  function worlds(rig) {
    return [r.world(rig, null), r.world(rig, rig.workingPose)].concat(
      rig.poses.map(function (p) {
        return r.world(rig, p.values);
      })
    );
  }
  function same(a, b, ids) {
    a.forEach(function (w, i) {
      ids.forEach(function (id) {
        w[id].matrix.forEach(function (v, k) {
          expect(b[i][id].matrix[k]).toBeCloseTo(v, 7);
        });
      });
    });
  }
  it("disconnects a rotated, scaled and sheared branch without moving rest, working or saved poses", function () {
    var rig = make(),
      before = worlds(rig);
    r.reparent(rig, "b1", null);
    expect(rig.bones[1].parent).toBe(null);
    same(before, worlds(rig), ["b0", "b1", "b2"]);
  });
  it("keeps per-pose pins and descendant positions when connecting to another parent", function () {
    var rig = make();
    rig.workingPose.b1.pin = { x: 11, y: 12 };
    rig.poses[0].values.b1.pin = { x: 9, y: 14 };
    var extra = r.addJoint(rig, null, { x: 20, y: 24 });
    extra.id = "other";
    rig.workingPose.other = { rotation: 15 };
    var before = worlds(rig);
    r.reparent(rig, "b1", "other");
    same(before, worlds(rig), ["b0", "b1", "b2", "other"]);
    expect(rig.workingPose.b1.pin).toEqual({ x: 11, y: 12 });
    expect(rig.poses[0].values.b1.pin).toEqual({ x: 9, y: 14 });
  });
  it("rejects cycles and missing parents atomically", function () {
    var rig = make(),
      before = JSON.stringify(rig);
    expect(function () {
      r.reparent(rig, "b0", "b2");
    }).toThrow();
    expect(JSON.stringify(rig)).toBe(before);
    expect(function () {
      r.reparent(rig, "b1", "missing");
    }).toThrow();
    expect(JSON.stringify(rig)).toBe(before);
  });
  it("does not detach a split joint from its deforming source", function () {
    var rig = make(),
      root = rig.bones[0];
    root.length = 12;
    var split = r.splitSegment(rig, root.id, 0.5, "hinge"),
      before = JSON.stringify(rig);
    expect(function () {
      r.reparent(rig, split.id, null);
    }).toThrow();
    expect(JSON.stringify(rig)).toBe(before);
  });
  it("accepts exact transform limits despite decomposition rounding", function () {
    var rig = make();
    rig.poses = [];
    rig.workingPose = {
      b0: { rotation: 31 },
      b1: { scaleX: 4, scaleY: 0.05, shear: 2 }
    };
    var before = worlds(rig);
    expect(function () {
      r.reparent(rig, "b1", null);
    }).not.toThrow();
    same(before, worlds(rig), ["b0", "b1", "b2"]);
  });
  it("rejects transforms beyond the supported limits without a partial disconnect", function () {
    var rig = make();
    rig.poses = [];
    rig.workingPose = { b0: { scaleX: 4 }, b1: { scaleX: 4 } };
    var before = JSON.stringify(rig);
    expect(function () {
      r.reparent(rig, "b1", null);
    }).toThrow();
    expect(JSON.stringify(rig)).toBe(before);
  });
});

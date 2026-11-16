describe("Shoulder and pelvis connectors", function () {
  var r = pskl.utils.RigStudioUtils;
  function rig() {
    var v = r.template("humanoid", 32, 32),
      b = v.bones[0];
    Object.assign(b, {
      id: "body",
      name: "Body",
      parent: null,
      x: 16,
      y: 22,
      angle: -90,
      length: 12,
      layerId: null
    });
    v.bones = [b];
    r.addJoint(v, null, { x: 8, y: 10 }).id = "arm";
    Object.assign(v.bones[1], {
      name: "Arm",
      x: 8,
      y: 10,
      angle: 0,
      length: 8
    });
    v.skin = false;
    return v;
  }
  function matrixNear(a, b) {
    a.forEach(function (v, i) {
      expect(v).toBeCloseTo(b[i], 6);
    });
  }
  it("carries attached limbs with body rotation while allowing independent bends", function () {
    var v = rig(),
      hub = r.addConnector(v, "body", { x: 16, y: 10 }),
      before = r.world(v, null);
    r.connectTo(v, "arm", hub.id);
    expect(v.bones[1].parent).toBe(hub.id);
    matrixNear(r.world(v, null).arm.matrix, before.arm.matrix);
    v.workingPose.body = { rotation: 30 };
    var after = r.world(v, v.workingPose);
    expect(after.arm.start).not.toEqual(before.arm.start);
    var body = after.body.matrix.slice();
    v.workingPose.arm.rotation += 40;
    matrixNear(r.world(v, v.workingPose).body.matrix, body);
    expect(function () {
      r.validate(v);
    }).not.toThrow();
  });
  it("preserves existing rest and authored pose matrices when attaching", function () {
    var v = rig();
    v.workingPose = {
      body: { rotation: 25 },
      arm: { rotation: 12, x: 2, scaleX: 1.2, scaleY: 0.8, shear: 0.2 }
    };
    v.poses = [
      {
        id: "pose",
        name: "Pose",
        values: { body: { rotation: -20 }, arm: { rotation: 40, y: 3 } }
      }
    ];
    var rest = r.world(v, null).arm.matrix,
      working = r.world(v, v.workingPose).arm.matrix,
      key = r.world(v, v.poses[0].values).arm.matrix,
      hub = r.addConnector(v, "body", { x: 16, y: 14 });
    r.connectTo(v, "arm", hub.id);
    matrixNear(r.world(v, null).arm.matrix, rest);
    matrixNear(r.world(v, v.workingPose).arm.matrix, working);
    matrixNear(r.world(v, v.poses[0].values).arm.matrix, key);
  });
  it("rejects parenting cycles and gives connectors a distinct selectable point", function () {
    var v = rig(),
      hub = r.addConnector(v, "body", { x: 16, y: 16 });
    expect(function () {
      r.connectTo(v, "body", hub.id);
    }).toThrow();
    var w = r.world(v, {});
    expect(r.pickJoint(v, w, w[hub.id].start).kind).toBe("start");
    expect(r.nearestSegment(v, w[hub.id].start).id).toBe("body");
    expect(hub.length).toBe(0);
  });
  it("clears the skeleton and pose keys, keeps guides and can create a new root", function () {
    var v = rig();
    v.guides = [
      { name: "Floor", axis: "horizontal", position: 28, color: "#ffffff" }
    ];
    v.poses = [{ id: "p", name: "Pose", values: {} }];
    v.clips[0].keys = [{ at: 0, pose: "p", easing: "linear" }];
    r.clearJoints(v);
    expect(v.bones.length).toBe(0);
    expect(v.clips[0].keys.length).toBe(0);
    expect(v.guides.length).toBe(1);
    expect(function () {
      r.validate(v);
    }).not.toThrow();
    r.addJoint(v, null, { x: 10, y: 10 });
    expect(v.bones.length).toBe(1);
    expect(function () {
      r.validate(v);
    }).not.toThrow();
  });
  it("keeps a shoulder connector outside limb IK and picks the selected overlapping handle", function () {
    var v = rig();
    v.bones[1].x = 16;
    v.bones[1].y = 10;
    var hub = r.addConnector(v, "body", { x: 16, y: 10 });
    r.connectTo(v, "arm", hub.id);
    var w = r.world(v, {}),
      out = r.dragJoint(v, {}, "arm", "end", { x: 16, y: 18 }, 1),
      after = r.world(v, out);
    matrixNear(after.body.matrix, w.body.matrix);
    matrixNear(after[hub.id].matrix, w[hub.id].matrix);
    expect(pskl.utils.JointMotionPathUtils.mode(v, {}, "arm", "end")).toBe(
      "rotate"
    );
    expect(r.pickJoint(v, w, w[hub.id].start, hub.id).id).toBe(hub.id);
    expect(r.pickJoint(v, w, w[hub.id].start, "body").id).toBe("body");
  });
});

describe("Rig artwork follows layer order", function () {
  function setup(nested) {
    var s = pskl.utils,
      make = function (name, color) {
        var f = new pskl.model.Frame(4, 4);
        for (var y = 0; y < 3; y++)
          for (var x = 0; x < 3; x++) f.setPixel(x, y, color);
        var l = pskl.model.Layer.fromFrames(name, [f]);
        l.rowState = {
          id: name,
          groupNodeId: name,
          parentGroup: nested ? "Folder" : null
        };
        return l;
      },
      leg = make("Leg", "#ff0000"),
      body = make("Body", "#0000ff"),
      layers = [leg, body];
    if (nested) {
      var folder = make("Folder", "rgba(0,0,0,0)");
      folder.rowState.isGroup = true;
      folder.rowState.parentGroup = null;
      folder.setOpacity(0.5);
      layers.push(folder);
    }
    var p = pskl.model.Piskel.fromLayers(layers, 12, {
        name: "Layer order",
        description: ""
      }),
      rig = s.RigStudioUtils.template("humanoid", 4, 4),
      a = rig.bones[0],
      b = rig.bones[1];
    Object.assign(a, { parent: null, layerId: "Body", group: "Same group" });
    Object.assign(b, { parent: a.id, layerId: "Leg", group: "Same group" });
    rig.bones = [a, b];
    rig.skin = false;
    p.toolState.rigStudio = rig;
    return { p: p, rig: rig };
  }
  function samePixels(a, b) {
    var aa = a.getContext("2d").getImageData(0, 0, 4, 4).data,
      bb = b.getContext("2d").getImageData(0, 0, 4, 4).data;
    for (var i = 0; i < aa.length; i++)
      expect(Math.abs(aa[i] - bb[i])).toBeLessThanOrEqual(1);
  }
  [false, true].forEach(function (nested) {
    it(
      "keeps overlapping leg artwork under the body, including bake and nesting=" +
        nested,
      function () {
        var x = setup(nested),
          s = pskl.utils,
          expected = s.LayerUtils.flattenFrameAt(x.p.getLayers(), 0, true),
          renderer = new s.RigStudioRenderer(x.p, x.rig);
        samePixels(renderer.scene({}, 0), expected);
        var pose = {};
        pose[x.rig.bones[0].id] = { order: -100 };
        pose[x.rig.bones[1].id] = { order: 100 };
        samePixels(renderer.scene(pose, 0), expected);
        var output,
          service = new pskl.service.PuppetStudioService({});
        service.replaceProject = function (p) {
          output = p;
        };
        service.bakeRig(x.p, x.rig, false);
        samePixels(
          s.LayerUtils.flattenFrameAt(output.getLayers(), 0, true),
          expected
        );
        expect(x.p.getLayers()[0].getOpacity()).toBe(1);
      }
    );
  });
});

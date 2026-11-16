describe("Animator artwork interaction", function () {
  var u = pskl.utils,
    r = u.RigStudioUtils,
    E = u.RigEditorUtils;
  function setup() {
    function layer(name, color) {
      var f = new pskl.model.Frame(32, 32);
      for (var y = 10; y < 14; y++)
        for (var x = 4; x < 13; x++) f.setPixel(x, y, color);
      var l = pskl.model.Layer.fromFrames(name, [f]);
      l.rowState.id = name;
      return l;
    }
    var back = layer("Back", "#ff0000"),
      front = layer("Front", "#0000ff"),
      p = pskl.model.Piskel.fromLayers([back, front], 12, {
        name: "Picking",
        description: ""
      }),
      rig = r.template("humanoid", 32, 32),
      b = rig.bones[0];
    Object.assign(b, {
      id: "part",
      parent: null,
      x: 4,
      y: 12,
      angle: 0,
      length: 8,
      layerId: "Back"
    });
    rig.bones = [b];
    rig.skin = false;
    return { p: p, rig: rig, back: back, front: front };
  }
  it("picks the visible foreground layer before the bound artwork beneath it", function () {
    var s = setup(),
      renderer = new u.RigStudioRenderer(s.p, s.rig);
    var hit = E.hit(renderer, {}, 0, { x: 8, y: 11 });
    expect(hit.layer).toBe(s.front);
    expect(hit.bone).toBe(null);
    s.front.rowState.hidden = true;
    renderer = new u.RigStudioRenderer(s.p, s.rig);
    expect(E.hit(renderer, {}, 0, { x: 8, y: 11 }).bone.id).toBe("part");
    expect(E.hit(renderer, {}, 0, { x: -1, y: 11 })).toBe(null);
  });
  it("picks transformed artwork at its displayed coordinates and respects solo focus", function () {
    var s = setup(),
      renderer = new u.RigStudioRenderer(s.p, s.rig),
      pose = { part: { x: 10 } };
    expect(E.hit(renderer, pose, 0, { x: 18, y: 11 }).bone.id).toBe("part");
    expect(
      E.hit(renderer, pose, 0, { x: 8, y: 11 }, { focus: "solo", bone: "part" })
    ).toBe(null);
  });
  it("dims or solos only the preview without changing source or subsequent normal renders", function () {
    var s = setup(),
      renderer = new u.RigStudioRenderer(s.p, s.rig),
      before = Array.from(s.front.getFrameAt(0).pixels),
      normal = renderer.scene({}, 0).toDataURL(),
      solo = renderer.scene({}, 0, [], { focus: "solo", bone: "part" }),
      dim = renderer.scene({}, 0, [], { focus: "dim", bone: "part" });
    expect(solo.toDataURL()).not.toBe(normal);
    expect(dim.toDataURL()).not.toBe(normal);
    expect(renderer.scene({}, 0).toDataURL()).toBe(normal);
    expect(Array.from(s.front.getFrameAt(0).pixels)).toEqual(before);
    expect(E.bounds(E.part(renderer, {}, "part"))).toEqual({
      x: 4,
      y: 10,
      width: 9,
      height: 4
    });
  });
  ["rotate", "scale", "scale-x", "scale-y", "shear"].forEach(function (kind) {
    it(
      "keeps the pivot and parent fixed while applying world " + kind,
      function () {
        var s = setup(),
          rig = s.rig,
          b = rig.bones[0],
          parent = r.addJoint(rig, null, { x: 20, y: 20 });
        parent.id = "parent";
        rig.workingPose.parent = {
          rotation: 25,
          scaleX: 1.3,
          scaleY: 0.8,
          shear: 0.15
        };
        r.reparent(rig, b.id, parent.id);
        var pose = rig.workingPose,
          before = r.world(rig, pose),
          from = { x: 12, y: 8 },
          to = { x: 14, y: 10 },
          out = E.transform(rig, pose, b.id, kind, from, to, { height: 8 }),
          after = r.world(rig, out);
        expect(after[b.id].start.x).toBeCloseTo(before[b.id].start.x, 6);
        expect(after[b.id].start.y).toBeCloseTo(before[b.id].start.y, 6);
        expect(after[parent.id]).toEqual(before[parent.id]);
        expect(after[b.id].matrix).not.toEqual(before[b.id].matrix);
        expect(pose).toEqual(rig.workingPose);
        rig.workingPose = out;
        expect(function () {
          r.validate(rig);
        }).not.toThrow();
      }
    );
  });
  it("moves in world coordinates and refuses moving a pinned pivot", function () {
    var s = setup(),
      rig = s.rig,
      pose = {},
      out = E.transform(
        rig,
        pose,
        "part",
        "move",
        { x: 8, y: 12 },
        { x: 11, y: 16 },
        {}
      ),
      w = r.world(rig, out).part;
    expect(w.start).toEqual({ x: 7, y: 16 });
    expect(pose).toEqual({});
    pose.part = { pin: { x: 4, y: 12 } };
    expect(function () {
      E.transform(
        rig,
        pose,
        "part",
        "move",
        { x: 8, y: 12 },
        { x: 9, y: 12 },
        {}
      );
    }).toThrow();
    var rotated = E.transform(
      rig,
      pose,
      "part",
      "rotate",
      { x: 12, y: 12 },
      { x: 4, y: 20 },
      {}
    );
    expect(r.world(rig, rotated).part.start).toEqual({ x: 4, y: 12 });
    expect(rotated.part.pin).toEqual(pose.part.pin);
  });
});

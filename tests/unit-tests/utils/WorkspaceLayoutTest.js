describe("Workspace layout", function () {
  var layout = pskl.utils.WorkspaceLayout;
  it("starts with the preview on the right and bottom frames above layers", function () {
    var state = layout.defaults();
    expect(state.preview).toBe("right");
    expect(state.bottom).toEqual(["frames", "layers"]);
  });
  it("moves and reorders each panel once without mutating its input", function () {
    var original = layout.defaults();
    var next = layout.move(original, "palettes", "left");
    next = layout.move(next, "transform", "left", "palettes");
    expect(next.left).toEqual(["transform", "palettes"]);
    expect(next.right).toEqual(["studios", "options"]);
    expect(original).toEqual(layout.defaults());
  });
  it("keeps wide rows out of sidebars and the preview out of horizontal rows", function () {
    var state = layout.defaults();
    expect(layout.move(state, "layers", "left")).toEqual(state);
    expect(layout.move(state, "preview", "bottom")).toEqual(state);
    expect(layout.move(state, "unknown", "right")).toEqual(state);
  });
  it("repairs duplicates, wrong positions and missing panels", function () {
    var state = layout.normalize({version:1, tools:"top", preview:"left", left:["palettes","layers","palettes"], right:["palettes","unknown"], top:["layers"]});
    expect(state.left).toEqual(["palettes", "studios"]);
    expect(state.right).toEqual(["transform", "options"]);
    expect(state.top).toEqual(["layers"]);
    expect(state.bottom).toEqual(["frames"]);
    expect(state.tools).toBe("left");
    expect(state.preview).toBe("left");
  });
  it("ignores unknown preference versions and invalid arrays", function () {
    expect(layout.normalize({version:2})).toEqual(layout.defaults());
    expect(layout.normalize({version:1, left:{}, right:null})).toEqual(layout.defaults());
  });
  it("adds Studios beside Palettes without resetting an older workspace", function () {
    var state = layout.normalize({version:1,tools:"right",preview:"left",left:["transform"],right:["palettes","options"],top:["layers"],bottom:["frames"]});
    expect(state.tools).toBe("right");
    expect(state.preview).toBe("left");
    expect(state.left).toEqual(["transform"]);
    expect(state.right).toEqual(["palettes","studios","options"]);
    expect(state.top).toEqual(["layers"]);
    expect(state.bottom).toEqual(["frames"]);
  });
  it("moves rows between top and bottom with a stable insertion order", function () {
    var next = layout.move(layout.defaults(), "layers", "top");
    next = layout.move(next, "frames", "top", "layers");
    expect(next.top).toEqual(["frames", "layers"]);
    expect(next.bottom).toEqual([]);
    expect(layout.zone(next, "frames")).toBe("top");
  });
});

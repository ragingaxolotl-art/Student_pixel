describe("Duplicate layers and group branches", function () {
  var g = pskl.utils.LayerGroupUtils;
  function layer(name, group, parent) {
    var f = new pskl.model.Frame(2, 2);
    f.setPixel(0, 0, "#ff0000");
    var l = pskl.model.Layer.fromFrames(name, [f, f.clone()]);
    l.rowState = {
      id: "rig-" + name,
      groupNodeId: name,
      isGroup: !!group,
      parentGroup: parent || null
    };
    return l;
  }
  it("copies every descendant with independent frames, metadata and identities", function () {
    var a = layer("Arm", false, "Character"),
      b = layer("Hand", false, "Limb"),
      limb = layer("Limb", true, "Character"),
      root = layer("Character", true),
      other = layer("Other");
    a.rowState.effects = [
      { id: "fx", operation: "invert", params: { amount: 20 } }
    ];
    a.rowState.locked = true;
    root.rowState.collapsed = true;
    root.setOpacity(0.7);
    var layers = [other, a, b, limb, root],
      copy = g.duplicate(layers, root),
      children = g.descendants(layers, copy);
    expect(layers.length).toBe(9);
    expect(children.length).toBe(3);
    expect(copy.getName()).toBe("Character (clone)");
    expect(copy.getOpacity()).toBe(0.7);
    expect(copy.rowState.collapsed).toBe(true);
    var ids = layers.map(function (l) {
      return g.id(l);
    });
    expect(new Set(ids).size).toBe(9);
    children.concat(copy).forEach(function (c) {
      expect(
        [a, b, limb, root].some(function (original) {
          return original.rowState.id === c.rowState.id;
        })
      ).toBe(false);
    });
    var arm = children.find(function (l) {
        return l.getName() === "Arm";
      }),
      hand = children.find(function (l) {
        return l.getName() === "Hand";
      }),
      copiedLimb = children.find(function (l) {
        return l.getName() === "Limb";
      });
    expect(g.parent(layers, arm)).toBe(copy);
    expect(g.parent(layers, hand)).toBe(copiedLimb);
    expect(g.parent(layers, copiedLimb)).toBe(copy);
    expect(arm.rowState.locked).toBe(true);
    expect(arm.getFrames().length).toBe(2);
    arm.getFrameAt(1).setPixel(0, 0, "#0000ff");
    arm.rowState.effects[0].params.amount = 90;
    expect(a.getFrameAt(1).getPixel(0, 0)).toBe(
      pskl.utils.colorToInt("#ff0000")
    );
    expect(a.rowState.effects[0].params.amount).toBe(20);
  });
  it("keeps a copied subgroup beside its original under the same outer parent", function () {
    var child = layer("Child", false, "Inner"),
      inner = layer("Inner", true, "Outer"),
      outer = layer("Outer", true),
      layers = [child, inner, outer],
      copy = g.duplicate(layers, inner);
    expect(g.parent(layers, copy)).toBe(outer);
    expect(g.descendants(layers, copy).length).toBe(1);
    expect(g.parent(layers, child)).toBe(inner);
    expect(layers.indexOf(copy)).toBeGreaterThan(layers.indexOf(inner));
    expect(layers.indexOf(copy)).toBeLessThan(layers.indexOf(outer));
  });
  it("keeps ordinary layer duplication in its current group", function () {
    var child = layer("Child", false, "Parent"),
      parent = layer("Parent", true),
      layers = [child, parent],
      copy = g.duplicate(layers, child);
    expect(layers.length).toBe(3);
    expect(copy.getName()).toBe("Child (clone)");
    expect(g.parent(layers, copy)).toBe(parent);
    expect(layers.indexOf(copy)).toBe(layers.indexOf(child) + 1);
  });
  it("duplicates an empty group without adopting its original's siblings", function () {
    var empty = layer("Empty", true),
      other = layer("Other"),
      layers = [other, empty],
      copy = g.duplicate(layers, empty);
    expect(g.isGroup(copy)).toBe(true);
    expect(g.descendants(layers, copy)).toEqual([]);
    expect(layers.length).toBe(3);
  });
});

describe("Move layers and groups between branches", function () {
  var g = pskl.utils.LayerGroupUtils;
  function layer(name, group, parent) {
    var l = pskl.model.Layer.fromFrames(name, [new pskl.model.Frame(2, 2)]);
    l.rowState = {
      groupNodeId: name,
      isGroup: !!group,
      parentGroup: parent || null
    };
    return l;
  }
  it("moves a layer into a collapsed group and reveals it", function () {
    var a = layer("a"),
      b = layer("b", true),
      all = [a, b];
    b.rowState.collapsed = true;
    expect(g.moveTo(all, a, b, "inside")).toBe(true);
    expect(g.parent(all, a)).toBe(b);
    expect(b.rowState.collapsed).toBe(false);
  });
  it("moves a whole group above a sibling without separating its contents", function () {
    var a = layer("a", false, "G"),
      b = layer("b", false, "G"),
      root = layer("G", true),
      other = layer("Other", true),
      all = [a, b, root, other];
    g.moveTo(all, root, other, "above");
    expect(
      all.map(function (l) {
        return l.getName();
      })
    ).toEqual(["Other", "a", "b", "G"]);
    expect(g.descendants(all, root)).toEqual([a, b]);
  });
  it("moves a child out by dropping beside its parent", function () {
    var a = layer("a", false, "G"),
      b = layer("b", false, "G"),
      root = layer("G", true),
      all = [a, b, root];
    g.moveTo(all, a, root, "below");
    expect(g.parent(all, a)).toBe(null);
    expect(all).toEqual([a, b, root]);
    expect(g.descendants(all, root)).toEqual([b]);
  });
  it("rejects putting a group into its descendant without changing metadata", function () {
    var a = layer("Inner", true, "G"),
      root = layer("G", true),
      all = [a, root];
    expect(g.moveTo(all, root, a, "inside")).toBe(false);
    expect(g.parent(all, a)).toBe(root);
    expect(g.parent(all, root)).toBe(null);
  });
  it("allows the blank area to lift a branch to the root", function () {
    var a = layer("a", false, "G"),
      root = layer("G", true),
      all = [a, root];
    expect(g.moveTo(all, a, null, "below")).toBe(true);
    expect(g.parent(all, a)).toBe(null);
    expect(all[0]).toBe(a);
  });
});

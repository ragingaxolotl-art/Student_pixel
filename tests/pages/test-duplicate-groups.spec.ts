import test, { expect } from "@playwright/test";
import {
  openEditorWithSettledCanvas,
  undo,
  redo,
  downloadPiskelFile,
  importPiskelFile
} from "./editor-helpers";

async function setup(page: any) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openEditorWithSettledCanvas(page);
  await page.evaluate(() => {
    const s = window.pskl;
    const make = (name: string, group: boolean, parent: string | null) => {
      const f = new s.model.Frame(8, 8);
      f.setPixel(1, 1, "#ff0000");
      const l = s.model.Layer.fromFrames(name, [f, f.clone()]);
      l.rowState = {
        id: "rig-" + name,
        groupNodeId: name,
        isGroup: group,
        parentGroup: parent
      };
      return l;
    };
    const outside = make("Outside", false, null),
      arm = make("Arm", false, "Character"),
      hand = make("Hand", false, "Limb"),
      limb = make("Limb", true, "Character"),
      root = make("Character", true, "Outer"),
      outer = make("Outer", true, null);
    arm.rowState.locked = true;
    arm.rowState.effects = [
      {
        id: "invert-arm",
        operation: "invert",
        enabled: false,
        frame: null,
        params: { amount: 20 }
      }
    ];
    root.rowState.collapsed = true;
    root.setOpacity(0.7);
    s.app.piskelController.setPiskel(
      s.model.Piskel.fromLayers([outside, arm, hand, limb, root, outer], 12, {
        name: "Duplicate group test",
        description: ""
      })
    );
  });
}
test("Shift plus duplicates a collapsed group with its nested artwork and undoes in one step", async ({
  page
}) => {
  await setup(page);
  await page
    .locator(".layer-name")
    .filter({ hasText: /^Character$/ })
    .click();
  await page
    .getByRole("button", { name: "Add layer", exact: true })
    .click({ modifiers: ["Shift"] });
  const inspect = () =>
    page.evaluate(() => {
      const s = window.pskl,
        g = s.utils.LayerGroupUtils,
        c = s.app.piskelController,
        layers = c.getLayers(),
        copy = c.getCurrentLayer(),
        children = g.descendants(layers, copy);
      return {
        count: layers.length,
        copy: copy.getName(),
        opacity: copy.getOpacity(),
        collapsed: copy.rowState.collapsed,
        parent: g.parent(layers, copy)?.getName(),
        children: children.map((l: any) => ({
          name: l.getName(),
          parent: g.parent(layers, l)?.getName(),
          frames: l.getFrames().length,
          pixel: l.getFrameAt(1).getPixel(1, 1),
          locked: l.rowState.locked || false
        })),
        unique: new Set(layers.map((l: any) => g.id(l))).size
      };
    });
  const state = await inspect();
  expect(state.count).toBe(10);
  expect(state.copy).toBe("Character (clone)");
  expect(state.parent).toBe("Outer");
  expect(state.collapsed).toBe(true);
  expect(state.opacity).toBe(0.7);
  expect(state.unique).toBe(10);
  expect(state.children.map((l: any) => l.name)).toEqual([
    "Arm",
    "Hand",
    "Limb"
  ]);
  expect(state.children.find((l: any) => l.name === "Hand")?.parent).toBe(
    "Limb"
  );
  expect(
    state.children.every((l: any) => l.frames === 2 && l.pixel === 0xff0000ff)
  ).toBe(true);
  await undo(page);
  await expect(page.locator("[data-layer-index]")).toHaveCount(6);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const h = window.pskl.app.historyService;
        return h.isLoadStateAllowed_(h.currentIndex + 1);
      })
    )
    .toBe(true);
  await redo(page);
  await expect(page.locator("[data-layer-index]")).toHaveCount(10);
  expect((await inspect()).copy).toBe("Character (clone)");
  await page
    .getByRole("button", {
      name: "Expand group Character (clone)",
      exact: true
    })
    .click();
  const independent = await page.evaluate(() => {
    const s = window.pskl,
      g = s.utils.LayerGroupUtils,
      layers = s.app.piskelController.getLayers(),
      copy = layers.find((l: any) => l.getName() === "Character (clone)"),
      arm = g.descendants(layers, copy).find((l: any) => l.getName() === "Arm"),
      original = layers.find((l: any) => l.getName() === "Arm");
    arm.getFrameAt(1).setPixel(1, 1, "#0000ff");
    arm.rowState.effects[0].params.amount = 90;
    return {
      originalPixel: original.getFrameAt(1).getPixel(1, 1),
      originalEffect: original.rowState.effects[0].params.amount,
      distinctId: arm.rowState.id !== original.rowState.id
    };
  });
  expect(independent).toEqual({
    originalPixel: 0xff0000ff,
    originalEffect: 20,
    distinctId: true
  });
  const file = await downloadPiskelFile(page);
  await importPiskelFile(page, file);
  expect(
    await page.evaluate(() => {
      const s = window.pskl,
        g = s.utils.LayerGroupUtils,
        layers = s.app.piskelController.getLayers(),
        copy = layers.find((l: any) => l.getName() === "Character (clone)");
      return g.descendants(layers, copy).length;
    })
  ).toBe(3);
});

test("Shift plus still duplicates a single nested layer without copying its siblings", async ({
  page
}) => {
  await setup(page);
  await page
    .getByRole("button", { name: "Expand group Character", exact: true })
    .click();
  await page.getByText("Arm", { exact: true }).click();
  await page
    .getByRole("button", { name: "Add layer", exact: true })
    .click({ modifiers: ["Shift"] });
  expect(
    await page.evaluate(() => {
      const s = window.pskl,
        g = s.utils.LayerGroupUtils,
        c = s.app.piskelController;
      return {
        count: c.getLayers().length,
        name: c.getCurrentLayer().getName(),
        parent: g.parent(c.getLayers(), c.getCurrentLayer()).getName()
      };
    })
  ).toEqual({ count: 7, name: "Arm (clone)", parent: "Character" });
});

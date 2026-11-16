import test, { expect, Page } from "@playwright/test";
import { openEditorWithSettledCanvas, undo, redo } from "./editor-helpers";
const row = (page: Page, name: string) =>
  page.locator(".layer-item").filter({
    has: page
      .locator(".layer-name")
      .filter({ hasText: new RegExp("^" + name + "$") })
  });
async function dragDivider(page: Page, key: string, dy: number) {
  const h = page.locator(`[data-workspace-resize="${key}"]`);
  await expect(h).toBeVisible();
  const r = (await h.boundingBox())!;
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await page.mouse.down();
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2 + dy, {
    steps: 8
  });
  await page.mouse.up();
}
async function workspace(page: Page) {
  return page.evaluate(() => {
    const selectors = [
      "#main-wrapper",
      "#column-wrapper",
      ".main-column",
      ".frames-column",
      ".layers-column",
      '[data-dock="right"].workspace-side'
    ];
    return selectors.map((s) => {
      const e = document.querySelector(s)!,
        r = e.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, scroll: e.scrollTop };
    });
  });
}

test("switching layers and visibility preserve the whole workspace and both scroll positions", async ({
  page
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openEditorWithSettledCanvas(page);
  await page.evaluate(() => {
    const s = window.pskl;
    const make = (
      name: string,
      parent: string | null = null,
      group = false
    ) => {
      const f = new s.model.Frame(32, 32);
      f.setPixel(1, 1, "#ff0000");
      const l = s.model.Layer.fromFrames(name, [f]);
      l.rowState = { groupNodeId: name, parentGroup: parent, isGroup: group };
      return l;
    };
    const layers = [];
    for (let i = 0; i < 6; i++) layers.push(make("Tail" + i));
    layers.push(make("Target"));
    for (let i = 0; i < 20; i++) layers.push(make("Hidden" + i, "Folder"));
    const folder = make("Folder", null, true);
    folder.rowState.collapsed = true;
    layers.push(folder, make("Top1"), make("Top2"));
    s.app.piskelController.setPiskel(
      s.model.Piskel.fromLayers(layers, 12, {
        name: "Scroll stability",
        description: ""
      })
    );
  });
  const list = page.locator(".layers-list");
  await list.evaluate((e) => {
    e.scrollTop = 70;
  });
  const before = await workspace(page),
    scroll = await list.evaluate((e) => e.scrollTop);
  await row(page, "Target").locator(".layer-name").click();
  expect(await list.evaluate((e) => e.scrollTop)).toBe(scroll);
  expect(await workspace(page)).toEqual(before);
  await row(page, "Target").locator(".layer-fx").click();
  await page.getByLabel("Effect", { exact: true }).selectOption("outline");
  const right = page.locator('[data-dock="right"] .right-panels-scroller'),
    pane = page.locator("#layer-options");
  await right.evaluate((e) => {
    e.scrollTop = 200;
  });
  await pane.evaluate((e) => {
    e.scrollTop = 40;
  });
  const stable = await workspace(page),
    rightScroll = await right.evaluate((e) => e.scrollTop),
    inner = await pane.evaluate((e) => e.scrollTop);
  for (let i = 0; i < 4; i++) {
    await row(page, "Target").locator(".layer-visibility").click();
    expect(await workspace(page)).toEqual(stable);
    expect(await list.evaluate((e) => e.scrollTop)).toBe(scroll);
    expect(await right.evaluate((e) => e.scrollTop)).toBe(rightScroll);
    expect(await pane.evaluate((e) => e.scrollTop)).toBe(inner);
  }
  await row(page, "Tail5").locator(".layer-name").click();
  expect(await workspace(page)).toEqual(stable);
  expect(await right.evaluate((e) => e.scrollTop)).toBe(rightScroll);
  await page.evaluate(() =>
    window.pskl.UserSettings.set(window.pskl.UserSettings.WORKSPACE_LAYOUT, {
      layerWidth: 280
    })
  );
  await list.evaluate((e) => {
    e.scrollLeft = Math.min(10, e.scrollWidth - e.clientWidth);
  });
  const horizontal = await list.evaluate((e) => e.scrollLeft);
  expect(horizontal).toBeGreaterThan(0);
  await row(page, "Target").locator(".layer-visibility").click();
  expect(await list.evaluate((e) => e.scrollLeft)).toBe(horizontal);
});

test("drag handles nest, unnest and reorder whole branches with cycle prevention and undo", async ({
  page
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openEditorWithSettledCanvas(page);
  await page.evaluate(() => {
    const s = window.pskl;
    const make = (
      name: string,
      group = false,
      parent: string | null = null
    ) => {
      const l = s.model.Layer.fromFrames(name, [new s.model.Frame(32, 32)]);
      l.rowState = { groupNodeId: name, isGroup: group, parentGroup: parent };
      return l;
    };
    const solo = make("Solo"),
      a = make("InsideA", false, "GroupA"),
      ga = make("GroupA", true),
      b = make("InsideB", false, "GroupB"),
      gb = make("GroupB", true);
    ga.rowState.collapsed = true;
    s.app.piskelController.setPiskel(
      s.model.Piskel.fromLayers([solo, a, ga, b, gb], 12, {
        name: "Drag organization",
        description: ""
      })
    );
    s.UserSettings.set(s.UserSettings.WORKSPACE_LAYOUT, { layerHeight: 350 });
  });
  const parent = () =>
    page.evaluate(() => {
      const s = window.pskl,
        g = s.utils.LayerGroupUtils,
        l = s.app.piskelController.getLayers();
      return (
        g
          .parent(
            l,
            l.find((v: any) => v.getName() === "Solo")
          )
          ?.getName() || null
      );
    });
  await row(page, "Solo")
    .locator(".layer-drag")
    .dragTo(row(page, "GroupA"), { targetPosition: { x: 140, y: 15 } });
  await expect.poll(parent).toBe("GroupA");
  await expect(row(page, "InsideA")).toBeVisible();
  await row(page, "Solo")
    .locator(".layer-drag")
    .dragTo(row(page, "GroupB"), { targetPosition: { x: 140, y: 28 } });
  await expect.poll(parent).toBe(null);
  await row(page, "GroupA")
    .locator(".layer-drag")
    .dragTo(row(page, "GroupB"), { targetPosition: { x: 140, y: 2 } });
  const order = () =>
    page.evaluate(() =>
      window.pskl.app.piskelController.getLayers().map((l: any) => l.getName())
    );
  expect((await order()).slice(-2)).toEqual(["InsideA", "GroupA"]);
  const before = await order();
  await row(page, "GroupA")
    .locator(".layer-drag")
    .dragTo(row(page, "InsideA"), { targetPosition: { x: 140, y: 15 } });
  expect(await order()).toEqual(before);
  await undo(page);
  await expect.poll(order).not.toEqual(before);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const h = window.pskl.app.historyService;
        return h.isLoadStateAllowed_(h.currentIndex + 1);
      })
    )
    .toBe(true);
  await redo(page);
  await expect.poll(order).toEqual(before);
});

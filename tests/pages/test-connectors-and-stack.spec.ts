import test, { expect } from "@playwright/test";
import fs from "node:fs";
import {
  openEditorWithSettledCanvas,
  importPiskelFile,
  downloadPiskelFile
} from "./editor-helpers";

async function openStudio(page: any) {
  await page
    .getByRole("button", { name: "Puppet Studio", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start rigging", exact: true })
    .click();
  await expect(page.locator(".extra-tools-viewer")).toHaveAttribute(
    "data-preview-state",
    "ready"
  );
}
async function point(page: any, x: number, y: number, size = 32) {
  const c = (await page.locator('[data-art-preview="after"]').boundingBox())!;
  await page.mouse.click(
    c.x + (x * c.width) / size,
    c.y + (y * c.height) / size
  );
}
async function state(page: any) {
  return page.evaluate(() => {
    const s = window.pskl,
      p = s.app.piskelController.getPiskel(),
      rig = p.toolState.rigStudio;
    return {
      rig,
      world: s.utils.RigStudioUtils.world(rig, rig.workingPose),
      layers: p.getLayers().map((l: any) => ({
        name: l.getName(),
        parent: l.rowState.parentGroup || null,
        pixels: Array.from(l.getFrameAt(0).pixels)
      }))
    };
  });
}

test("connector placement and limb attachment keep the art still; body tilt carries the limb", async ({
  page
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openEditorWithSettledCanvas(page);
  await page.evaluate(() => {
    const s = window.pskl,
      make = (name: string, color: string) => {
        const f = new s.model.Frame(32, 32);
        for (let x = 10; x < 22; x++)
          for (let y = 10; y < 23; y++) f.setPixel(x, y, color);
        const l = s.model.Layer.fromFrames(name, [f]);
        l.rowState = { id: name, groupNodeId: name };
        return l;
      };
    const p = s.model.Piskel.fromLayers(
        [make("Arm art", "#ff0000"), make("Body art", "#0000ff")],
        12,
        { name: "Connector test", description: "" }
      ),
      r = s.utils.RigStudioUtils.template("humanoid", 32, 32),
      body = r.bones[0];
    Object.assign(body, {
      id: "body",
      name: "Body",
      parent: null,
      x: 16,
      y: 24,
      angle: -90,
      length: 16,
      layerId: "Body art"
    });
    r.bones = [body];
    const arm = s.utils.RigStudioUtils.addJoint(r, null, { x: 8, y: 12 });
    Object.assign(arm, {
      id: "arm",
      name: "Arm",
      angle: 0,
      length: 8,
      layerId: "Arm art"
    });
    r.skin = false;
    p.toolState.rigStudio = r;
    s.app.piskelController.setPiskel(p);
  });
  await openStudio(page);
  const original = await state(page);
  await page.getByRole("button", { name: "Connector", exact: true }).click();
  await point(page, 16, 12);
  await expect
    .poll(
      async () =>
        (await state(page)).rig.bones.filter((b: any) => b.connector).length
    )
    .toBe(1);
  const hub = (await state(page)).rig.bones.find((b: any) => b.connector);
  await expect(
    page.locator(`[data-joint-id="${hub.id}"][data-joint-type="connector"]`)
  ).toBeVisible();
  await page.getByRole("button", { name: "Attach limb", exact: true }).click();
  await point(page, 12, 12);
  await expect
    .poll(
      async () =>
        (await state(page)).rig.bones.find((b: any) => b.id === "arm").parent
    )
    .toBe(hub.id);
  const attached = await state(page);
  expect(attached.layers).toEqual(original.layers);
  expect(attached.world.arm.start.x).toBeCloseTo(original.world.arm.start.x, 5);
  expect(attached.world.arm.start.y).toBeCloseTo(original.world.arm.start.y, 5);
  await page
    .getByRole("button", { name: "Select bone Body", exact: true })
    .click();
  await page.getByRole("button", { name: "Pose", exact: true }).click();
  await page.getByLabel("Pose rotation", { exact: true }).fill("25");
  await page.getByRole("button", { name: "Save Rig", exact: true }).click();
  const tilted = await state(page);
  expect(tilted.world.arm.start).not.toEqual(attached.world.arm.start);
  expect(tilted.layers).toEqual(original.layers);
  await page
    .getByRole("button", { name: "Select bone Arm", exact: true })
    .click();
  await page.getByLabel("Pose rotation", { exact: true }).fill("50");
  await page.getByRole("button", { name: "Save Rig", exact: true }).click();
  expect((await state(page)).world.body).toEqual(tilted.world.body);
  await page
    .getByRole("button", { name: "Close Puppet Studio", exact: true })
    .click();
  const file = await downloadPiskelFile(page);
  await importPiskelFile(page, file);
  expect((await state(page)).rig.bones.some((b: any) => b.connector)).toBe(
    true
  );
});

test("Clear joints preserves all artwork, is undoable, and can reopen and start a fresh skeleton", async ({
  page
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openEditorWithSettledCanvas(page);
  await openStudio(page);
  const before = await state(page);
  await page.getByRole("button", { name: "Clear joints", exact: true }).click();
  await expect.poll(async () => (await state(page)).rig.bones.length).toBe(0);
  expect((await state(page)).layers).toEqual(before.layers);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect
    .poll(async () => (await state(page)).rig.bones.length)
    .toBe(before.rig.bones.length);
  await page.getByRole("button", { name: "Clear joints", exact: true }).click();
  await expect.poll(async () => (await state(page)).rig.bones.length).toBe(0);
  await page
    .getByRole("button", { name: "Close Puppet Studio", exact: true })
    .click();
  await expect(page.locator("#dialog-container .puppet-form")).toHaveCount(0);
  await openStudio(page);
  expect((await state(page)).rig.bones.length).toBe(0);
  await page.getByRole("button", { name: "+ Joint", exact: true }).click();
  await expect.poll(async () => (await state(page)).rig.bones.length).toBe(1);
});

test("Tester man keeps its exact 14-layer order and rest appearance when binding a leg", async ({
  page
}) => {
  test.setTimeout(120000);
  const input =
    process.env.PISKEL_TESTER_FILE || "";
  test.skip(!fs.existsSync(input), "Optional user tester fixture");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openEditorWithSettledCanvas(page);
  await importPiskelFile(page, input);
  const baseline = await page.evaluate(() => {
    const s = window.pskl,
      p = s.app.piskelController.getPiskel();
    return {
      layers: p.getLayers().map((l: any) => ({
        name: l.getName(),
        id: l.rowState.id,
        parent: l.rowState.parentGroup || null,
        hash: l
          .getFrameAt(0)
          .pixels.reduce(
            (h: number, p: number) => Math.imul(h ^ p, 16777619) >>> 0,
            2166136261
          )
      })),
      count: p.getLayers().length
    };
  });
  expect(baseline.count).toBe(14);
  await page.locator(".layers-list").evaluate((e: any) => {
    e.scrollTop = 10;
  });
  const listScroll = await page
    .locator(".layers-list")
    .evaluate((e: any) => e.scrollTop);
  await openStudio(page);
  const bone = await page.evaluate(
    () =>
      window.pskl.app.piskelController
        .getPiskel()
        .toolState.rigStudio.bones.find(
          (b: any) => !b.layerId && b.parent === null
        ).id
  );
  await page.locator('[name="rig-bone"]').selectOption(bone);
  await page
    .getByLabel("Bound source layer", { exact: true })
    .selectOption({ label: "R. Leg" });
  await page.getByRole("button", { name: "Save Rig", exact: true }).click();
  const result = await page.evaluate(() => {
    const s = window.pskl,
      p = s.app.piskelController.getPiskel(),
      r = s.utils.RigStudioUtils.config(p),
      renderer = new s.utils.RigStudioRenderer(p, r),
      normal = s.utils.LayerUtils.flattenFrameAt(p.getLayers(), 0, true)
        .getContext("2d")
        .getImageData(0, 0, 512, 512).data,
      rigged = renderer
        .scene({}, 0)
        .getContext("2d")
        .getImageData(0, 0, 512, 512).data;
    let mismatches = 0;
    for (let i = 0; i < normal.length; i++)
      if (Math.abs(normal[i] - rigged[i]) > 2) mismatches++;
    return {
      mismatches,
      layers: p.getLayers().map((l: any) => ({
        name: l.getName(),
        id: l.rowState.id,
        parent: l.rowState.parentGroup || null,
        hash: l
          .getFrameAt(0)
          .pixels.reduce(
            (h: number, p: number) => Math.imul(h ^ p, 16777619) >>> 0,
            2166136261
          )
      }))
    };
  });
  expect(result.layers).toEqual(baseline.layers);
  expect(result.mismatches).toBe(0);
  expect(
    await page.locator(".layers-list").evaluate((e: any) => e.scrollTop)
  ).toBe(listScroll);
  await page.screenshot({
    path: test.info().outputPath("tester-man-layer-order.png")
  });
});

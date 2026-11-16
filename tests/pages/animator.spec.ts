import test, { expect } from "@playwright/test";
import {
  openEditorWithSettledCanvas,
  downloadPiskelFile,
  importPiskelFile
} from "./editor-helpers";
let errors: string[] = [];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
});
test.afterEach(async () => {
  expect(errors).toEqual([]);
});
async function prepare(page: any, rotated = false) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openEditorWithSettledCanvas(page);
  await page.evaluate((rotated) => {
    const s = window.pskl,
      r = s.utils.RigStudioUtils,
      make = (
        name: string,
        color: string,
        x0: number,
        y0: number,
        x1: number,
        y1: number
      ) => {
        const f = new s.model.Frame(32, 32);
        for (let y = y0; y < y1; y++)
          for (let x = x0; x < x1; x++) f.setPixel(x, y, color);
        const l = s.model.Layer.fromFrames(name, [f]);
        l.rowState.id = name;
        return l;
      },
      p = s.model.Piskel.fromLayers(
        [
          make("Arm art", "#ee6655", 4, 10, 13, 14),
          make("Body art", "#4488ee", 14, 8, 19, 25),
          make("Foreground", "#ffffff", 6, 11, 7, 12)
        ],
        12,
        { name: "Animator audit", description: "" }
      ),
      rig = r.template("humanoid", 32, 32),
      body = rig.bones[0];
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
    rig.bones = [body];
    const arm = r.addJoint(rig, null, { x: 4, y: 12 });
    Object.assign(arm, {
      id: "arm",
      name: "Arm",
      angle: 0,
      length: 8,
      layerId: "Arm art"
    });
    rig.skin = false;
    r.reparent(rig, "arm", "body");
    rig.poses = [
      { id: "start", name: "Start", values: {} },
      {
        id: "end",
        name: "End",
        values: {
          body: { rotation: 35 },
          arm: { rotation: 15, scaleX: 1.2, scaleY: 0.9, shear: 0.1 }
        }
      }
    ];
    rig.clips[0].frames = 12;
    rig.clips[0].loop = false;
    rig.clips[0].keys = [
      { at: 0, pose: "start", easing: "linear", type: "key" },
      { at: 11, pose: "end", easing: "linear", type: "key" }
    ];
    rig.workingPose = rotated
      ? JSON.parse(JSON.stringify(rig.poses[1].values))
      : {};
    p.toolState.rigStudio = rig;
    s.app.piskelController.setPiskel(p);
  }, rotated);
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
  await page.getByRole("tab", { name: "Pose / animate", exact: true }).click();
}
async function state(page: any) {
  return page.evaluate(() => {
    const s = window.pskl,
      p = s.app.piskelController.getPiskel(),
      rig = p.toolState.rigStudio;
    return {
      rig,
      world: s.utils.RigStudioUtils.world(rig, rig.workingPose),
      poses: rig.poses.map((p: any) =>
        s.utils.RigStudioUtils.world(rig, p.values)
      ),
      layers: p.getLayers().map((l: any) => ({
        name: l.getName(),
        row: l.rowState,
        pixels: Array.from(l.getFrameAt(0).pixels)
      }))
    };
  });
}
async function point(page: any, x: number, y: number) {
  const canvas = page.locator('[data-art-preview="after"]');
  await canvas.hover();
  const c = (await canvas.boundingBox())!;
  return { x: c.x + (x * c.width) / 32, y: c.y + (y * c.height) / 32 };
}
async function renderedPoses(page: any) {
  return page.evaluate(() => {
    const s = window.pskl,
      p = s.app.piskelController.getPiskel(),
      rig = p.toolState.rigStudio;
    const renderer = new s.utils.RigStudioRenderer(p, rig);
    return [rig.workingPose, ...rig.poses.map((pose: any) => pose.values)].map(
      (pose) => renderer.scene(pose, 0).toDataURL()
    );
  });
}
async function clickArt(page: any) {
  const p = await point(page, 9, 11);
  await page.mouse.click(p.x, p.y);
  await expect(page.locator('[name="rig-bone"]')).toHaveValue("arm");
  await expect(page.locator('[data-selected-art="arm"]')).toBeVisible();
}
async function drag(
  page: any,
  selector: string,
  dx: number,
  dy: number,
  cancel = false
) {
  const handle = page.locator(selector);
  await expect(handle).toBeVisible();
  await handle.hover();
  const b = (await handle.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + dx, b.y + b.height / 2 + dy, {
    steps: 5
  });
  if (cancel) await page.keyboard.press("Escape");
  await page.mouse.up();
}
function matricesSame(a: any, b: any) {
  for (const id of Object.keys(a))
    for (let k = 0; k < 6; k++)
      expect(b[id].matrix[k]).toBeCloseTo(a[id].matrix[k], 6);
}
test("clicking art selects its joint; six handles edit without changing pixels, support undo, and Escape cancels", async ({
  page
}) => {
  await prepare(page);
  await clickArt(page);
  const original = await state(page);
  for (const kind of [
    "move",
    "rotate",
    "scale",
    "scale-x",
    "scale-y",
    "shear"
  ]) {
    const handle = page.locator(`[data-rig-transform="${kind}"]`);
    await expect(handle).toBeVisible();
    await handle.focus();
    await page.keyboard.press("ArrowRight");
    await expect
      .poll(async () => JSON.stringify((await state(page)).world.arm.matrix))
      .not.toBe(JSON.stringify(original.world.arm.matrix));
    expect((await state(page)).layers).toEqual(original.layers);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect
      .poll(async () => JSON.stringify((await state(page)).rig.workingPose))
      .toBe(JSON.stringify(original.rig.workingPose));
  }
  await drag(page, '[data-rig-transform="move"]', 28, 14, true);
  expect((await state(page)).rig.workingPose).toEqual(original.rig.workingPose);
  await drag(page, '[data-rig-transform="move"]', 28, 14);
  await expect
    .poll(async () => (await state(page)).world.arm.start.x)
    .not.toBe(original.world.arm.start.x);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect
    .poll(async () => (await state(page)).world.arm.start.x)
    .toBeCloseTo(original.world.arm.start.x, 6);
  matricesSame(original.world, (await state(page)).world);
  await page.screenshot({
    path: test.info().outputPath("animator-controls.png")
  });
});
test("disconnect preserves rotated current and saved poses; undo, redo and project round trip retain them", async ({
  page
}) => {
  await prepare(page, true);
  await page
    .getByRole("button", { name: "Select bone Arm", exact: true })
    .click();
  const before = await state(page);
  const renderedBefore = await renderedPoses(page);
  await page
    .getByRole("button", { name: "Disconnect selected joint", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await state(page)).rig.bones.find((b: any) => b.id === "arm").parent
    )
    .toBe(null);
  const after = await state(page);
  matricesSame(before.world, after.world);
  before.poses.forEach((w: any, i: number) => matricesSame(w, after.poses[i]));
  expect(after.layers).toEqual(before.layers);
  expect(await renderedPoses(page)).toEqual(renderedBefore);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await state(page)).rig.bones.find((b: any) => b.id === "arm").parent
    )
    .toBe("body");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await state(page)).rig.bones.find((b: any) => b.id === "arm").parent
    )
    .toBe(null);
  await page
    .getByRole("button", { name: "Close Puppet Studio", exact: true })
    .click();
  const file = await downloadPiskelFile(page);
  await importPiskelFile(page, file);
  matricesSame(after.world, (await state(page)).world);
});
test("drag-connect and connection-line disconnect preserve poses and reject cycles", async ({
  page
}) => {
  await prepare(page, true);
  await page
    .getByRole("button", { name: "Select bone Arm", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Disconnect selected joint", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Connect joints", exact: true })
    .click();
  const before = await state(page),
    a = await point(page, 4, 12),
    b = await point(page, 16, 8);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await expect(page.locator("[data-connection-preview]")).toBeVisible();
  await page.mouse.up();
  await expect
    .poll(
      async () =>
        (await state(page)).rig.bones.find((b: any) => b.id === "arm").parent
    )
    .toBe("body");
  const connected = await state(page);
  matricesSame(before.world, connected.world);
  before.poses.forEach((w: any, i: number) =>
    matricesSame(w, connected.poses[i])
  );
  await page
    .getByRole("button", { name: "Disconnect joints", exact: true })
    .click();
  const line = page.getByRole("button", {
    name: "Disconnect joint Arm",
    exact: true
  });
  await line.focus();
  await page.keyboard.press("Enter");
  await expect
    .poll(
      async () =>
        (await state(page)).rig.bones.find((b: any) => b.id === "arm").parent
    )
    .toBe(null);
  matricesSame(before.world, (await state(page)).world);
});
test("Setup and Pose expose relevant fields; parent dropdown preserves poses and prevents cycles", async ({
  page
}) => {
  await prepare(page, true);
  await page
    .getByRole("button", { name: "Select bone Arm", exact: true })
    .click();
  await expect(page.getByLabel("Pose rotation", { exact: true })).toBeVisible();
  await expect(page.locator('[name="rig-parent"]')).toBeHidden();
  await page.getByRole("tab", { name: "Setup rig", exact: true }).click();
  await expect(page.getByLabel("Pose rotation", { exact: true })).toBeHidden();
  const before = await state(page);
  await page.locator('[name="rig-parent"]').selectOption("");
  await expect
    .poll(
      async () =>
        (await state(page)).rig.bones.find((b: any) => b.id === "arm").parent
    )
    .toBe(null);
  matricesSame(before.world, (await state(page)).world);
  await page.locator('[name="rig-parent"]').selectOption("body");
  await page
    .getByRole("button", { name: "Select bone Body", exact: true })
    .click();
  await page.locator('[name="rig-parent"]').selectOption("arm");
  await expect(
    page.locator('[data-extra-tool="rig"] [role="status"]')
  ).toContainText("descendant");
  expect(
    (await state(page)).rig.bones.find((b: any) => b.id === "body").parent
  ).toBe(null);
});
test("Auto-key is opt-in, records one frame without changing other keys, and one undo restores the edit", async ({
  page
}) => {
  await prepare(page);
  await clickArt(page);
  const initial = await state(page);
  await page.locator('[data-rig-transform="rotate"]').focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(async () => (await state(page)).rig.workingPose.arm.rotation)
    .not.toBe(0);
  expect((await state(page)).rig.clips[0].keys).toEqual(
    initial.rig.clips[0].keys
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page
    .getByRole("button", { name: "Next pose frame", exact: true })
    .click();
  await page.getByLabel("Auto-key poses", { exact: true }).check();
  const before = await state(page);
  await page.locator('[data-rig-transform="rotate"]').focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(async () => (await state(page)).rig.clips[0].keys.length)
    .toBe(3);
  const after = await state(page),
    key = after.rig.clips[0].keys.find((k: any) => k.at === 1);
  expect(after.rig.poses.find((p: any) => p.id === key.pose).values).toEqual(
    after.rig.workingPose
  );
  expect(after.rig.poses.find((p: any) => p.id === "start")).toEqual(
    before.rig.poses.find((p: any) => p.id === "start")
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect
    .poll(async () => (await state(page)).rig.clips[0].keys.length)
    .toBe(2);
  matricesSame(before.world, (await state(page)).world);
});
test("focus, joint size and guide color are saved view preferences and do not affect generated frames", async ({
  page
}) => {
  await prepare(page);
  await clickArt(page);
  const display = page
    .locator('[name="rig-skeleton"]')
    .locator("..")
    .locator("..");
  await display.locator("summary").click();
  const before = await state(page),
    normal = await page
      .locator('[data-art-preview="after"]')
      .evaluate((c: any) => c.toDataURL());
  await page.getByLabel("Preview focus", { exact: true }).selectOption("solo");
  await expect
    .poll(async () =>
      page
        .locator('[data-art-preview="after"]')
        .evaluate((c: any) => c.toDataURL())
    )
    .not.toBe(normal);
  await page.getByLabel("Guide color", { exact: true }).fill("#ff7755");
  await page.getByLabel("Joint handle size", { exact: true }).fill("8");
  expect((await state(page)).rig).toEqual(before.rig);
  expect((await state(page)).layers).toEqual(before.layers);
  const expected = await page.evaluate(() => {
    const s = window.pskl,
      p = s.app.piskelController.getPiskel(),
      r = p.toolState.rigStudio,
      renderer = new s.utils.RigStudioRenderer(p, r);
    return Array.from({ length: 12 }, (_, i) =>
      renderer
        .scene(s.utils.RigStudioUtils.poseAt(r, r.clips[0], i), 0)
        .toDataURL()
    );
  });
  await page
    .getByRole("button", { name: "Generate Frames", exact: true })
    .click();
  await expect(
    page.locator('[data-extra-tool="rig"] [role="status"]')
  ).toContainText("baked");
  const output = await page.evaluate(() => {
    const s = window.pskl,
      p = s.app.piskelController.getPiskel();
    return Array.from({ length: 12 }, (_, i) =>
      s.utils.LayerUtils.flattenFrameAt(p.getLayers(), i, true).toDataURL()
    );
  });
  expect(output).toEqual(expected);
  await page
    .getByRole("button", { name: "Close Puppet Studio", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Puppet Studio", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start rigging", exact: true })
    .click();
  const saved = await page.evaluate(() =>
    window.pskl.UserSettings.get(window.pskl.UserSettings.PUPPET_STUDIO_VIEW)
  );
  expect(saved).toMatchObject({
    focus: "solo",
    jointSize: 8,
    color: "#ff7755"
  });
});

test("an unbound foreground can be selected and bound in Setup without changing the layer stack", async ({
  page
}) => {
  await prepare(page);
  const before = await state(page),
    p = await point(page, 6.5, 11.5);
  await page.mouse.click(p.x, p.y);
  await expect(page.locator(".puppet-art-selection")).toContainText(
    "Foreground · unbound"
  );
  await expect(page.locator("[data-rig-transform]")).toHaveCount(0);
  await page.getByRole("tab", { name: "Setup rig", exact: true }).click();
  await page
    .getByRole("button", { name: "Select bone Arm", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Bind selected art", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await state(page)).rig.bones.find((b: any) => b.id === "arm").layerId
    )
    .toBe("Foreground");
  expect((await state(page)).layers).toEqual(before.layers);
});

test("locked pivots reject Move while Rotate still works and preserves the pin", async ({
  page
}) => {
  await prepare(page);
  await clickArt(page);
  await page.getByRole("button", { name: "Lock joint", exact: true }).click();
  const locked = await state(page);
  await page.locator('[data-rig-transform="move"]').focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.locator('[data-extra-tool="rig"] [role="status"]')
  ).toContainText("locked");
  expect((await state(page)).world.arm.start).toEqual(locked.world.arm.start);
  await page.locator('[data-rig-transform="rotate"]').focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(async () => (await state(page)).world.arm.end.x)
    .not.toBe(locked.world.arm.end.x);
  expect((await state(page)).world.arm.start).toEqual(locked.world.arm.start);
});

test("Auto-key numeric edits clone a shared key pose and undo restores both markers", async ({
  page
}) => {
  await prepare(page);
  await page
    .getByRole("button", { name: "Close Puppet Studio", exact: true })
    .click();
  await page.evaluate(() => {
    const rig =
      window.pskl.app.piskelController.getPiskel().toolState.rigStudio;
    rig.clips[0].keys.splice(1, 0, {
      at: 3,
      pose: "start",
      easing: "linear",
      type: "key"
    });
  });
  await page
    .getByRole("button", { name: "Puppet Studio", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start rigging", exact: true })
    .click();
  await page.getByRole("tab", { name: "Pose / animate", exact: true }).click();
  await page
    .getByRole("button", { name: "Select bone Arm", exact: true })
    .click();
  await page.getByLabel("Auto-key poses", { exact: true }).check();
  const before = await state(page);
  await page.getByLabel("Pose rotation", { exact: true }).fill("17");
  await page.getByLabel("Pose rotation", { exact: true }).press("Tab");
  await expect
    .poll(
      async () =>
        (await state(page)).rig.clips[0].keys.find((k: any) => k.at === 0).pose
    )
    .not.toBe("start");
  const after = await state(page);
  expect(after.rig.clips[0].keys.find((k: any) => k.at === 3).pose).toBe(
    "start"
  );
  expect(after.rig.poses.find((p: any) => p.id === "start")).toEqual(
    before.rig.poses.find((p: any) => p.id === "start")
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await state(page)).rig.clips[0].keys.find((k: any) => k.at === 0).pose
    )
    .toBe("start");
});

test("Auto-key refuses inserting into a protected motion path without partially changing the rig", async ({
  page
}) => {
  await prepare(page);
  await page
    .getByRole("button", { name: "Close Puppet Studio", exact: true })
    .click();
  await page.evaluate(() => {
    const s = window.pskl,
      rig = s.app.piskelController.getPiskel().toolState.rigStudio,
      clip = rig.clips[0];
    rig.poses[1].values = { body: { rotation: 35 } };
    const path = s.utils.JointMotionPathUtils.create(
      rig,
      clip,
      "arm",
      "end",
      0,
      11
    );
    s.utils.JointMotionPathUtils.put(clip, path);
    s.utils.RigStudioUtils.validate(rig);
  });
  await page
    .getByRole("button", { name: "Puppet Studio", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start rigging", exact: true })
    .click();
  await page.getByRole("tab", { name: "Pose / animate", exact: true }).click();
  await page
    .getByRole("button", { name: "Select bone Arm", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Transform part", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Next pose frame", exact: true })
    .click();
  await page.getByLabel("Auto-key poses", { exact: true }).check();
  const before = await state(page);
  await page.locator('[data-rig-transform="rotate"]').focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.locator('[data-extra-tool="rig"] [role="status"]')
  ).toContainText("path");
  expect((await state(page)).rig).toEqual(before.rig);
});

test("animator controls remain reachable in a smaller window and the bottom layout remains intact", async ({
  page
}) => {
  await prepare(page);
  await page.setViewportSize({ width: 1000, height: 720 });
  await clickArt(page);
  await expect(
    page.getByRole("tab", { name: "Setup rig", exact: true })
  ).toBeVisible();
  await expect(
    page.getByLabel("Auto-key poses", { exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Generate Frames", exact: true })
  ).toBeInViewport();
  const positions = await page.evaluate(() => {
    const wrap = document
        .querySelector(".puppet-dialog")!
        .getBoundingClientRect(),
      stage = document
        .querySelector(".puppet-dialog .extra-preview-stage")!
        .getBoundingClientRect(),
      side = document.querySelector(".puppet-side")!.getBoundingClientRect();
    return {
      wrap: { left: wrap.left, right: wrap.right, bottom: wrap.bottom },
      stage: { height: stage.height, right: stage.right },
      side: { left: side.left }
    };
  });
  expect(positions.wrap.right).toBeLessThanOrEqual(1000);
  expect(positions.wrap.bottom).toBeLessThanOrEqual(720);
  expect(positions.stage.height).toBeGreaterThan(100);
  expect(positions.stage.right).toBeLessThanOrEqual(positions.side.left);
  await page.screenshot({
    path: test.info().outputPath("animator-small-window.png")
  });
  await page
    .getByRole("button", { name: "Close Puppet Studio", exact: true })
    .click();
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const c = document
            .querySelector("#drawing-canvas-container")!
            .getBoundingClientRect(),
          f = document.querySelector(".frames-column")!.getBoundingClientRect();
        return f.top - c.bottom;
      })
    )
    .toBeGreaterThanOrEqual(-2);
  const layout = await page.evaluate(() => {
    const c = document
        .querySelector("#drawing-canvas-container")!
        .getBoundingClientRect(),
      f = document.querySelector(".frames-column")!.getBoundingClientRect(),
      l = document.querySelector(".layers-column")!.getBoundingClientRect();
    return {
      canvas: c.bottom,
      frames: f.top,
      frameBottom: f.bottom,
      layers: l.top
    };
  });
  expect(layout.frames).toBeGreaterThanOrEqual(layout.canvas - 2);
  expect(layout.layers).toBeGreaterThanOrEqual(layout.frameBottom - 2);
});

test("removing an ordinary parent keeps its surviving branch in its current and saved poses", async ({
  page
}) => {
  await prepare(page, true);
  await page
    .getByRole("button", { name: "Select bone Body", exact: true })
    .click();
  const before = await state(page);
  await page.getByRole("button", { name: "− Joint", exact: true }).click();
  await expect.poll(async () => (await state(page)).rig.bones.length).toBe(1);
  const after = await state(page);
  for (let k = 0; k < 6; k++) {
    expect(after.world.arm.matrix[k]).toBeCloseTo(
      before.world.arm.matrix[k],
      6
    );
    before.poses.forEach((w: any, i: number) =>
      expect(after.poses[i].arm.matrix[k]).toBeCloseTo(w.arm.matrix[k], 6)
    );
  }
  expect(after.layers).toEqual(before.layers);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(async () => (await state(page)).rig.bones.length).toBe(2);
});

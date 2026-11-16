import { test, expect, Page } from '@playwright/test';

const key = 'student-pixel.workspace.v1';
const handle = (page: Page, name: string) => page.getByRole('button', { name: `Move ${name} panel`, exact: true });
const panel = (page: Page, id: string) => page.locator(`[data-workspace-panel="${id}"]`);
async function open(page: Page, baseURL: string | undefined) {
  await page.goto(baseURL!);
  await expect(page.locator('.workspace-enabled')).toBeVisible();
  await expect(page.locator('#loading-mask')).toBeHidden();
}
async function dock(page: Page, name: string, side: string) {
  await handle(page, name).click();
  await page.getByRole('dialog', { name: `${name} placement`, exact: true }).getByRole('button', { name: `Dock ${side}`, exact: true }).click();
}
async function state(page: Page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
}
async function startDrag(page: Page, name: string) {
  const source = handle(page, name);
  await source.scrollIntoViewIfNeeded();
  const rect = (await source.boundingBox())!;
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width / 2 + 8, rect.y + rect.height / 2, { steps: 3 });
  await expect(page.locator('.workspace-drop-overlay')).toBeVisible();
  return rect.x + rect.width / 2;
}
async function drop(page: Page, zone: string, position = 0.5, x?: number) {
  const rect = (await page.locator(`[data-drop-zone="${zone}"]`).boundingBox())!;
  await page.mouse.move(x ?? rect.x + rect.width / 2, rect.y + Math.max(3, rect.height * position), { steps: 12 });
  await page.mouse.up();
  await expect(page.locator('.workspace-drop-overlay')).toHaveCount(0);
}
async function side(page: Page, id: string) {
  return panel(page, id).evaluate(node => node.closest('[data-dock]')!.getAttribute('data-dock'));
}

test('drag and reorder side panels, retain artwork, and remember the layout', async ({ page, baseURL }) => {
  await open(page, baseURL);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  const before = await page.evaluate(() => {
    const s = window.pskl, c = s.app.piskelController;
    c.getCurrentFrame().setPixel(3, 5, 0xff123456);
    return s.utils.serialization.Serializer.serialize(c.getPiskel());
  });
  await startDrag(page, 'Palettes');
  await drop(page, 'left');
  expect(await side(page, 'palettes')).toBe('left');
  await startDrag(page, 'Transform');
  await drop(page, 'left', 0.01);
  expect((await state(page)).left).toEqual(['transform', 'palettes']);
  await handle(page, 'Palettes').focus();
  await page.keyboard.press('ArrowUp');
  expect((await state(page)).left).toEqual(['palettes', 'transform']);
  expect(await side(page, 'preview')).toBe('right');
  expect(await page.evaluate(() => window.pskl.utils.serialization.Serializer.serialize(window.pskl.app.piskelController.getPiskel()))).toBe(before);
  await page.reload();
  await expect(handle(page, 'Palettes')).toBeVisible();
  expect(await side(page, 'palettes')).toBe('left');
  const p = (await panel(page, 'palettes').boundingBox())!, t = (await panel(page, 'transform').boundingBox())!;
  expect(p.y + p.height).toBeLessThanOrEqual(t.y + 1);
  expect(errors).toEqual([]);
});

test('drag frames and layers above the canvas, reorder, then restore the default', async ({ page, baseURL }) => {
  await open(page, baseURL);
  const x = await startDrag(page, 'Frames');
  await drop(page, 'top', 0.05, x); // A straight vertical drag from under Tools.
  expect(await side(page, 'frames')).toBe('top');
  await startDrag(page, 'Layers');
  await drop(page, 'top', 0.99);
  expect((await state(page)).top).toEqual(['frames', 'layers']);
  await handle(page, 'Layers').focus();
  await page.keyboard.press('ArrowUp');
  expect((await state(page)).top).toEqual(['layers', 'frames']);
  const canvas = (await page.locator('#drawing-canvas-container').boundingBox())!, frames = (await panel(page, 'frames').boundingBox())!;
  expect(frames.y + frames.height).toBeLessThanOrEqual(canvas.y + 1);
  await handle(page, 'Layers').click();
  await page.getByRole('button', { name: 'Reset layout', exact: true }).click();
  expect((await state(page)).bottom).toEqual(['frames', 'layers']);
  const restored = (await panel(page, 'frames').boundingBox())!;

  const tools = (await panel(page, 'tools').boundingBox())!;
  expect(restored.x).toBeCloseTo(tools.x + tools.width, 0);
  expect(tools.y + tools.height).toBe(795);
});

test('move preview and toolbar, draw, and keep preview pinned during effects editing', async ({ page, baseURL }) => {
  await open(page, baseURL);
  await startDrag(page, 'Preview');
  await drop(page, 'left', 0.1);
  await startDrag(page, 'Tools');
  await drop(page, 'right', 0.5);
  expect((await state(page)).preview).toBe('left');
  expect((await state(page)).tools).toBe('right');
  await page.getByRole('button', { name: 'Add layer', exact: true }).click();
  await expect(page.locator('.layer-item')).toHaveCount(2);
  await page.locator('[data-tool-id="tool-pen"]').click();
  const canvas = page.locator('#drawing-canvas-container .drawing-canvas');
  await expect(canvas).toBeVisible();
  await canvas.click({ position: { x: 30, y: 30 }, force: true });
  expect(await page.evaluate(() => Array.from(window.pskl.app.piskelController.getCurrentFrame().getPixels()).some(value => value !== window.Constants.TRANSPARENT_COLOR))).toBe(true);
  await page.locator('.layer-item').first().getByRole('button', { name: /effects/i }).click();
  await expect(page.locator('#layer-options')).toBeVisible();
  await dock(page, 'Layer options', 'left');
  expect(await side(page, 'options')).toBe('left');
  const before = (await panel(page, 'preview').boundingBox())!;
  await page.locator('[data-dock="left"] .right-panels-scroller').evaluate(node => { node.scrollTop = node.scrollHeight; });
  const after = (await panel(page, 'preview').boundingBox())!;
  expect(after.y).toBe(before.y);
  await page.getByRole('tab', { name: 'Normal preview', exact: true }).click();
  await page.getByRole('tab', { name: 'FX preview', exact: true }).click();
  const tabs = (await page.locator('.layer-preview-tabs').boundingBox())!, preview = (await page.locator('#animated-preview-container').boundingBox())!;
  expect(tabs.x).toBeCloseTo(preview.x + preview.width + 2, 0);
  await expect(page.locator('.layer-result-preview canvas')).toBeVisible();
  await page.locator('.layer-result-actions .layer-cancel').click();
});

test('Escape and invalid drops leave saved placement unchanged', async ({ page, baseURL }) => {
  await open(page, baseURL);
  await dock(page, 'Transform', 'left');
  const before = await state(page);
  await startDrag(page, 'Palettes');
  const left = (await page.locator('[data-drop-zone="left"]').boundingBox())!;
  await page.mouse.move(left.x + 50, left.y + 100);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(page.locator('.workspace-drop-overlay')).toHaveCount(0);
  expect(await state(page)).toEqual(before);
  await startDrag(page, 'Palettes');
  await page.mouse.move(600, 25);
  await page.mouse.up();
  expect(await state(page)).toEqual(before);
  await expect(page.locator('.workspace-placement-menu')).toHaveCount(0);
});

test('narrow windows share one side column and restore both sides when widened', async ({ page, baseURL }) => {
  await open(page, baseURL);
  await dock(page, 'Transform', 'left');
  await page.setViewportSize({ width: 900, height: 650 });
  await expect.poll(() => side(page, 'transform')).toBe('right');
  expect((await state(page)).left).toEqual(['transform']);
  expect((await page.locator('#drawing-canvas-container').boundingBox())!.width).toBeGreaterThan(500);
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect.poll(() => side(page, 'transform')).toBe('left');
  await expect(handle(page, 'Transform')).toBeVisible();
});

test('damaged preferences and blocked storage leave the editor usable', async ({ page, baseURL }) => {
  await page.addInitScript(key => {
    localStorage.setItem(key, '{broken');
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException('Storage disabled', 'SecurityError');
      return original.call(this, name, value);
    };
  }, key);
  await open(page, baseURL);
  expect(await side(page, 'frames')).toBe('bottom');
  await dock(page, 'Palettes', 'left');
  expect(await side(page, 'palettes')).toBe('left');
  await expect(page.getByRole('status').filter({ hasText: 'Browser storage is unavailable' })).toContainText('lasts for this visit');
  await page.getByRole('button', { name: 'Add layer', exact: true }).click();
  await expect(page.locator('.layer-item')).toHaveCount(2);
});

import { test, expect, Page } from '@playwright/test';
import { openEditor } from './editor-helpers';
async function drag(page: Page, key: string, dx: number, dy: number) {
  const grip = page.locator(`[data-workspace-resize="${key}"]`);
  await expect(grip).toBeVisible();
  const b = (await grip.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + dx, b.y + b.height / 2 + dy, { steps: 8 });
  await page.mouse.up();
}
const height = (page: Page, selector: string) => page.locator(selector).evaluate(n => n.getBoundingClientRect().height);
async function move(page: Page, name: string, side: string) {
  await page.getByRole('button', { name: `Move ${name} panel`, exact: true }).click();
  await page.getByRole('button', { name: `Dock ${side}`, exact: true }).click();
}
test('every panel resizes, layer height grows without growing frames, and sizes survive reload', async ({page}) => {
  await page.setViewportSize({width:1440,height:1000});
  await openEditor(page);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await expect(page.locator('.workspace-resize')).toHaveCount(9);
  const layers = await height(page,'.layers-column'), frames = await height(page,'.frames-column');
  await drag(page,'layerHeight',0,-60);
  expect(await height(page,'.layers-column')).toBe(layers+60);
  expect(await height(page,'.frames-column')).toBe(frames);
  await drag(page,'frameHeight',0,-20);
  expect(await height(page,'.frames-column')).toBe(frames+20);
  for(const [key,selector] of [['previewHeight','.canvas-container-wrapper'],['transformHeight','.transformations-container'],['paletteHeight','.palettes-list-container']]) {
    const before = await height(page,selector);
    await drag(page,key,0,20);
    expect(await height(page,selector)).toBe(before+20);
  }
  const tools = (await page.locator('#tool-section').boundingBox())!.width;
  await drag(page,'toolsWidth',20,0);
  expect((await page.locator('#tool-section').boundingBox())!.width).toBe(tools+20);
  const side = (await page.locator('.workspace-preview-panel').boundingBox())!.width;
  await drag(page,'sideWidth',-20,0);
  expect((await page.locator('.workspace-preview-panel').boundingBox())!.width).toBe(side+20);
  const width = (await page.locator('.layers-column').boundingBox())!.width;
  await drag(page,'layerWidth',-40,0);
  expect((await page.locator('.layers-column').boundingBox())!.width).toBe(width-40);
  await page.locator('.layer-fx').first().click();
  await page.locator('[data-dock="right"] .right-panels-scroller').evaluate(n => n.scrollTop=n.scrollHeight);
  const fx = await height(page,'#layer-options');
  await drag(page,'fxHeight',0,30);
  expect(await height(page,'#layer-options')).toBe(fx+30);
  const saved = await page.evaluate(()=>window.pskl.UserSettings.get(window.pskl.UserSettings.WORKSPACE_LAYOUT));
  await page.reload();
  await expect(page.locator('.workspace-sized')).toBeVisible();
  expect(await height(page,'.layers-column')).toBe(layers+60);
  expect(await height(page,'.frames-column')).toBe(frames+20);
  expect(await page.evaluate(()=>window.pskl.UserSettings.get(window.pskl.UserSettings.WORKSPACE_LAYOUT))).toEqual(saved);
  expect(errors).toEqual([]);
});
test('resize handles follow panels moved to the other side or above the canvas', async ({page}) => {
  await page.setViewportSize({width:1440,height:1000});
  await openEditor(page);
  await move(page,'Preview','left');
  await move(page,'Tools','right');
  await move(page,'Layers','top');
  const before = await height(page,'.layers-column');
  await drag(page,'layerHeight',0,30);
  expect(await height(page,'.layers-column')).toBe(before+30);
  const width = (await page.locator('.workspace-preview-panel').boundingBox())!.width;
  await drag(page,'sideWidth',20,0);
  expect((await page.locator('.workspace-preview-panel').boundingBox())!.width).toBe(width+20);
  const tools = (await page.locator('#tool-section').boundingBox())!.width;
  await drag(page,'toolsWidth',-20,0);
  expect((await page.locator('#tool-section').boundingBox())!.width).toBe(tools+20);
  await page.reload();
  await expect(page.locator('[data-dock="top"] .layers-column')).toBeVisible();
  expect(await height(page,'.layers-column')).toBe(before+30);
});

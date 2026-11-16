import { expect, Page } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
declare global { interface Window { pskl: any; } }
export async function openEditor(page: Page) {
  await page.goto('./');
  await expect(page.locator('.workspace-sized')).toBeVisible();
  await expect(page.locator('#loading-mask')).toBeHidden();
  await expect(page.locator('#drawing-canvas-container .drawing-canvas')).toBeVisible();
}
export const openEditorWithSettledCanvas = openEditor;
const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
export const undo = (page: Page) => page.keyboard.press(modifier + '+z');
export const redo = (page: Page) => page.keyboard.press(modifier + '+y');
export const clickTool = (page: Page, id: string) => page.locator(`[data-tool-id="${id}"]`).click();
export async function importPiskelFile(page: Page, file: string) {
  await page.locator('[data-setting="import"]').click();
  const choosing = page.waitForEvent('filechooser');
  await page.locator('[data-test-id="import-piskel-button"]').click();
  await (await choosing).setFiles(file);
  await expect(page.locator('.current-step .import-mode')).toBeAttached();
  page.once('dialog', d => d.accept());
  await page.locator('.import-mode-replace-button').click();
  await expect(page.locator('#dialog-container-wrapper')).not.toHaveClass(/\bshow\b/);
}
export async function downloadPiskelFile(page: Page) {
  await page.locator('[data-setting="save"]').click();
  const downloading = page.waitForEvent('download');
  await page.locator('[data-test-id="save-file-download-button"]').click();
  const downloaded = await downloading;
  const target = path.join(path.dirname((await downloaded.path())!), 'sprite.piskel');
  await fs.copyFile((await downloaded.path())!, target);
  await expect(page.locator('[data-pskl-controller="settings"]')).not.toHaveClass(/\bexpanded\b/);
  return target;
}
async function color(page: Page, kind: string, value: string) {
  await page.evaluate(() => document.querySelectorAll('.tooltip').forEach(e => e.remove()));
  const selector = `[data-test-id="${kind}-color-picker"]`;
  await page.locator(selector).locator('..').locator('.sp-replacer').click();
  const input = page.locator('.sp-container:not(.sp-hidden) .sp-input');
  await input.fill(value);
  await input.press('Enter');
  await page.evaluate(selector => {
    (window as any).$(selector).spectrum('hide');
    (document.activeElement as HTMLElement)?.blur();
  }, selector);
}
export const setPrimaryColor = (page: Page, value: string) => color(page, 'primary', value);
export const setSecondaryColor = (page: Page, value: string) => color(page, 'secondary', value);

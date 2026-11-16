import test, { expect } from "@playwright/test";
import { openEditor, clickTool, setPrimaryColor, setSecondaryColor } from "./editor-helpers";

test("all 273 picker entries paint the same pixels as their preview at every scale", async ({
  page
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openEditor(page);
  await clickTool(page, "tool-dithering");
  await setPrimaryColor(page, "#ff0000");
  await setSecondaryColor(page, "#0000ff");
  await expect(page.locator("[data-dither-pattern]")).toHaveCount(273);
  await expect(page.locator('[data-tool-id="tool-dithering"]')).toHaveCount(1);
  const failures = await page.evaluate(async () => {
    const P = window.pskl.utils.DitherPatterns,
      app = window.pskl.app,
      tool = app.toolController.currentSelectedTool;
    const failures: string[] = [];
    const red = window.pskl.utils.colorToInt("#ff0000"),
      blue = window.pskl.utils.colorToInt("#0000ff");
    app.mouseStateService.lastButtonPressed_ = 0;
    const choices = [
      ...document.querySelectorAll<HTMLButtonElement>("[data-dither-pattern]")
    ];
    for (let i = 0; i < choices.length; i++) {
      const button = choices[i],
        id = button.dataset.ditherPattern!;
      button.click();
      for (const scale of ["1", "2", "4"]) {
        const select = document.querySelector<HTMLSelectElement>(
          '[data-dither-setting="scale"]'
        )!;
        select.value = scale;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        const settings = window.pskl.UserSettings.get(
          window.pskl.UserSettings.DITHER_SETTINGS
        );
        if (settings.pattern !== id)
          failures.push(id + ": selection did not reach brush");
        const frame = new window.pskl.model.Frame(32, 32),
          overlay = new window.pskl.model.Frame(32, 32),
          bits = P.createMask(32, 32, settings);
        tool.pixels = [];
        for (let y = 0; y < 32; y++)
          for (let x = 0; x < 32; x++)
            tool.applyToolAt(x, y, frame, overlay, {});
        tool.setPixelsToFrame_(frame, tool.pixels);
        tool.resetUsedPixels_();
        const pixels = frame.pixels;
        if (
          Array.from(bits).some(
            (bit: any, index) => pixels[index] !== (bit ? red : blue)
          )
        )
          failures.push(id + ": painted pixels differ at " + scale);
        const preview = button
          .querySelector("canvas")!
          .getContext("2d")!
          .getImageData(0, 0, 16, 8).data;
        for (let y = 0; y < 8; y++)
          for (let x = 0; x < 16; x++) {
            const index = (y * 16 + x) * 4,
              primary = bits[y * 32 + x] === 1;
            if (
              preview[index] !== (primary ? 255 : 0) ||
              preview[index + 2] !== (primary ? 0 : 255) ||
              preview[index + 3] !== 255
            )
              failures.push(id + ": thumbnail mismatch at " + scale);
          }
      }
      if (i % 10 === 0) await new Promise(requestAnimationFrame);
    }
    app.mouseStateService.lastButtonPressed_ = null;
    return failures;
  });
  expect(failures).toEqual([]);
  expect(errors).toEqual([]);
});

test("pattern picker scrolls, closes on selection, supports keys, and saves preferences", async ({
  page
}) => {
  await openEditor(page);
  await clickTool(page, "tool-dithering");
  const trigger = page.locator(".dither-pattern-trigger"),
    menu = page.locator(".dither-pattern-menu");
  await trigger.click();
  await expect(menu).toBeVisible();
  const before = await menu.evaluate((e) => e.scrollTop);
  await menu.hover();
  await page.mouse.wheel(0, 400);
  await expect
    .poll(() => menu.evaluate((e) => e.scrollTop))
    .toBeGreaterThan(before);
  await expect(menu).toBeVisible();
  await page.locator('[data-dither-pattern="tone-dots-25"]').click();
  await expect(menu).toBeHidden();
  await expect(trigger).toHaveAttribute(
    "aria-label",
    "Pattern: Dot density 25%"
  );
  await trigger.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(trigger).toHaveAttribute(
    "aria-label",
    "Pattern: Dot density 37.5%"
  );
  await page.locator('[data-dither-setting="scale"]').selectOption("2");
  await page.reload();
  await clickTool(page, "tool-dithering");
  await expect(trigger).toHaveAttribute(
    "aria-label",
    "Pattern: Dot density 37.5%"
  );
  await expect(page.locator('[data-dither-setting="scale"]')).toHaveValue("2");
  const header = (await page
      .locator('[data-test-id="app-header"]')
      .boundingBox())!,
    field = (await trigger.boundingBox())!;
  expect(header.height).toBe(40);
  expect(field.y + field.height).toBeLessThanOrEqual(header.y + header.height);
  await clickTool(page, "tool-pen");
  await expect(page.locator("#dither-options")).toBeHidden();
});

test("top density overrides a fixed pattern, paints the live sample, persists and returns to pattern mode", async ({page}) => {
  await openEditor(page);
  await clickTool(page,"tool-dithering");
  await setPrimaryColor(page,"#ff0000");
  await setSecondaryColor(page,"#0000ff");
  await page.locator('.dither-pattern-trigger').click();
  await page.locator('[data-dither-pattern="ref80"]').click();
  const slider=page.getByRole('slider',{name:'Dither density',exact:true});
  await slider.focus();
  await slider.press('Home');
  for(let i=0;i<25;i++)await slider.press('ArrowRight');
  await expect(page.locator('.dither-density-value')).toHaveText('25%');
  await expect(page.getByRole('button',{name:'Use adjustable dither density',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.dither-pattern-trigger')).toHaveAttribute('aria-label','Density: 25%');
  await expect(page.locator('[data-dither-pattern][aria-pressed="true"]')).toHaveCount(0);
  const painted=await page.evaluate(()=>{
    const s=window.pskl, app=s.app, P=s.utils.DitherPatterns, tool=app.toolController.currentSelectedTool,
      settings=s.UserSettings.get(s.UserSettings.DITHER_SETTINGS), f=new s.model.Frame(16,8),overlay=new s.model.Frame(16,8),bits=P.createMask(16,8,settings),
      pixels=(document.querySelector('.dither-pattern-trigger canvas') as HTMLCanvasElement).getContext('2d')!.getImageData(0,0,16,8).data;
    app.mouseStateService.lastButtonPressed_=0;
    tool.pixels=[];
    for(let y=0;y<8;y++)for(let x=0;x<16;x++)tool.applyToolAt(x,y,f,overlay,{});
    tool.setPixelsToFrame_(f,tool.pixels);tool.resetUsedPixels_();app.mouseStateService.lastButtonPressed_=null;
    return {primary:Array.from(bits).filter(Boolean).length, mismatch:Array.from(bits).some((bit:any,i)=>f.pixels[i]!==s.utils.colorToInt(bit?'#ff0000':'#0000ff')||pixels[i*4]!== (bit?255:0)||pixels[i*4+2]!== (bit?0:255))};
  });
  expect(painted).toEqual({primary:32,mismatch:false});
  await page.reload();
  await clickTool(page,'tool-dithering');
  await expect(slider).toHaveValue('25');
  await expect(page.locator('.dither-pattern-trigger')).toHaveAttribute('aria-label','Density: 25%');
  await page.locator('.dither-pattern-trigger').click();
  await page.locator('[data-dither-pattern="ref80"]').click();
  await expect(page.locator('.dither-pattern-trigger')).toHaveAttribute('aria-label','Pattern: Pattern 80');
  await expect(page.getByRole('button',{name:'Use adjustable dither density',exact:true})).toHaveAttribute('aria-pressed','false');
  await page.getByRole('button',{name:'Use adjustable dither density',exact:true}).click();
  await expect(slider).toHaveValue('25');
  await slider.press('End');
  await expect(page.locator('.dither-density-value')).toHaveText('100%');
});

test("compact density controls fit a narrow window and remain available beside the existing dither tool", async ({page}) => {
  await page.setViewportSize({width:600,height:760});
  await openEditor(page);
  await clickTool(page,'tool-dithering');
  await page.locator('.dither-compact').click();
  const slider=page.getByRole('slider',{name:'Dither density',exact:true});
  await expect(slider).toBeVisible();
  const bounds=(await page.locator('.dither-controls').boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x+bounds.width).toBeLessThanOrEqual(600);
  await slider.press('Home');
  await expect(page.locator('.dither-density-value')).toHaveText('0%');
  await expect(page.locator('[data-tool-id="tool-dithering"]')).toHaveCount(1);
  await clickTool(page,'tool-pen');
  await expect(page.locator('#dither-options')).toBeHidden();
});


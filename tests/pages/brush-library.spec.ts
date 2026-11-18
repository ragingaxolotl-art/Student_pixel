import {test,expect} from '@playwright/test';
import {openEditor,clickTool} from './editor-helpers';
test('brush library selects, paints, persists and closes on Escape',async({page})=>{
 await openEditor(page);await clickTool(page,'tool-pen');
 await page.getByRole('button',{name:'Brush library',exact:true}).click();
 await expect(page.locator('[data-brush-tip]')).toHaveCount(36);
 await page.getByRole('button',{name:'Diamond brush',exact:true}).click();
 await expect(page.locator('.brush-tip-name')).toHaveText('Diamond');
 const counts=await page.evaluate(()=>{const s=window.pskl; s.app.penSizeService.setPenSize(7);const tool=s.app.toolController.currentSelectedTool;const f=new s.model.Frame(16,16),o=new s.model.Frame(16,16);tool.drawUsingPenSize('#ff0000',8,8,f,o);const diamond=tool.pixels.length;tool.resetUsedPixels_();s.UserSettings.set(s.UserSettings.BRUSH_TIP,'square');tool.drawUsingPenSize('#ff0000',8,8,f,o);const square=tool.pixels.length;tool.resetUsedPixels_();s.UserSettings.set(s.UserSettings.BRUSH_TIP,'diamond');return {diamond,square};});
 expect(counts.square).toBe(49);expect(counts.diamond).toBe(25);
 await page.reload();await clickTool(page,'tool-pen');await expect(page.locator('.brush-tip-name')).toHaveText('Diamond');
 await page.getByRole('button',{name:'Brush library',exact:true}).click();await page.keyboard.press('Escape');await expect(page.locator('#brush-library-menu')).toBeHidden();
});
test('brush library fits a narrow screen',async({page})=>{
 await page.setViewportSize({width:320,height:800});await openEditor(page);await clickTool(page,'tool-pen');await page.locator('.brush-compact').click();await page.getByRole('button',{name:'Brush library',exact:true}).click();const box=(await page.locator('#brush-library-menu').boundingBox())!;expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(320);await page.getByRole('button',{name:'Round brush',exact:true}).click();await expect(page.locator('.brush-tip-name')).toHaveText('Round');
});

test('every tip paints at every size, matches the cursor and stays within its footprint',async({page})=>{
 await openEditor(page);await clickTool(page,'tool-pen');
 const failures=await page.evaluate(()=>{
  const s=window.pskl,tool=s.app.toolController.currentSelectedTool,failures:string[]=[];
  const tips=Array.from(document.querySelectorAll<HTMLElement>('[data-brush-tip]')).map(e=>e.dataset.brushTip!);
  for(const tip of tips)for(let size=1;size<=32;size++){
   s.UserSettings.set(s.UserSettings.BRUSH_TIP,tip);s.app.penSizeService.setPenSize(size);
   const frame=new s.model.Frame(64,64),overlay=new s.model.Frame(64,64),cursor=new s.model.Frame(64,64);
   tool.resetUsedPixels_();tool.drawUsingPenSize('#ff0000',32,32,frame,overlay);
   tool.highlightedPixelCol=null;tool.highlightedPixelRow=null;tool.updateHighlightedPixel(frame,cursor,32,32);
   const painted=Array.from(overlay.pixels).map((p,i)=>p?i:-1).filter(i=>i>=0),highlighted=Array.from(cursor.pixels).map((p,i)=>p?i:-1).filter(i=>i>=0);
   if(!painted.length)failures.push(`${tip}/${size}: empty`);
   if(JSON.stringify(painted)!==JSON.stringify(highlighted))failures.push(`${tip}/${size}: cursor differs`);
   for(const point of tool.pixels)if(Math.abs(point.col-32)>Math.ceil(size/2)||Math.abs(point.row-32)>Math.ceil(size/2))failures.push(`${tip}/${size}: out of bounds`);
  }
  tool.resetUsedPixels_();return failures;
 });expect(failures).toEqual([]);
});

test('search filters tips, reports no matches, and can recall the selected brush',async({page})=>{
 await openEditor(page);await clickTool(page,'tool-pen');await page.getByRole('button',{name:'Brush library',exact:true}).click();
 const search=page.getByRole('searchbox',{name:'Search brushes'});await expect(search).toBeFocused();await search.fill('leaf');await expect(page.locator('[data-brush-tip]:visible')).toHaveCount(2);
 await search.fill('not a brush');await expect(page.getByRole('status').filter({hasText:'No brushes'})).toBeVisible();await search.fill('heart');await page.getByRole('button',{name:'Heart brush',exact:true}).click();await expect(page.locator('.brush-tip-name')).toHaveText('Heart');
 await page.getByRole('button',{name:'Brush library',exact:true}).click();await search.fill('');await expect(page.locator('[data-brush-tip]:visible')).toHaveCount(36);await expect(page.getByRole('button',{name:'Heart brush',exact:true})).toHaveAttribute('aria-pressed','true');
});

test('a real brush stroke supports undo, redo, opacity and erasing',async({page})=>{
 await openEditor(page);await clickTool(page,'tool-pen');
 await page.getByRole('button',{name:'Brush library',exact:true}).click();await page.getByRole('button',{name:'Star brush',exact:true}).click();
 await page.getByLabel('Brush size (pixels)',{exact:true}).fill('13');await page.getByLabel('Brush opacity',{exact:true}).fill('50');
 const point=await page.evaluate(()=>window.pskl.app.drawingController.getScreenCoordinates(16,16));
 await page.mouse.click(point.x,point.y);await page.mouse.move(0,100);
 const read=()=>page.evaluate(()=>Array.from(window.pskl.app.piskelController.getCurrentFrame().pixels) as number[]);
 const painted=await read();expect(painted.some(p=>p!==0)).toBe(true);expect(painted.filter(p=>p!==0).every(p=>(p>>>24)===128)).toBe(true);
 await page.keyboard.press(process.platform==='darwin'?'Meta+z':'Control+z');await expect.poll(async()=>(await read()).every(p=>p===0)).toBe(true);
 await page.keyboard.press(process.platform==='darwin'?'Meta+y':'Control+y');await expect.poll(read).toEqual(painted);
 await clickTool(page,'tool-eraser');await page.mouse.click(point.x,point.y);await page.mouse.move(0,100);await expect.poll(async()=>(await read()).every(p=>p===0)).toBe(true);
});


test('repeating patterns stay in the dither library',async({page})=>{
 await openEditor(page);await clickTool(page,'tool-pen');await page.getByRole('button',{name:'Brush library',exact:true}).click();
 const names=await page.locator('[data-brush-tip]').allTextContents();
 expect(names.some(name=>/checker|dots|grain|stripes|weave|brick/i.test(name))).toBe(false);
 await page.getByRole('searchbox',{name:'Search brushes'}).fill('calligraphy');await expect(page.locator('[data-brush-tip]:visible')).toHaveCount(2);
});


test('brush tips do not change the footprint of dither or lighten tools',async({page})=>{
 await openEditor(page);await clickTool(page,'tool-pen');await page.getByRole('button',{name:'Brush library',exact:true}).click();await page.getByRole('button',{name:'Round brush',exact:true}).click();await page.getByLabel('Brush size (pixels)',{exact:true}).fill('7');
 for(const id of ['tool-dithering','tool-lighten']){
  await clickTool(page,id);await expect(page.locator('.brush-library-group')).toBeHidden();expect(await page.evaluate(()=>window.pskl.app.toolController.currentSelectedTool.getBrushPoints(16,16).length)).toBe(49);
 }
});

import {test,expect,Page} from '@playwright/test';
import {openEditor,clickTool,undo,redo,downloadPiskelFile} from './editor-helpers';
import fs from 'node:fs/promises';
const liftKey=(process.platform==='darwin'?'Meta':'Control')+'+Shift+j';
async function seed(page:Page,nested=false){await page.evaluate(nested=>{const s=window.pskl,f=new s.model.Frame(16,16);for(let y=2;y<=5;y++)for(let x=2;x<=12;x++)if(x<=5||x>=9)f.setPixel(x,y,x===3?'rgba(255,0,0,0.5)':'#ff0000');const source=s.model.Layer.fromFrames('Character',[f,f.clone()]),layers=[source];if(nested){const group=s.model.Layer.fromFrames('Group',[new s.model.Frame(16,16),new s.model.Frame(16,16)]);group.rowState.isGroup=true;source.rowState.parentGroup=s.utils.LayerGroupUtils.id(group);source.setOpacity(.6);layers.push(group);}s.app.piskelController.setPiskel(s.model.Piskel.fromLayers(layers,12,{name:'Selection test',description:''}));},nested);await page.waitForTimeout(220);}
const selected=(page:Page)=>page.evaluate(()=>window.pskl.app.selectionManager.currentSelection?.pixels.map((p:any)=>`${p.col},${p.row}`).sort()||[]);
const pixels=(page:Page)=>page.evaluate(()=>Array.from(window.pskl.app.piskelController.getCurrentFrame().pixels));
async function gesture(page:Page,tool:string,from=[2,2],to=[5,5],modifier?:string){
 const coords=await page.evaluate(({from,to,lasso})=>{const d=window.pskl.app.drawingController,points=lasso?[from,[to[0],from[1]],to,[from[0],to[1]],from]:[from,to];return points.map(p=>d.getScreenCoordinates(p[0],p[1]));},{from,to,lasso:tool==='tool-lasso-select'});
 if(modifier)await page.keyboard.down(modifier);await page.mouse.move(coords[0].x,coords[0].y);await page.mouse.down();
 if(tool!=='tool-shape-select')for(const point of coords.slice(1))await page.mouse.move(point.x,point.y,{steps:4});
 await page.mouse.up();if(modifier)await page.keyboard.up(modifier);
}
for(const tool of ['tool-rectangle-select','tool-lasso-select','tool-shape-select'])test(`${tool}: Shift adds and Control subtracts exact areas without changing the artwork`,async({page})=>{
 await openEditor(page);await seed(page);const before=await pixels(page);await clickTool(page,tool);await gesture(page,tool);const left=await selected(page);
 // Shape selection uses one connected color; avoid the partially transparent stripe.
 expect(left.length).toBe(tool==='tool-shape-select'?4:16);
 await gesture(page,tool,[9,2],[12,5],'Shift');expect((await selected(page)).length).toBe(left.length+16);
 await gesture(page,tool,[2,2],[5,5],'Control');expect((await selected(page)).length).toBe(16);
 await gesture(page,tool,[9,2],[12,5],'Control');expect(await selected(page)).toEqual([]);expect(await pixels(page)).toEqual(before);
});

test('all selectors share a mask, modifier clicks inside it edit rather than move, and shrinking drags do not accumulate',async({page})=>{
 await openEditor(page);await seed(page);const before=await pixels(page);await clickTool(page,'tool-rectangle-select');await gesture(page,'tool-rectangle-select');await clickTool(page,'tool-shape-select');expect((await selected(page)).length).toBe(16);await gesture(page,'tool-shape-select',[9,2],[12,5],'Shift');expect((await selected(page)).length).toBe(32);await clickTool(page,'tool-lasso-select');await gesture(page,'tool-lasso-select',[2,2],[5,5],'Control');expect((await selected(page)).length).toBe(16);await clickTool(page,'tool-rectangle-select');await gesture(page,'tool-rectangle-select',[9,2],[10,3],'Shift');expect((await selected(page)).length).toBe(16);
 const c=await page.evaluate(()=>{const d=window.pskl.app.drawingController;return [[9,2],[12,5],[10,3]].map(p=>d.getScreenCoordinates(...p));});await page.keyboard.down('Control');await page.mouse.move(c[0].x,c[0].y);await page.mouse.down();await page.mouse.move(c[1].x,c[1].y,{steps:5});expect(await selected(page)).toEqual([]);await page.mouse.move(c[2].x,c[2].y,{steps:5});await page.mouse.up();await page.keyboard.up('Control');expect((await selected(page)).length).toBe(12);expect(await pixels(page)).toEqual(before);
});

test('lift shortcut moves only selected pixels into a new nested layer on the current frame, with atomic Undo/Redo and export',async({page})=>{
 await openEditor(page);await seed(page,true);await page.evaluate(()=>window.pskl.app.piskelController.setCurrentFrameIndex(1));await clickTool(page,'tool-rectangle-select');await gesture(page,'tool-rectangle-select');await gesture(page,'tool-rectangle-select',[2,2],[2,5],'Control');const before=await page.evaluate(()=>{const c=window.pskl.app.piskelController;return {frames:c.getLayers()[0].frames.map((f:any)=>Array.from(f.pixels)),history:window.pskl.app.historyService.currentIndex};});
 await page.keyboard.press(liftKey);await expect.poll(()=>page.evaluate(()=>window.pskl.app.piskelController.getLayers().length)).toBe(3);
 const after=await page.evaluate(()=>{const c=window.pskl.app.piskelController,ls=c.getLayers();return {frames:ls.map((l:any)=>l.frames.map((f:any)=>Array.from(f.pixels))),parent:ls[1].rowState.parentGroup,group:ls[2].rowState.groupNodeId,id:ls[1].rowState.groupNodeId,name:ls[1].getName(),opacity:ls[1].getOpacity(),index:c.getCurrentLayerIndex(),history:window.pskl.app.historyService.currentIndex};});
 expect(after.history).toBe(before.history+1);expect(after.index).toBe(1);expect(after.name).toBe('Character · lifted');expect(after.parent).toBe(after.group);expect(after.opacity).toBe(.6);expect(after.frames[0][0]).toEqual(before.frames[0]);expect(after.frames[1][0].every((p:number)=>p===0)).toBe(true);
 for(let y=0;y<16;y++)for(let x=0;x<16;x++){const i=y*16+x,cut=x>=3&&x<=5&&y>=2&&y<=5;expect(after.frames[0][1][i]).toBe(cut?0:before.frames[1][i]);expect(after.frames[1][1][i]).toBe(cut?before.frames[1][i]:0);}
 await undo(page);await expect.poll(()=>page.evaluate(()=>window.pskl.app.piskelController.getLayers().length)).toBe(2);expect(await page.evaluate(()=>window.pskl.app.piskelController.getLayers()[0].frames.map((f:any)=>Array.from(f.pixels)))).toEqual(before.frames);expect(await page.evaluate(()=>window.pskl.app.piskelController.getCurrentLayerIndex())).toBe(0);await page.waitForTimeout(60);await redo(page);await expect.poll(()=>page.evaluate(()=>window.pskl.app.piskelController.getLayers().length)).toBe(3);expect(await page.evaluate(()=>window.pskl.app.piskelController.getLayers()[1].rowState.groupNodeId)).toBe(after.id);expect(await page.evaluate(()=>window.pskl.app.piskelController.getLayers().map((l:any)=>l.frames.map((f:any)=>Array.from(f.pixels))))).toEqual(after.frames);
 const file=await downloadPiskelFile(page),data=JSON.parse(await fs.readFile(file,'utf8'));expect(data.piskel.layers).toHaveLength(3);await page.evaluate(async data=>{const s=window.pskl,p=await new Promise<any>((resolve,reject)=>s.utils.serialization.Deserializer.deserialize(data,resolve,reject));s.app.piskelController.setPiskel(p);},data);expect(await page.evaluate(()=>window.pskl.app.piskelController.getLayers().map((l:any)=>l.frames.map((f:any)=>Array.from(f.pixels))))).toEqual(after.frames);
});

test('lift ignores empty selections, locked groups and input focus, and appears in the editable shortcut list',async({page})=>{
 await openEditor(page);await seed(page,true);await page.keyboard.press(liftKey);expect(await page.evaluate(()=>window.pskl.app.piskelController.getLayers().length)).toBe(2);await clickTool(page,'tool-rectangle-select');await gesture(page,'tool-rectangle-select',[7,7],[8,8]);await page.keyboard.press(liftKey);expect(await page.evaluate(()=>window.pskl.app.piskelController.getLayers().length)).toBe(2);await gesture(page,'tool-rectangle-select');await page.evaluate(()=>window.pskl.app.piskelController.getLayers()[1].rowState.locked=true);const before=await pixels(page);await page.keyboard.press(liftKey);expect(await pixels(page)).toEqual(before);expect(await page.evaluate(()=>window.pskl.app.piskelController.getLayers().length)).toBe(2);
 await page.evaluate(()=>window.pskl.app.piskelController.getLayers()[1].rowState.locked=false);
 await page.evaluate(()=>{const input=document.createElement('input');input.id='shortcut-test-input';document.body.append(input);input.focus();});await page.keyboard.press(liftKey);expect(await page.evaluate(()=>window.pskl.app.piskelController.getLayers().length)).toBe(2);await page.locator('#shortcut-test-input').evaluate(e=>e.remove());
 const shortcut=await page.evaluate(()=>{const s=window.pskl.app.shortcutService.getShortcutById('selection-lift-new-layer');return {description:s.getDescription(),keys:s.getKeys(),editable:s.isEditable()};});expect(shortcut).toEqual({description:'Lift selected pixels to a new layer',keys:['ctrl+shift+J'],editable:true});
 await page.locator('.cheatsheet-link').click();const row=page.locator('[data-shortcut-id="selection-lift-new-layer"]');await expect(row).toBeVisible();await expect(row).toContainText('Lift selected pixels to a new layer');await row.click();await page.keyboard.press((process.platform==='darwin'?'Meta':'Control')+'+Shift+k');await page.keyboard.press('Escape');await page.reload();await seed(page,true);await clickTool(page,'tool-rectangle-select');await gesture(page,'tool-rectangle-select');await page.keyboard.press((process.platform==='darwin'?'Meta':'Control')+'+Shift+k');await expect.poll(()=>page.evaluate(()=>window.pskl.app.piskelController.getLayers().length)).toBe(3);
});

test('Alt-drag moves pixels in one undo step while ordinary selection dragging moves just the mask',async({page})=>{
 await openEditor(page);await seed(page);const before=await pixels(page);await clickTool(page,'tool-rectangle-select');await gesture(page,'tool-rectangle-select');const history=await page.evaluate(()=>window.pskl.app.historyService.currentIndex);await gesture(page,'tool-rectangle-select',[4,3],[6,3],'Alt');const moved=await pixels(page);expect(moved).not.toEqual(before);expect(await page.evaluate(()=>window.pskl.app.historyService.currentIndex)).toBe(history+1);expect(moved[3*16+2]).toBe(0);expect(moved[3*16+5]).toBe(before[3*16+3]);await undo(page);await expect.poll(()=>pixels(page)).toEqual(before);await page.waitForTimeout(60);await redo(page);await expect.poll(()=>pixels(page)).toEqual(moved);await clickTool(page,'tool-rectangle-select');await gesture(page,'tool-rectangle-select',[4,2],[7,5]);await gesture(page,'tool-rectangle-select',[5,3],[6,3]);expect(await pixels(page)).toEqual(moved);
});

test('Delete acts only on the edited mask and Undo restores all excluded pixels',async({page})=>{
 await openEditor(page);await seed(page);const before=await pixels(page);await clickTool(page,'tool-rectangle-select');await gesture(page,'tool-rectangle-select');await gesture(page,'tool-rectangle-select',[2,2],[2,5],'Control');await page.keyboard.press('Delete');const erased=await pixels(page);for(let y=0;y<16;y++)for(let x=0;x<16;x++){const i=y*16+x;expect(erased[i]).toBe(x>=3&&x<=5&&y>=2&&y<=5?0:before[i]);}await undo(page);await expect.poll(()=>pixels(page)).toEqual(before);
});

test('unfinished pixel drags cancel safely on blur or a tool change, including a later mouseup',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await openEditor(page);await seed(page);const before=await pixels(page);await clickTool(page,'tool-rectangle-select');await gesture(page,'tool-rectangle-select');
 for(const action of ['blur','tool']){
  await clickTool(page,'tool-rectangle-select');await gesture(page,'tool-rectangle-select');const coords=await page.evaluate(()=>{const d=window.pskl.app.drawingController;return [d.getScreenCoordinates(4,3),d.getScreenCoordinates(6,3)];});await page.keyboard.down('Alt');await page.mouse.move(coords[0].x,coords[0].y);await page.mouse.down();await page.mouse.move(coords[1].x,coords[1].y,{steps:5});
  if(action==='blur')await page.evaluate(()=>window.dispatchEvent(new Event('blur')));else {await page.keyboard.up('Alt');await page.keyboard.press('p');}await page.mouse.up();await page.keyboard.up('Alt');expect(await pixels(page)).toEqual(before);
 }
 expect(errors).toEqual([]);
});

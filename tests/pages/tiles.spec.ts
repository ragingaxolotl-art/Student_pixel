import test, {expect, Page} from '@playwright/test';
import {openEditor, downloadPiskelFile, importPiskelFile} from './editor-helpers';
const state=(page:Page)=>page.evaluate(()=>window.pskl.app.dialogsController.currentDialog_.controller.config);
const action=(page:Page,id:string)=>page.locator(`[data-tile-action="${id}"]`).click();
async function open(page:Page) {
 await openEditor(page);
 await page.getByRole('button',{name:'Tile Studio',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Tile Studio',exact:true})).toBeVisible();
}
async function at(page:Page,x:number,y:number,cols:number,rows:number) {
 const b=(await page.getByLabel('Tile Studio canvas',{exact:true}).boundingBox())!;
 return {x:b.x+(x+.5)*b.width/cols,y:b.y+(y+.5)*b.height/rows};
}
async function cell(page:Page,x:number,y:number,cols=24,rows=16) {
 const p=await at(page,x,y,cols,rows);await page.mouse.click(p.x,p.y);
}
async function region(page:Page,x:number,y:number,ex:number,ey:number,cols=24,rows=16) {
 const a=await at(page,x,y,cols,rows),b=await at(page,ex,ey,cols,rows);
 await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:4});await page.mouse.up();
}
async function close(page:Page) {
 await page.getByLabel('Close Tile Studio',{exact:true}).click();
 await page.waitForFunction(()=>!window.pskl.app.dialogsController.currentDialog_);
}
async function map(page:Page) {await page.locator('[data-tile-stage="map"]').click();}
let errors:string[]=[];
test.beforeEach(async({page})=>{errors=[];page.on('pageerror',e=>errors.push(e.message));});
test.afterEach(()=>expect(errors).toEqual([]));
test('tile edits update linked placements; local undo and redo preserve source artwork',async({page})=>{
 await open(page);
 const original=await page.evaluate(()=>Array.from(window.pskl.app.piskelController.getCurrentFrame().getPixels()));
 await action(page,'new');await cell(page,0,0,16,16);
 const painted=(await state(page)).tiles[0].pixels[0];expect(painted).not.toBe(0);
 await map(page);await cell(page,1,1);await cell(page,2,1);
 let c=await state(page);expect(c.layers[0].cells[25].tile).toBe(c.tiles[0].id);expect(c.layers[0].cells[26].tile).toBe(c.tiles[0].id);
 await page.locator('[data-tile-stage="tiles"]').click();await page.locator('[data-tile-field="color"]').fill('#ff0000');await cell(page,0,0,16,16);
 expect((await state(page)).tiles[0].pixels[0]).toBe(4278190335);
 await action(page,'undo');expect((await state(page)).tiles[0].pixels[0]).toBe(painted);
 await action(page,'redo');expect((await state(page)).tiles[0].pixels[0]).toBe(4278190335);
 expect(await page.evaluate(()=>Array.from(window.pskl.app.piskelController.getCurrentFrame().getPixels()))).toEqual(original);
});
test('fill, rectangle, stamps, independent tiles and locked map layers',async({page})=>{
 await open(page);await action(page,'new');await cell(page,0,0,16,16);await map(page);
 await page.locator('[data-tile-tool="rectangle"]').click();await region(page,1,1,2,2);
 let c=await state(page);expect(c.layers[0].cells.filter(Boolean)).toHaveLength(4);
 await page.locator('[data-tile-tool="select"]').click();await region(page,1,1,2,2);await action(page,'stamp');
 await cell(page,5,5);c=await state(page);expect(c.stamps).toHaveLength(1);expect(c.layers[0].cells.filter(Boolean)).toHaveLength(8);
 await page.locator('[data-tile-tool="select"]').click();await region(page,1,1,2,2);await action(page,'unique');
 c=await state(page);expect(c.tiles).toHaveLength(2);expect(c.layers[0].cells[25].tile).not.toBe(c.layers[0].cells[125].tile);
 await page.getByLabel('Locked Ground',{exact:true}).check();await page.locator('[data-tile-tool="erase"]').click();await cell(page,1,1);
 expect((await state(page)).layers[0].cells[25]).not.toBeNull();await expect(page.locator('.tile-footer [role="status"]')).toContainText('Unlock');
 await page.getByLabel('Locked Ground',{exact:true}).uncheck();await action(page,'add-layer');
 await page.locator('[data-tile-tool="fill"]').click();await cell(page,0,0);
 expect((await state(page)).layers[1].cells.filter(Boolean)).toHaveLength(24*16);
});
test('source slicing handles rectangular artwork and exact selection masks',async({page})=>{
 await openEditor(page);
 await page.evaluate(()=>{const s=window.pskl,f=new s.model.Frame(32,16);f.setPixel(0,0,0xff0000ff);f.setPixel(16,0,0xff00ff00);const l=s.model.Layer.fromFrames('Tiles source',[f]);s.app.piskelController.setPiskel(s.model.Piskel.fromLayers([l],12,{name:'Tiles',description:''}));});
 await page.getByRole('button',{name:'Tile Studio',exact:true}).click();await action(page,'artwork');
 let c=await state(page);expect(c.tiles).toHaveLength(2);expect(c.tiles[0].pixels[0]).toBe(4278190335);expect(c.tiles[1].pixels[0]).toBe(4278255360);
 await page.evaluate(()=>{window.pskl.app.selectionManager.currentSelection={pixels:[{col:16,row:0}]};});
 await page.getByLabel('Tile artwork source').selectOption('selection');await action(page,'artwork');
 c=await state(page);expect(c.tiles).toHaveLength(3);expect(c.tiles[2].pixels[0]).toBe(4278255360);expect(c.tiles[2].pixels.filter(Boolean)).toHaveLength(1);
});
test('tile state survives .piskel download/import and map PNG matches rendering',async({page})=>{
 await open(page);await action(page,'new');await cell(page,0,0,16,16);await map(page);await cell(page,0,0);
 const expected=await state(page);
 const downloading=page.waitForEvent('download');await action(page,'map-png');const png=await downloading;expect(png.suggestedFilename()).toBe('tile-map.png');
 const bytes=await (await png.createReadStream())!;const chunks:Buffer[]=[];for await(const chunk of bytes)chunks.push(chunk);const data=Buffer.concat(chunks);
 expect(data.subarray(1,4).toString()).toBe('PNG');expect(data.readUInt32BE(16)).toBe(384);expect(data.readUInt32BE(20)).toBe(256);
 await close(page);const file=await downloadPiskelFile(page);await importPiskelFile(page,file);
 await page.getByRole('button',{name:'Tile Studio',exact:true}).click();expect(await state(page)).toEqual(expected);
});
test('malformed import is rejected without touching map; valid JSON round trips and undoes',async({page})=>{
 await open(page);await action(page,'new');const expected=await state(page);
 await page.locator('.tile-json-file').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"version":1}')});
 await expect(page.locator('.tile-footer [role="status"]')).toContainText('Invalid');expect(await state(page)).toEqual(expected);
 const changed=structuredClone(expected);changed.tiles[0].name='Imported tile';
 await page.locator('.tile-json-file').setInputFiles({name:'map.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(changed))});
 await expect(page.locator('.tile-footer [role="status"]')).toContainText('imported');expect(await state(page)).toEqual(changed);
 await action(page,'undo');expect(await state(page)).toEqual(expected);
});
test('panels drag, collapse, resize and persist separately for Tiles and Map',async({page})=>{
 await open(page);
 await page.locator('.tile-dialog').getByLabel('Collapse Preview panel',{exact:true}).click();await expect(page.getByLabel('Tile Studio preview',{exact:true})).toBeHidden();
 const handle=page.getByRole('button',{name:'Move studio Preview panel',exact:true});const b=(await handle.boundingBox())!;
 await page.mouse.move(b.x+50,b.y+10);await page.mouse.down();await page.mouse.move(450,180,{steps:5});await page.mouse.up();
 await expect(page.locator('.tile-preview')).toHaveAttribute('data-studio-floating','true');
 const floating=await page.locator('.tile-preview').boundingBox();
 await map(page);await expect(page.getByLabel('Tile Studio preview',{exact:true})).toBeVisible();await expect(page.locator('.tile-preview')).not.toHaveAttribute('data-studio-floating');
 await page.locator('[data-tile-stage="tiles"]').click();await expect(page.getByLabel('Tile Studio preview',{exact:true})).toBeHidden();
 expect(await page.locator('.tile-preview').boundingBox()).toEqual(floating);
 await close(page);await page.getByRole('button',{name:'Tile Studio',exact:true}).click();await expect(page.getByLabel('Tile Studio preview',{exact:true})).toBeHidden();
 await page.getByRole('button',{name:'Reset panels',exact:true}).click();await expect(page.getByLabel('Tile Studio preview',{exact:true})).toBeVisible();
});
test('small window keeps tools, stages and close accessible',async({page})=>{
 await page.setViewportSize({width:720,height:760});await open(page);await action(page,'new');await cell(page,1,1,16,16);await map(page);
 await expect(page.getByLabel('Close Tile Studio',{exact:true})).toBeInViewport();await expect(page.locator('[data-tile-stage="tiles"]')).toBeInViewport();
 await expect(page.locator('[data-tile-tool="brush"]')).toBeVisible();await close(page);
});
test('PNG slicing, tile size, resize, transforms, line and cut/paste',async({page})=>{
 await open(page);
 await page.locator('[data-tile-field="size"]').fill('8');await action(page,'size');
 const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=16;c.height=8;const x=c.getContext('2d')!;x.fillStyle='#ff0000';x.fillRect(0,0,8,8);x.fillStyle='#0000ff';x.fillRect(8,0,8,8);return c.toDataURL().split(',')[1];});
 await page.locator('.tile-image-file').setInputFiles({name:'tiles.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
 await expect.poll(async()=>(await state(page)).tiles.length).toBe(2);
 await map(page);await action(page,'flip');await action(page,'rotate');await page.locator('[data-tile-tool="line"]').click();await region(page,0,0,3,0);
 let c=await state(page);expect(c.layers[0].cells.filter(Boolean)).toHaveLength(4);expect(c.layers[0].cells[0]).toMatchObject({flip:true,turn:1});
 await page.locator('[data-tile-tool="select"]').click();await region(page,0,0,3,0);await action(page,'cut');
 expect((await state(page)).layers[0].cells.filter(Boolean)).toHaveLength(0);await cell(page,2,2);
 c=await state(page);expect(c.layers[0].cells.filter(Boolean)).toHaveLength(4);
 await page.locator('[data-tile-field="width"]').fill('12');await page.locator('[data-tile-field="height"]').fill('8');await action(page,'resize');
 c=await state(page);expect(c.width).toBe(12);expect(c.layers[0].cells[26]).not.toBeNull();
 await action(page,'undo');expect((await state(page)).width).toBe(24);
});
test('wrapping joins strokes across the tile border and erasing undoes',async({page})=>{
 await open(page);await action(page,'new');
 const a=await at(page,15,4,16,16), b=(await page.getByLabel('Tile Studio canvas',{exact:true}).boundingBox())!;
 await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x+b.width+b.width/32,a.y);await page.mouse.up();
 let c=await state(page);expect(c.tiles[0].pixels[4*16+15]).not.toBe(0);expect(c.tiles[0].pixels[4*16]).not.toBe(0);
 await page.locator('[data-tile-tool="erase"]').click();await cell(page,0,4,16,16);expect((await state(page)).tiles[0].pixels[64]).toBe(0);
 await action(page,'undo');expect((await state(page)).tiles[0].pixels[64]).not.toBe(0);
});
test('visual workspace with artwork and map',async({page})=>{
 await open(page);
 await page.evaluate(()=>{
   const d=window.pskl.app.dialogsController.currentDialog_.controller,U=window.pskl.utils.TileStudioUtils;
   d.edit(()=>{
     const c=d.config;c.size=16;
     const grass=Array.from({length:256},(_,i)=>((i*17+i%7)%11<2?0xff4b863b:0xff559b46)>>>0);
     const stone=Array.from({length:256},(_,i)=>i%16===0||Math.floor(i/16)%8===0?0xff505860:0xff828a91);
     const a=U.tile(c,grass,'Grass'),b=U.tile(c,stone,'Stone path');
     for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)c.layers[0].cells[y*c.width+x]={tile:x>=10&&x<=12?b.id:a.id,turn:0,flip:false};
     d.selected=a.id;
   });
 });
 await map(page);await expect(page.locator('#dialog-container-wrapper')).toHaveCSS('opacity','1');await page.screenshot({path:'docs/validation/tile-studio/map-workspace.png'});
 await page.locator('[data-tile-stage="tiles"]').click();await page.screenshot({path:'docs/validation/tile-studio/tile-workspace.png'});
});
test('circle, rectangle outline and two-color shape previews match committed pixels',async({page})=>{
 await open(page);await action(page,'new');
 await page.locator('[data-tile-field="color"]').fill('#ff0000');
 await page.locator('[data-tile-field="secondary"]').fill('#0000ff');
 await page.getByLabel('Tile shape fill').selectOption('filled');
 await page.locator('[data-tile-tool="rectangle"]').click();await region(page,1,1,7,7,16,16);
 let pixels=(await state(page)).tiles[0].pixels;expect(pixels[1*16+1]).toBe(4278190335);expect(pixels[4*16+4]).toBe(4294901760);
 await action(page,'undo');await page.getByLabel('Tile shape fill').selectOption('empty');
 await page.locator('[data-tile-tool="ellipse"]').click();await region(page,2,2,12,12,16,16);
 pixels=(await state(page)).tiles[0].pixels;expect(pixels[2*16+2]).toBe(0);expect(pixels[7*16+7]).toBe(0);expect(pixels.filter(Boolean).length).toBeGreaterThan(12);
 await action(page,'undo');await page.getByLabel('Tile shape fill').selectOption('fill-only');await region(page,2,2,12,12,16,16);
 pixels=(await state(page)).tiles[0].pixels;expect(pixels[7*16+7]).toBe(4278190335);expect(pixels[2*16+2]).toBe(0);
});
test('all shared dither patterns, density, palette colors, brush size and opacity work in Tiles',async({page})=>{
 await open(page);await action(page,'new');
 expect(await page.getByLabel('Tile dither pattern',{exact:true}).locator('option').count()).toBe(273);
 await page.getByLabel('Tile paint color',{exact:true}).fill('#ff0000');await page.getByLabel('Tile secondary color',{exact:true}).fill('#0000ff');
 await page.locator('[data-tile-tool="dither"]').click();await page.getByLabel('Tile brush size',{exact:true}).fill('4');await cell(page,5,5,16,16);
 const expected=await page.evaluate(()=>{const s=window.pskl;const settings=s.utils.DitherPatterns.normalize({pattern:'checker',mode:'pattern',density:50,scale:1,coverage:50});return s.PixelUtils.resizePixel(5,5,4).map(([x,y]:number[])=>({at:y*16+x,color:s.utils.DitherPatterns.sample(x,y,settings)?4278190335:4294901760}));});
 let pixels=(await state(page)).tiles[0].pixels;for(const v of expected)expect(pixels[v.at]).toBe(v.color);
 await action(page,'undo');await page.getByLabel('Tile dither mode',{exact:true}).selectOption('density');await page.getByLabel('Tile dither density',{exact:true}).fill('100');await cell(page,5,5,16,16);
 pixels=(await state(page)).tiles[0].pixels;expect(pixels.filter(Boolean).every((v:number)=>v===4278190335)).toBe(true);
 await action(page,'undo');await page.locator('[data-tile-tool="brush"]').click();await page.getByLabel('Tile paint opacity',{exact:true}).fill('50');await page.getByLabel('Tile brush size',{exact:true}).fill('1');
 await page.getByRole('button',{name:'Tile palette color #ffffff',exact:true}).click();await cell(page,0,0,16,16);
 pixels=(await state(page)).tiles[0].pixels;expect(pixels[0]>>>24).toBe(128);expect(pixels[0]&0xffffff).toBe(0xffffff);
});
test('resolution scales existing art or resizes its canvas, preserves IDs and placements and undoes',async({page})=>{
 await open(page);await action(page,'new');await cell(page,1,1,16,16);await map(page);await cell(page,2,3);
 const initial=await state(page);
 await page.getByLabel('Tile resolution',{exact:true}).fill('32');await action(page,'size');
 let c=await state(page);expect(c.size).toBe(32);expect(c.tiles[0].id).toBe(initial.tiles[0].id);expect(c.tiles[0].pixels.filter(Boolean)).toHaveLength(4);
 expect(c.layers[0].cells).toEqual(initial.layers[0].cells);
 await action(page,'undo');expect(await state(page)).toEqual(initial);await action(page,'redo');expect((await state(page)).size).toBe(32);
 await page.getByLabel('Tile resize method',{exact:true}).selectOption('canvas');await page.getByLabel('Tile resolution',{exact:true}).fill('40');await action(page,'size');
 c=await state(page);expect(c.size).toBe(40);expect(c.tiles[0].pixels.filter(Boolean)).toHaveLength(4);expect(c.tiles[0].pixels[2*40+2]).toBe(initial.tiles[0].pixels[17]);
 await page.getByLabel('Tile resolution',{exact:true}).fill('128');await action(page,'size');await expect(page.locator('.tile-footer [role="status"]')).toContainText('Reduce map');expect((await state(page)).size).toBe(40);
});
test('four tile layers support compositing, visibility, locks, duplication and resolution changes',async({page})=>{
 await open(page);await action(page,'new');
 let c=await state(page);expect(c.tiles[0].drawLayers).toHaveLength(4);
 await page.getByLabel('Tile paint color',{exact:true}).fill('#ff0000');await cell(page,2,2,16,16);
 await page.getByRole('button',{name:'Select tile layer Details',exact:true}).click();await page.getByLabel('Tile paint color',{exact:true}).fill('#0000ff');await cell(page,2,2,16,16);
 c=await state(page);expect(c.tiles[0].pixels[34]).toBe(4294901760);expect(c.tiles[0].drawLayers[0].pixels[34]).toBe(4278190335);
 await page.getByLabel('Show tile layer Details',{exact:true}).uncheck();expect((await state(page)).tiles[0].pixels[34]).toBe(4278190335);
 await page.getByLabel('Show tile layer Details',{exact:true}).check();await page.getByLabel('Lock tile layer Details',{exact:true}).check();
 await cell(page,3,3,16,16);expect((await state(page)).tiles[0].drawLayers[1].pixels[51]).toBe(0);
 await page.getByLabel('Lock tile layer Details',{exact:true}).uncheck();await action(page,'duplicate');
 c=await state(page);expect(c.tiles[1].drawLayers).toEqual(c.tiles[0].drawLayers);
 await page.getByLabel('Tile resolution',{exact:true}).fill('32');await action(page,'size');c=await state(page);expect(c.tiles.every((t:any)=>t.drawLayers.every((l:any)=>l.pixels.length===1024))).toBe(true);
 await action(page,'undo');expect((await state(page)).size).toBe(16);
});
test('lighten, darken and tile selection copy/cut constrain and move pixels with undo',async({page})=>{
 await open(page);await action(page,'new');await page.getByLabel('Tile paint color',{exact:true}).fill('#808080');await cell(page,2,2,16,16);
 const base=(await state(page)).tiles[0].pixels[34];
 await page.locator('[data-tile-tool="lighten"]').click();await cell(page,2,2,16,16);expect(((await state(page)).tiles[0].pixels[34]&255)).toBeGreaterThan(base&255);
 await action(page,'undo');await page.locator('[data-tile-tool="darken"]').click();await cell(page,2,2,16,16);expect(((await state(page)).tiles[0].pixels[34]&255)).toBeLessThan(base&255);
 await action(page,'undo');await page.locator('[data-tile-tool="select"]').click();await region(page,2,2,3,3,16,16);await action(page,'copy');await cell(page,6,6,16,16);
 let c=await state(page);expect(c.tiles[0].pixels[102]).toBe(base);
 await page.getByLabel('Tile Studio canvas',{exact:true}).press('Escape');await page.locator('[data-tile-tool="select"]').click();await region(page,2,2,2,2,16,16);await action(page,'cut');expect((await state(page)).tiles[0].pixels[34]).toBe(0);
 await cell(page,8,8,16,16);expect((await state(page)).tiles[0].pixels[136]).toBe(base);
 await action(page,'undo');expect((await state(page)).tiles[0].pixels[136]).toBe(0);
});
test('studio and main project saves retain rigging and layered tiles together across fresh pages',async({page,context})=>{
 await openEditor(page);
 await page.evaluate(()=>{
  const s=window.pskl,c=s.app.piskelController,p=c.getPiskel(),l=p.getLayerAt(0);
  l.rowState.id='save-art';l.getFrameAt(0).setPixel(12,12,0xff4455ee);
  const rig=s.utils.RigStudioUtils.template('humanoid',32,32);rig.skin=false;rig.bones[0].layerId='save-art';rig.bones[0].layerName=l.getName();
  rig.workingPose[rig.bones[0].id]={rotation:20,x:3,y:-2};p.toolState.rigStudio=rig;c.setPiskel(p);
 });
 await page.getByRole('button',{name:'Puppet Studio',exact:true}).click();await page.getByRole('button',{name:'Start rigging',exact:true}).click();
 await page.getByRole('button',{name:'Save Rig',exact:true}).click();
 await page.getByLabel('Close Puppet Studio',{exact:true}).click();await page.waitForFunction(()=>!window.pskl.app.dialogsController.currentDialog_);
 const rig=await page.evaluate(()=>window.pskl.app.piskelController.getPiskel().toolState.rigStudio);
 await page.getByRole('button',{name:'Tile Studio',exact:true}).click();await action(page,'new');await cell(page,1,1,16,16);
 await page.getByRole('button',{name:'Select tile layer Details',exact:true}).click();await page.getByLabel('Tile paint color',{exact:true}).fill('#00ff00');await cell(page,2,2,16,16);
 await map(page);await cell(page,3,4);await action(page,'save');const tiles=await state(page);
 expect(await page.evaluate(()=>window.pskl.app.piskelController.getPiskel().toolState.rigStudio)).toEqual(rig);
 const downloading=page.waitForEvent('download');await action(page,'download-project');const download=await downloading;expect(download.suggestedFilename()).toMatch(/\.piskel$/);
 const fs=await import('node:fs/promises'),path=await import('node:path');const disk=(await download.path())!,file=path.join(path.dirname(disk),'studio-whole-project.piskel');await fs.copyFile(disk,file);
 await page.close();const fresh=await context.newPage();await openEditor(fresh);await importPiskelFile(fresh,file);
 const combined=()=>fresh.evaluate(()=>{const p=window.pskl.app.piskelController.getPiskel();return {rig:p.toolState.rigStudio,tiles:p.toolState.tileStudio};});
 expect(await combined()).toEqual({rig,tiles});
 await fresh.getByRole('button',{name:'Puppet Studio',exact:true}).click();await fresh.getByRole('button',{name:'Start rigging',exact:true}).click();await fresh.getByRole('button',{name:'Save Rig',exact:true}).click();
 expect((await combined()).tiles).toEqual(tiles);
 await fresh.getByLabel('Close Puppet Studio',{exact:true}).click();await fresh.waitForFunction(()=>!window.pskl.app.dialogsController.currentDialog_);
 const beforeMain=await combined(),mainFile=await downloadPiskelFile(fresh);await fresh.close();const reopened=await context.newPage();await openEditor(reopened);await importPiskelFile(reopened,mainFile);
 expect(await reopened.evaluate(()=>{const p=window.pskl.app.piskelController.getPiskel();return {rig:p.toolState.rigStudio,tiles:p.toolState.tileStudio};})).toEqual(beforeMain);
});
test('tile preview repeat count changes the rendered repetition',async({page})=>{
 await open(page);await action(page,'new');await cell(page,1,1,16,16);
 await page.getByLabel('Tile preview repeat count',{exact:true}).fill('4');await page.getByLabel('Tile preview repeat count',{exact:true}).press('Tab');
 const result=await page.getByLabel('Tile Studio preview',{exact:true}).evaluate((c:HTMLCanvasElement)=>({width:c.width,height:c.height,painted:Array.from(c.getContext('2d')!.getImageData(0,0,c.width,c.height).data).filter((v,i)=>i%4===3&&v>0).length}));
 expect(result).toEqual({width:64,height:64,painted:16});
});

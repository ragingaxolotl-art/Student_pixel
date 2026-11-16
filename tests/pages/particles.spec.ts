import test,{expect} from '@playwright/test';
import fs from 'node:fs';
async function openEditorWithSettledCanvas(page:any) {
 await page.goto('./');
 await expect(page.locator('.workspace-enabled')).toBeVisible();
 await expect(page.locator('#loading-mask')).toBeHidden();
 await expect(page.locator('#drawing-canvas-container .drawing-canvas')).toBeVisible();
}
const modifier=process.platform==='darwin'?'Meta':'Control';
async function undo(page:any){await page.keyboard.press(modifier+'+z');}
async function redo(page:any){await page.keyboard.press(modifier+'+y');}
async function serializeProject(page:any){return page.evaluate(()=>window.pskl.utils.serialization.Serializer.serialize(window.pskl.app.piskelController.getPiskel()));}
async function restoreProject(page:any,data:string){await page.evaluate(async text=>{const s=window.pskl,p=await new Promise<any>((resolve,reject)=>s.utils.serialization.Deserializer.deserialize(JSON.parse(text),resolve,reject));s.app.piskelController.setPiskel(p);},data);}
let browserErrors:string[]=[];
test.beforeEach(async({page})=>{browserErrors=[];page.on('pageerror',e=>browserErrors.push(e.message));});
test.afterEach(()=>{expect(browserErrors).toEqual([]);});
async function setup(page:any) {
 await openEditorWithSettledCanvas(page);
 await page.evaluate(()=>{const s=window.pskl,f=new s.model.Frame(32,32);for(let y=18;y<28;y++)for(let x=10;x<22;x++)f.setPixel(x,y,0xffcc8844);const l=s.model.Layer.fromFrames('Original art',[f,f.clone()]);l.rowState={id:'original-art',effects:[{id:'keep-fx',operation:'invert',enabled:false,frame:null,params:{amount:30}}]};s.app.piskelController.setPiskel(s.model.Piskel.fromLayers([l],12,{name:'Particle test',description:''}));});
 await page.getByRole('button',{name:'Particle Studio',exact:true}).click(); await expect(page.getByRole('dialog',{name:'Particle Studio',exact:true})).toBeVisible();
 await expect(page.getByLabel('Locked artwork')).toContainText('Locked');
}
async function state(page:any){return page.evaluate(()=>{const d=window.pskl.app.dialogsController.currentDialog_?.controller;return d?.config;});}
async function config(page:any){return page.locator('[data-particle-field="x"]').inputValue();}
async function dragCanvas(page:any,from:any,to:any,steps=8){const b=(await page.getByLabel('Particle canvas',{exact:true}).boundingBox())!;await page.mouse.move(b.x+b.width*from.x/32,b.y+b.height*from.y/32);await page.mouse.down();await page.mouse.move(b.x+b.width*to.x/32,b.y+b.height*to.y/32,{steps});await page.mouse.up();}
async function blur(page:any){await page.getByLabel('Particle animation frame',{exact:true}).focus();}
async function field(page:any,label:string,value:string){await page.getByLabel(label,{exact:true}).fill(value);await blur(page);}
test('launchers are below Palettes and particle studio drags, resizes, and remembers its bounds',async({page})=>{
 await setup(page);const launcher=await page.locator('[data-open-puppet]').boundingBox();expect(launcher!.width).toBe(launcher!.height);expect(await page.locator('.transformations-container [data-open-puppet]').count()).toBe(0);
 const studios=(await page.locator('.studio-panel').boundingBox())!,palettes=(await page.locator('.palettes-list-container').boundingBox())!;expect(studios.y).toBeGreaterThanOrEqual(palettes.y+palettes.height);
 const dialog=page.locator('#dialog-container');const before=(await dialog.boundingBox())!;const h=(await page.locator('.particle-heading').boundingBox())!;
 await page.mouse.move(h.x+140,h.y+15);await page.mouse.down();await page.mouse.move(h.x+175,h.y+40);await page.mouse.up();const moved=(await dialog.boundingBox())!;expect(moved.x).toBeGreaterThan(before.x+25);expect(moved.y).toBeGreaterThan(before.y+15);
 const grip=(await page.getByLabel('Resize Particle Studio',{exact:true}).boundingBox())!;await page.mouse.move(grip.x+6,grip.y+6);await page.mouse.down();await page.mouse.move(grip.x-70,grip.y-60);await page.mouse.up();const resized=(await dialog.boundingBox())!;expect(resized.width).toBeLessThan(moved.width-50);expect(resized.height).toBeLessThan(moved.height-40);
 await page.getByLabel('Close Particle Studio',{exact:true}).click();await page.waitForFunction(()=>!window.pskl.app.dialogsController.currentDialog_);await page.getByRole('button',{name:'Particle Studio',exact:true}).click();expect(await dialog.boundingBox()).toEqual(resized);
});
test('emitter and path gestures undo and redo locally; artwork stays intact and generated particles match preview',async({page})=>{
 await setup(page);await dragCanvas(page,{x:16,y:25},{x:22,y:21});expect(Number(await config(page))).toBeCloseTo(22,1);await blur(page);await undo(page);expect(Number(await config(page))).toBe(16);await redo(page);expect(Number(await config(page))).toBeCloseTo(22,1);
 await page.getByRole('button',{name:'Draw path',exact:true}).click();await dragCanvas(page,{x:8,y:24},{x:25,y:8},12);await expect(page.getByLabel('Follow emitter path',{exact:true})).toBeChecked();await undo(page);await expect(page.getByLabel('Follow emitter path',{exact:true})).not.toBeChecked();await redo(page);await expect(page.getByLabel('Follow emitter path',{exact:true})).toBeChecked();
 await page.getByRole('button',{name:'Edit path',exact:true}).click();const point=page.getByRole('button',{name:'Particle path point 1',exact:true});await point.focus();await page.keyboard.press('ArrowUp');await blur(page);
 await page.getByRole('button',{name:'Save effect',exact:true}).click();await expect(page.locator('.particle-dialog [role="status"]')).toContainText('Effect saved');
 const saved=await page.evaluate(()=>{const s=window.pskl,p=s.app.piskelController.getPiskel(),c=p.toolState.particleStudio,e=new s.utils.ParticleStudioEngine(p,c,0,[]);return {config:c,art:p.getLayerAt(0).getFrames().map((f:any)=>Array.from(f.pixels)),effects:p.getLayerAt(0).rowState.effects,preview:Array.from({length:c.frames},(_,i)=>Array.from(e.render(i).pixels))};});
 await page.getByRole('button',{name:'Generate frames',exact:true}).click();await expect(page.locator('.particle-dialog [role="status"]')).toContainText('Generated');
 const baked=await page.evaluate(()=>{const p=window.pskl.app.piskelController.getPiskel();return{frames:p.getFrameCount(),art:p.getLayerAt(0).getFrames().slice(0,2).map((f:any)=>Array.from(f.pixels)),effects:p.getLayerAt(0).rowState.effects,particles:p.getLayers().find((l:any)=>l.rowState.kind==='community-particles').getFrames().map((f:any)=>Array.from(f.pixels)),locked:p.getLayers().find((l:any)=>l.rowState.kind==='community-particles').isLocked()};});
 expect(baked.frames).toBe(24);expect(baked.art).toEqual(saved.art);expect(baked.effects).toEqual(saved.effects);expect(baked.particles).toEqual(saved.preview);expect(baked.locked).toBe(true);
 await blur(page);await page.waitForTimeout(150);await undo(page);await expect.poll(()=>page.evaluate(()=>window.pskl.app.piskelController.getPiskel().getLayers().length)).toBe(1);await page.waitForTimeout(150);await redo(page);await expect.poll(()=>page.evaluate(()=>window.pskl.app.piskelController.getPiskel().getLayers().length)).toBe(2);
 await page.screenshot({path:test.info().outputPath('particle-studio.png')});
 await page.getByLabel('Close Particle Studio',{exact:true}).click();const file=await serializeProject(page);await restoreProject(page,file);expect(await page.evaluate(()=>window.pskl.app.piskelController.getPiskel().toolState.particleStudio)).toEqual(saved.config);
});
test('position keys interpolate, retime, delete and undo; invalid input and Cancel preserve saved project',async({page})=>{
 await setup(page);await page.getByRole('button',{name:'+ Position key',exact:true}).click();await page.getByLabel('Particle animation frame',{exact:true}).fill('12');await dragCanvas(page,{x:16,y:25},{x:24,y:12});await expect(page.getByRole('button',{name:'Emitter key frame 13',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Emitter key frame 13',exact:true}).focus();await page.keyboard.press('ArrowRight');await expect(page.getByRole('button',{name:'Emitter key frame 14',exact:true})).toBeVisible();await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.getByRole('button',{name:'Emitter key frame 13',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Delete key',exact:true}).click();await expect(page.getByRole('button',{name:'Emitter key frame 13',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.getByRole('button',{name:'Emitter key frame 13',exact:true})).toBeVisible();
 await field(page,'Particle count','999');await expect(page.locator('.particle-dialog [role="status"]')).toContainText('count');await page.getByRole('button',{name:'Save effect',exact:true}).click();expect(await page.evaluate(()=>window.pskl.app.piskelController.getPiskel().toolState.particleStudio)).toBeUndefined();await page.getByRole('button',{name:'Undo',exact:true}).click();expect(await page.getByLabel('Particle count',{exact:true}).inputValue()).toBe('48');
 await page.getByRole('button',{name:'Cancel',exact:true}).click();expect(await page.evaluate(()=>window.pskl.app.piskelController.getPiskel().toolState.particleStudio)).toBeUndefined();
});
for(const size of [{width:748,height:820},{width:1280,height:720}])test(`particle controls stay within window at ${size.width}x${size.height}`,async({page})=>{await page.setViewportSize(size);await setup(page);const boxes=await page.evaluate(()=>{const box=(s:string)=>{const r=document.querySelector(s)!.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom};};return{window:box('#dialog-container'),footer:box('.particle-footer'),timeline:box('.particle-timeline'),canvas:box('.particle-stage')};});expect(boxes.window.right).toBeLessThanOrEqual(size.width);expect(boxes.footer.bottom).toBeLessThanOrEqual(boxes.window.bottom);expect(boxes.timeline.bottom).toBeLessThanOrEqual(boxes.window.bottom);expect(boxes.canvas.bottom).toBeLessThanOrEqual(boxes.timeline.y);});
test('particle size dragging is undoable and multiple emitter controls save independent settings',async({page})=>{
 await setup(page);await page.getByRole('button',{name:'Size',exact:true}).click();await dragCanvas(page,{x:18,y:25},{x:22,y:25});expect(await page.getByLabel('Start particle size',{exact:true}).inputValue()).toBe('6');await page.getByRole('button',{name:'Undo',exact:true}).click();expect(await page.getByLabel('Start particle size',{exact:true}).inputValue()).toBe('2');await page.getByRole('button',{name:'Redo',exact:true}).click();expect(await page.getByLabel('Start particle size',{exact:true}).inputValue()).toBe('6');
 await page.getByRole('button',{name:'+ Emitter',exact:true}).click();await field(page,'Emitter name','Second');await field(page,'Particle count','12');await page.getByRole('button',{name:'Fire',exact:true}).click();expect(await page.getByLabel('Particle count',{exact:true}).inputValue()).toBe('48');await page.getByRole('button',{name:'Second',exact:true}).click();expect(await page.getByLabel('Particle count',{exact:true}).inputValue()).toBe('12');
 await page.getByLabel('Enable Second',{exact:true}).uncheck();await page.getByLabel('Enable Fire',{exact:true}).uncheck();await page.getByRole('button',{name:'Generate frames',exact:true}).click();await expect(page.locator('.particle-dialog [role="status"]')).toContainText('Enable an emitter');expect(await page.evaluate(()=>window.pskl.app.piskelController.getPiskel().getLayers().length)).toBe(1);
});
test('saved effect exports and imports paths and keys, invalid JSON is atomic, and generated output can be removed and undone',async({page})=>{
 await setup(page);await page.getByRole('button',{name:'Draw path',exact:true}).click();await dragCanvas(page,{x:8,y:23},{x:23,y:7});await page.getByRole('button',{name:'+ Position key',exact:true}).click();await page.locator('.particle-properties summary').filter({hasText:'Presets & files'}).click();const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Export effect',exact:true}).click();const file=await pending,data=JSON.parse(fs.readFileSync((await file.path())!,'utf8'));
 await page.getByRole('button',{name:'Clear path',exact:true}).click();await expect(page.getByLabel('Follow emitter path',{exact:true})).not.toBeChecked();await page.getByLabel('Particle effect JSON',{exact:true}).setInputFiles({name:'effect.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await page.getByRole('button',{name:'Import effect',exact:true}).click();await expect(page.getByLabel('Follow emitter path',{exact:true})).toBeChecked();await expect(page.getByRole('button',{name:'Emitter key frame 1',exact:true})).toBeVisible();
 const invalid=JSON.parse(JSON.stringify(data));invalid.emitters[0].path=[{x:null,y:0}];await page.getByLabel('Particle effect JSON',{exact:true}).setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(invalid))});await page.getByRole('button',{name:'Import effect',exact:true}).click();await expect(page.locator('.particle-dialog [role="status"]')).toContainText('Invalid particle path');await expect(page.getByLabel('Follow emitter path',{exact:true})).toBeChecked();
 await page.getByRole('button',{name:'Generate frames',exact:true}).click();await expect(page.locator('.particle-dialog [role="status"]')).toContainText('Generated');await page.getByRole('button',{name:'Remove generated layer',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.pskl.app.piskelController.getPiskel().getLayers().length)).toBe(1);await page.waitForTimeout(150);await page.getByRole('button',{name:'Undo',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.pskl.app.piskelController.getPiskel().getLayers().length)).toBe(2);
});
test('locked preview artwork respects nested layer visibility and opacity',async({page})=>{
 await setup(page);await page.getByLabel('Close Particle Studio',{exact:true}).click();await page.waitForFunction(()=>!window.pskl.app.dialogsController.currentDialog_);
 await page.evaluate(()=>{const s=window.pskl,c=s.app.piskelController,p=c.getPiskel(),l=p.getLayerAt(0),g=s.model.Layer.fromFrames('Group',[new s.model.Frame(32,32),new s.model.Frame(32,32)]);g.rowState={id:'group',groupNodeId:'group',isGroup:true,hidden:true};l.rowState.parentGroup='group';p.addLayer(g);c.setPiskel(p);});
 await page.getByRole('button',{name:'Particle Studio',exact:true}).click();await page.getByLabel('Enable Fire',{exact:true}).uncheck();
 const pixels=await page.getByLabel('Particle canvas',{exact:true}).evaluate((c:HTMLCanvasElement)=>Array.from(c.getContext('2d')!.getImageData(0,0,32,32).data));expect(pixels.every((p:number)=>p===0)).toBe(true);
});
test('particle window geometry does not leak into Puppet or import dialogs',async({page})=>{await setup(page);const grip=(await page.getByLabel('Resize Particle Studio',{exact:true}).boundingBox())!;await page.mouse.move(grip.x+5,grip.y+5);await page.mouse.down();await page.mouse.move(grip.x-200,grip.y-100);await page.mouse.up();await page.getByLabel('Close Particle Studio',{exact:true}).click();await page.waitForFunction(()=>!window.pskl.app.dialogsController.currentDialog_);await page.getByRole('button',{name:'Puppet Studio',exact:true}).click();await page.getByRole('button',{name:'Start rigging',exact:true}).click();const r=(await page.locator('#dialog-container').boundingBox())!;expect(r.width).toBeGreaterThan(900);expect(r.height).toBeGreaterThan(500);expect(await page.locator('#dialog-container').getAttribute('style')).toBe('');});

test('an older workspace keeps its layout and the Studios panel can move and persist independently', async ({page}) => {
 await page.addInitScript(()=>{if(!localStorage.getItem('student-pixel.workspace.v1'))localStorage.setItem('student-pixel.workspace.v1',JSON.stringify({version:1,tools:'left',preview:'right',left:['transform'],right:['palettes','options'],top:[],bottom:['frames','layers']}));});
 await openEditorWithSettledCanvas(page);
 await expect(page.locator('[data-dock="left"] [data-workspace-panel="transform"]')).toBeVisible();
 await expect(page.locator('[data-dock="right"] .studio-panel')).toBeVisible();
 const h=(await page.getByRole('button',{name:'Move Studios panel',exact:true}).boundingBox())!,target=(await page.locator('[data-workspace-panel="transform"]').boundingBox())!;
 await page.mouse.move(h.x+h.width/2,h.y+h.height/2);await page.mouse.down();await page.mouse.move(target.x+80,target.y+target.height+30,{steps:12});await expect(page.locator('[data-drop-zone="left"]')).toHaveClass(/workspace-drop-active/);await page.mouse.up();
 await expect(page.locator('[data-dock="left"] .studio-panel')).toBeVisible();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('student-pixel.workspace.v1')!).left)).toEqual(['transform','studios']);
 await page.reload();await expect(page.locator('[data-dock="left"] .studio-panel')).toBeVisible();
 await page.getByRole('button',{name:'Particle Studio',exact:true}).click();await expect(page.getByRole('dialog',{name:'Particle Studio',exact:true})).toBeVisible();
});

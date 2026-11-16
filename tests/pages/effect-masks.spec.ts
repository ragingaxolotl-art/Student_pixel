import {test,expect,Page} from '@playwright/test';
import fs from 'node:fs/promises';
async function open(page:Page,baseURL:string|undefined){await page.goto(baseURL!);await expect(page.locator('.workspace-enabled')).toBeVisible();await expect(page.locator('#loading-mask')).toBeHidden();}
async function pixels(page:Page,preview=false){return page.evaluate(preview=>{const s=window.pskl,c=preview?document.querySelector('.layer-result-preview canvas') as HTMLCanvasElement:s.app.piskelController.renderFrameAt(0,true);return Array.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data);},preview);}
async function seed(page:Page,group=false){await page.evaluate(group=>{
 const s=window.pskl,make=(name:string)=>s.model.Layer.fromFrames(name,[new s.model.Frame(16,16),new s.model.Frame(16,16)]),back=make('Background'),art=make('Character'),ink=make('FX paint');
 for(let n=0;n<2;n++)for(let y=0;y<16;y++)for(let x=0;x<16;x++){back.frames[n].setPixel(x,y,0xff20a030);if(x>=5&&x<=10&&y>=3&&y<=12)art.frames[n].setPixel(x,y,0xffc08040);if(x>=2&&x<=7&&y>=1&&y<=14)ink.frames[n].setPixel(x,y,0xff8040c0);}
 const layers=[back,art];if(group){const inner=make('Nested'),folder=make('Character group');inner.rowState.isGroup=folder.rowState.isGroup=true;art.rowState.parentGroup=s.utils.LayerGroupUtils.id(inner);inner.rowState.parentGroup=s.utils.LayerGroupUtils.id(folder);layers.push(inner,folder);}layers.push(ink);
 s.app.piskelController.setPiskel(s.model.Piskel.fromLayers(layers,0,{name:'FX mask test',description:''}));s.app.piskelController.setCurrentLayerIndex(layers.length-1);
},group);}
async function fx(page:Page,operation:string){await page.getByRole('button',{name:'Layer effects',exact:true}).first().click();await page.getByLabel('Effect',{exact:true}).selectOption(operation);}
async function apply(page:Page){await page.locator('.layer-result-actions .layer-apply').click();await expect(page.locator('#layer-options')).toBeHidden();}

test('effect-only Difference hides source overhang, affects only the target, and survives toggles, editing, undo and saves',async({page,baseURL})=>{
 await open(page,baseURL);await seed(page);const original=await pixels(page),raw=await page.evaluate(()=>window.pskl.app.piskelController.getPiskel().getLayers().map((l:any)=>Array.from(l.frames[0].pixels)));
 await fx(page,'difference');await page.getByLabel('Effect only (hide source artwork)',{exact:true}).check();const pending=await pixels(page,true);expect(await pixels(page)).toEqual(original);await apply(page);expect(await pixels(page)).toEqual(pending);
 await page.keyboard.press((process.platform==='darwin'?'Meta':'Control')+'+z');await expect.poll(()=>pixels(page)).toEqual(original);await page.waitForTimeout(60);await page.keyboard.press((process.platform==='darwin'?'Meta':'Control')+'+y');await expect.poll(()=>pixels(page)).toEqual(pending);
 const at=(x:number,y:number)=>(y*16+x)*4;expect(pending.slice(at(2,6),at(2,6)+4)).toEqual([48,160,32,255]);expect(pending.slice(at(6,6),at(6,6)+4)).toEqual([128,64,64,255]);
 const dot=page.locator('.layer-effect-marker');await dot.click();const off=await pixels(page);expect(off.slice(at(2,6),at(2,6)+4)).toEqual([48,160,32,255]);await dot.click();expect(await pixels(page)).toEqual(pending);
 await dot.focus();await dot.press('F2');await expect(page.getByLabel('Effect only (hide source artwork)',{exact:true})).toBeChecked();await page.getByLabel('Feather (pixels)',{exact:true}).fill('2');const feathered=await pixels(page,true);expect(feathered).not.toEqual(pending);await page.locator('.layer-result-actions .layer-cancel').click();expect(await pixels(page)).toEqual(pending);
 expect(await page.evaluate(()=>window.pskl.app.piskelController.getPiskel().getLayers().map((l:any)=>Array.from(l.frames[0].pixels)))).toEqual(raw);
 const saved=await page.evaluate(async()=>{const s=window.pskl,p=s.app.piskelController.getPiskel(),data=s.utils.serialization.Serializer.serialize(p),copy=await new Promise<any>((resolve,reject)=>s.utils.serialization.Deserializer.deserialize(JSON.parse(data),resolve,reject));s.app.piskelController.setPiskel(copy);return copy.getLayers().at(-1).rowState;});expect(saved.effectOnly).toBe(true);expect(await pixels(page)).toEqual(pending);
});

for(const group of [false,true])test(`painted opacity mask on ${group?'nested group':'layer'} preserves partial alpha, feathering and inverse`,async({page,baseURL})=>{
 await open(page,baseURL);await seed(page,group);await page.evaluate(()=>{const s=window.pskl,c=s.app.piskelController,p=c.getPiskel(),mask=p.getLayers().at(-1);mask.setName('Painted mask');mask.frames.forEach((f:any)=>{f.clear();for(let y=0;y<16;y++)for(let x=0;x<16;x++)f.setPixel(x,y,x<6?0:x<8?0x80000000:0xff000000);});c.setCurrentLayerIndex(p.getLayers().length-2);});
 await page.getByRole('button',{name:'Layer effects',exact:true}).nth(1).click();await page.getByLabel('Effect',{exact:true}).selectOption('mask');await page.getByLabel('Mask layer',{exact:true}).selectOption({label:'Painted mask'});await expect(page.getByLabel('Hide mask artwork',{exact:true})).toBeChecked();const preview=await pixels(page,true);await apply(page);expect(await pixels(page)).toEqual(preview);
 const at=(x:number,y:number)=>(y*16+x)*4;expect(preview.slice(at(5,6),at(5,6)+4)).toEqual([48,160,32,255]);expect(preview.slice(at(9,6),at(9,6)+4)).toEqual([64,128,192,255]);expect(preview[at(6,6)]).toBeGreaterThan(48);expect(preview[at(6,6)]).toBeLessThan(64);
 const dot=page.locator('.layer-effect-marker');await dot.focus();await dot.press('F2');await page.getByLabel('Feather (pixels)',{exact:true}).fill('1');const feather=await pixels(page,true);expect(feather).not.toEqual(preview);await apply(page);expect(await pixels(page)).toEqual(feather);
 await page.locator('.layer-effect-marker').press('F2');await page.getByLabel('Effect',{exact:true}).selectOption('maskInverse');await page.getByLabel('Feather (pixels)',{exact:true}).fill('0');const inverse=await pixels(page,true);expect(inverse.slice(at(5,6),at(5,6)+4)).toEqual([64,128,192,255]);await apply(page);expect(await pixels(page)).toEqual(inverse);
});

test('Create & paint mask selects a paintable source inside its group and supports partial-opacity brush paint',async({page,baseURL})=>{
 await open(page,baseURL);await seed(page,true);await page.evaluate(()=>{const c=window.pskl.app.piskelController;c.getPiskel().getLayers().pop();c.setCurrentLayerIndex(c.getLayers().length-1);window.$.publish(window.Events.PISKEL_RESET);});
 await fx(page,'mask');await page.getByRole('button',{name:'Create & paint mask',exact:true}).click();await expect(page.locator('#layer-options')).toBeHidden();expect(await page.evaluate(()=>window.pskl.app.piskelController.getCurrentLayer().getName())).toBe('Character group · mask');
 const picker=page.locator('[data-test-id="primary-color-picker"]').locator('..').locator('.sp-replacer');await picker.click();await page.locator('.sp-container:not(.sp-hidden) .sp-input').fill('rgba(255,255,255,0.5)');await page.locator('.sp-container:not(.sp-hidden) .sp-input').press('Enter');await page.evaluate(()=>window.$('#color-picker').spectrum('hide'));
 expect(await page.evaluate(()=>window.pskl.app.selectedColorsService.getPrimaryColor())).toContain('0.5');
 const b=(await page.locator('#drawing-canvas-container').boundingBox())!,size=Math.min(b.width,b.height),x=b.x+(b.width-size)/2+6.5*size/16,y=b.y+(b.height-size)/2+6.5*size/16;
 await page.mouse.click(x,y);expect(await page.evaluate(()=>window.pskl.app.piskelController.getCurrentFrame().getPixel(6,6)>>>24)).toBe(128);
 const image=await pixels(page);expect(image[(6*16+6)*4]).toBeGreaterThan(48);expect(image[(6*16+6)*4]).toBeLessThan(64);
 await page.locator('[data-setting="save"]').click();const pending=page.waitForEvent('download');await page.locator('[data-test-id="save-file-download-button"]').click();const file=await pending,data=JSON.parse(await fs.readFile((await file.path())!,'utf8'));expect(data.piskel.layers).toHaveLength(5);
 await page.evaluate(async data=>{const s=window.pskl,p=await new Promise<any>((resolve,reject)=>s.utils.serialization.Deserializer.deserialize(data,resolve,reject));s.app.piskelController.setPiskel(p);},data);expect(await pixels(page)).toEqual(image);
 await page.screenshot({path:test.info().outputPath('painted-group-mask.png')});
});

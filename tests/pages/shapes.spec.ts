import {test, expect, Page} from '@playwright/test';
import {openEditor, clickTool, undo, redo, downloadPiskelFile, importPiskelFile} from './editor-helpers';

async function setup(page:Page, tool:string, background=false) {
  await page.setViewportSize({width:1280,height:850});
  await openEditor(page);
  await page.evaluate(background=>{
    const s=window.pskl,f=new s.model.Frame(16,16);
    if(background)for(let y=0;y<16;y++)for(let x=0;x<16;x++)f.setPixel(x,y,'#00ff00');
    s.app.piskelController.setPiskel(s.model.Piskel.fromLayers([s.model.Layer.fromFrames('Shape art',[f])],12,{name:'Shape colors',description:''}));
  },background);
  // The editor schedules a relayout 200ms after replacing a project.
  await page.waitForTimeout(250);
  await clickTool(page,tool);
}
async function color(page:Page,kind:string,value:string) {
  await page.getByRole('button',{name:kind==='outline'?'Outline color':'Fill color',exact:true}).click();
  const input=page.locator('.sp-container:not(.sp-hidden) .sp-input');
  await input.fill(value);
  await input.press('Enter');
  await page.evaluate(kind=>(window as any).$('#shape-'+kind+'-color').spectrum('hide'),kind);
}
async function drag(page:Page, from=[3,3],to=[11,11],options:{button?:'left'|'right',shift?:boolean}={}) {
  const points=await page.evaluate(({from,to})=>{
    const d=window.pskl.app.drawingController;
    return [d.getScreenCoordinates(from[0],from[1]),d.getScreenCoordinates(to[0],to[1])];
  },{from,to});
  await page.mouse.move(points[0].x,points[0].y);
  await expect(page.locator('.tooltip')).toHaveCount(0);
  if(options.shift)await page.keyboard.down('Shift');
  await page.mouse.down({button:options.button||'left'});
  await page.mouse.move(points[1].x,points[1].y,{steps:8});
  return async()=>{
    await page.mouse.up({button:options.button||'left'});
    if(options.shift)await page.keyboard.up('Shift');
  };
}
const pixel=(page:Page,x:number,y:number)=>page.evaluate(({x,y})=>window.pskl.app.piskelController.getCurrentFrame().getPixel(x,y),{x,y});
const pixels=(page:Page)=>page.evaluate(()=>Array.from(window.pskl.app.piskelController.getCurrentFrame().pixels));
async function historyReady(page:Page,delta:number) {
  await expect.poll(()=>page.evaluate(delta=>{
    const h=window.pskl.app.historyService;return h.isLoadStateAllowed_(h.currentIndex+delta);
  },delta)).toBe(true);
}

for(const tool of ['tool-rectangle','tool-circle']) {
  test(`${tool} shows inline options, starts empty and preserves interior artwork`,async({page})=>{
    await setup(page,tool,true);
    await expect(page.getByLabel('Shape fill',{exact:true})).toHaveValue('empty');
    await expect(page.getByRole('button',{name:'Fill color',exact:true})).toHaveAttribute('aria-disabled','true');
    const header=(await page.locator('[data-test-id="app-header"]').boundingBox())!,control=(await page.locator('#shape-controls').boundingBox())!;
    expect(header.height).toBe(40);expect(control.y).toBeGreaterThanOrEqual(header.y);expect(control.y+control.height).toBeLessThanOrEqual(header.y+header.height);
    await color(page,'outline','#ff0000');
    await(await drag(page))();
    expect(await pixel(page,7,7)).toBe(0xff00ff00);
    expect(await pixel(page,7,3)).toBe(0xff0000ff);
    await clickTool(page,'tool-dithering');
    await expect(page.locator('#shape-options')).toBeHidden();
    await expect(page.locator('#dither-options')).toBeVisible();
  });
  test(`${tool} previews two colors, commits once, and keeps its fill through undo/redo`,async({page})=>{
    await setup(page,tool);
    await page.getByLabel('Shape fill',{exact:true}).selectOption('solid');
    await color(page,'outline','#ff0000');await color(page,'fill','#0000ff');
    const finish=await drag(page);
    const preview=await page.evaluate(()=>Array.from(window.pskl.app.drawingController.overlayFrame.pixels));
    await finish();
    expect(await pixel(page,7,7)).toBe(0xffff0000);
    expect(await pixel(page,7,3)).toBe(0xff0000ff);
    const committed=await pixels(page);expect(committed).toEqual(preview);
    await page.getByLabel('Shape fill',{exact:true}).selectOption('empty');
    await page.locator('.piskel-name').click();
    await historyReady(page,-1);await undo(page);await expect.poll(async()=> (await pixels(page)).some(Boolean)).toBe(false);
    await historyReady(page,1);await redo(page);await expect.poll(()=>pixels(page)).toEqual(committed);
  });
  test(`${tool} fill-only uses its fill color without an outline and shift keeps equal proportions`,async({page})=>{
    await setup(page,tool);
    await page.getByLabel('Shape fill',{exact:true}).selectOption('fill-only');
    await expect(page.getByLabel('Shape outline width',{exact:true})).toBeDisabled();
    await color(page,'fill','#0000ff');
    await(await drag(page,[3,3],[11,8],{shift:true}))();
    expect(await pixel(page,6,6)).toBe(0xffff0000);
    const bounds=await page.evaluate(()=>{
      const f=window.pskl.app.piskelController.getCurrentFrame(),list=[];
      for(let y=0;y<16;y++)for(let x=0;x<16;x++)if(f.getPixel(x,y))list.push({x,y});
      return {xs:list.map(p=>p.x),ys:list.map(p=>p.y),onlyBlue:list.every(p=>f.getPixel(p.x,p.y)===0xffff0000)};
    });
    expect(Math.max(...bounds.xs)-Math.min(...bounds.xs)).toBe(5);
    expect(Math.max(...bounds.ys)-Math.min(...bounds.ys)).toBe(5);
    expect(bounds.onlyBlue).toBe(true);
  });
}

test('top border width syncs with pen size, colors support alpha and project export/import preserves pixels',async({page})=>{
  await setup(page,'tool-rectangle');
  await page.getByLabel('Shape fill',{exact:true}).selectOption('solid');
  await color(page,'outline','#ff0000');await color(page,'fill','rgba(0,0,255,0.5)');
  await page.getByLabel('Shape outline width',{exact:true}).fill('2');
  await page.getByLabel('Shape fill',{exact:true}).focus();
  expect(await page.evaluate(()=>window.pskl.app.penSizeService.getPenSize())).toBe(2);
  await(await drag(page))();
  expect(await pixel(page,7,4)).toBe(0xff0000ff);
  expect(await pixel(page,7,7)).toBe(0x80ff0000);
  const before=await pixels(page),file=await downloadPiskelFile(page);
  await importPiskelFile(page,file);expect(await pixels(page)).toEqual(before);
});

test('each shape starts empty, remembers session choices, and fresh reload restores empty defaults',async({page})=>{
  await setup(page,'tool-rectangle');
  await page.getByLabel('Shape fill',{exact:true}).selectOption('solid');
  await clickTool(page,'tool-circle');await expect(page.getByLabel('Shape fill',{exact:true})).toHaveValue('empty');
  await clickTool(page,'tool-rectangle');await expect(page.getByLabel('Shape fill',{exact:true})).toHaveValue('solid');
  await page.reload();await clickTool(page,'tool-rectangle');await expect(page.getByLabel('Shape fill',{exact:true})).toHaveValue('empty');
});

test('compact shape options fit a small window and color pickers work with the keyboard',async({page})=>{
  await page.setViewportSize({width:600,height:760});await openEditor(page);await clickTool(page,'tool-circle');
  await page.locator('.shape-compact').click();
  const controls=(await page.locator('#shape-controls').boundingBox())!;expect(controls.x).toBeGreaterThanOrEqual(0);expect(controls.x+controls.width).toBeLessThanOrEqual(600);
  await page.getByLabel('Shape fill',{exact:true}).selectOption('solid');
  await page.getByRole('button',{name:'Fill color',exact:true}).focus();await page.keyboard.press('Enter');
  await expect(page.locator('.sp-container:not(.sp-hidden)')).toBeVisible();
  await page.locator('.sp-container:not(.sp-hidden) .sp-input').fill('#00ff00');await page.keyboard.press('Enter');
  await page.evaluate(()=>(window as any).$('#shape-fill-color').spectrum('hide'));
  expect(await page.evaluate(()=>window.pskl.app.toolController.currentSelectedTool.fillColor)).toBe('rgb(0, 255, 0)');
  await clickTool(page,'tool-pen');await expect(page.locator('#shape-options')).toBeHidden();
});

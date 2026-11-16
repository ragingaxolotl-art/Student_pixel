import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';

test('full browser storage keeps existing data and still starts the canvas, tools and studios',async({page,baseURL})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('existing-artwork-do-not-remove','saved artwork sentinel');
    let key=0;
    for(const length of [1048576,65536,4096,256,16,1]){
      const value='x'.repeat(length);
      for(let i=0;i<128;i++){
        try{localStorage.setItem('q'+key++,value);}catch{break;}
      }
    }
  });
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(baseURL!);
  await expect(page.locator('#tools-container li')).toHaveCount(15);
  await expect(page.locator('.layer-item')).toHaveCount(1);
  await expect(page.locator('.preview-tile')).toHaveCount(1);
  await expect(page.locator('#drawing-canvas-container .drawing-canvas')).toBeVisible();
  await expect(page.locator('#user-message')).toContainText('preferences');
  expect(await page.evaluate(()=>localStorage.getItem('existing-artwork-do-not-remove'))).toBe('saved artwork sentinel');
  expect(await page.evaluate(()=>{try{localStorage.setItem('write-must-still-fail','x');return false;}catch{return true;}})).toBe(true);
  await page.locator('#user-message .close').click();
  await page.locator('[data-tool-id="tool-rectangle"]').click();
  const box=(await page.locator('#drawing-canvas-container').boundingBox())!;
  const size=Math.min(box.width,box.height),left=box.x+(box.width-size)/2,top=box.y+(box.height-size)/2;
  await page.mouse.move(left+size*.25,top+size*.3);await page.mouse.down();await page.mouse.move(left+size*.75,top+size*.65,{steps:5});await page.mouse.up();
  expect(await page.evaluate(()=>Array.from(window.pskl.app.piskelController.getCurrentFrame().getPixels()).some(c=>(Number(c)>>>24)>0))).toBe(true);
  await page.locator('[data-tool-id="tool-rotate-45"]').click();
  await page.getByRole('button',{name:'Add layer',exact:true}).click();
  await expect(page.locator('.layer-item')).toHaveCount(2);
  await page.getByRole('button',{name:'Layer effects',exact:true}).first().click();
  await page.getByLabel('Effect',{exact:true}).selectOption('invert');
  await expect(page.locator('.layer-result-actions .layer-apply')).toBeEnabled();
  await page.locator('.layer-result-actions .layer-cancel').click();
  await page.getByRole('button',{name:'Particle Studio',exact:true}).click();
  await page.getByRole('button',{name:'Save effect',exact:true}).click();
  await expect(page.locator('.particle-dialog [role="status"]')).toContainText('Effect saved');
  await page.getByRole('button',{name:'Generate frames',exact:true}).click();
  await expect(page.locator('.particle-dialog [role="status"]')).toContainText('Generated');
  expect(await page.evaluate(()=>window.pskl.app.piskelController.getPiskel().getFrameCount())).toBe(24);
  const serialized=await page.evaluate(()=>window.pskl.utils.serialization.Serializer.serialize(window.pskl.app.piskelController.getPiskel()));
  expect(JSON.parse(serialized).piskel).toBeTruthy();
  await page.getByRole('button',{name:'Close Particle Studio',exact:true}).click();
  await page.waitForFunction(()=>!window.pskl.app.dialogsController.currentDialog_);
  await page.locator('[data-setting="save"]').click();
  const downloading=page.waitForEvent('download');
  await page.locator('[data-test-id="save-file-download-button"]').click();
  const downloaded=await downloading;
  const saved=JSON.parse(await fs.readFile((await downloaded.path())!,'utf8'));
  expect(saved.piskel.layers).toHaveLength(3);
  expect(saved.piskel.toolState.particleStudio.frames).toBe(24);
  expect(await page.evaluate(()=>localStorage.getItem('existing-artwork-do-not-remove'))).toBe('saved artwork sentinel');
  expect(errors).toEqual([]);
});

test('damaged JSON preferences fall back to defaults without preventing startup',async({page,baseURL})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('DEFAULT_SIZE','{broken');
    localStorage.setItem('PEN_SIZE','undefined');
    localStorage.setItem('GRID_ENABLED','bad json');
  });
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(baseURL!);
  await expect(page.locator('#tools-container li')).toHaveCount(15);
  await expect(page.locator('.workspace-enabled')).toBeVisible();
  expect(await page.evaluate(()=>({width:window.pskl.app.piskelController.getCurrentFrame().getWidth(),height:window.pskl.app.piskelController.getCurrentFrame().getHeight(),pen:window.pskl.UserSettings.get(window.pskl.UserSettings.PEN_SIZE)}))).toEqual({width:32,height:32,pen:1});
  expect(errors).toEqual([]);
});

import { test, expect } from '@playwright/test';

async function open(page: any, baseURL: string | undefined) {
  await page.goto(baseURL!);
  await page.waitForFunction(() => !!window.pskl?.app?.piskelController);
  await expect(page.locator('#loading-mask')).toBeHidden();
  await expect(page.locator('#drawing-canvas-container .drawing-canvas')).toBeVisible();
}

test('project-path assets load and frames/layers stay beneath the drawing area', async ({ page, baseURL }) => {
  const failures: string[] = [], errors: string[] = [];
  page.on('response', response => { if (response.url().startsWith(baseURL!) && response.status() >= 400) failures.push(response.url()); });
  page.on('pageerror', error => errors.push(error.message));
  await open(page, baseURL);
  const layout = await page.evaluate(() => {
    const canvas = document.querySelector('#drawing-canvas-container')!.getBoundingClientRect(), frames = document.querySelector('.frames-column')!.getBoundingClientRect(), layers = document.querySelector('.layers-column')!.getBoundingClientRect();
    return { canvasBottom:canvas.bottom, framesTop:frames.top, framesBottom:frames.bottom, layersTop:layers.top };
  });
  expect(layout.framesTop).toBeGreaterThanOrEqual(layout.canvasBottom - 2);
  expect(layout.layersTop).toBeGreaterThanOrEqual(layout.framesBottom - 2);
  expect(failures).toEqual([]); expect(errors).toEqual([]);
});

test('45-degree controls keep a rectangle exact after a full turn', async ({ page, baseURL }) => {
  await open(page, baseURL);
  const original = await page.evaluate(() => {
    const s=window.pskl,f=new s.model.Frame(8,8);
    for(let y=2;y<4;y++)for(let x=1;x<7;x++)f.setPixel(x,y,0xffff8040);
    const p=s.model.Piskel.fromLayers([s.model.Layer.fromFrames('Rectangle',[f])],12,{name:'Rectangle',description:''});
    s.app.piskelController.setPiskel(p); return Array.from(f.getPixels());
  });
  for(let i=0;i<8;i++)await page.locator('[data-tool-id="tool-rotate-45"]').click();
  expect(await page.evaluate(() => Array.from(window.pskl.app.piskelController.getPiskel().getLayerAt(0).getFrameAt(0).getPixels()))).toEqual(original);
});

test('a locked pose does not lock the next marker and survives project serialization', async ({ page, baseURL }) => {
  await open(page, baseURL);
  await page.evaluate(() => {
    const s=window.pskl,p=s.app.piskelController.getPiskel(),r=s.utils.RigStudioUtils.template('humanoid',32,32);
    r.skin=false;r.poses=[{id:'rest',name:'Rest',values:{}},{id:'next',name:'Next',values:{}}];
    r.clips[0].keys=[{at:0,pose:'rest',easing:'linear'},{at:1,pose:'next',easing:'linear'},{at:10,pose:'rest',easing:'linear'}];p.toolState.rigStudio=r;
  });
  await page.getByRole('button',{name:'Puppet Studio',exact:true}).click();
  await page.getByRole('button',{name:'Start rigging',exact:true}).click();
  await page.getByRole('button',{name:'Pose',exact:true}).click();
  await page.getByLabel('Selected bone',{exact:true}).selectOption({label:'Left shin'});
  await page.getByRole('button',{name:'Lock joint',exact:true}).click();
  await expect(page.getByRole('button',{name:'Unlock joint',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'key pose at frame 2',exact:true}).click();
  await expect(page.getByRole('button',{name:'Lock joint',exact:true})).toBeVisible();
  const locks=await page.evaluate(async()=>{
    const s=window.pskl,p=s.app.piskelController.getPiskel(),data=s.utils.serialization.Serializer.serialize(p),copy=await new Promise<any>((resolve,reject)=>s.utils.serialization.Deserializer.deserialize(JSON.parse(data),resolve,reject)),rig=copy.toolState.rigStudio,b=rig.bones.find((b:any)=>b.name==='Left shin');
    return rig.clips[0].keys.map((k:any)=>!!s.utils.RigStudioUtils.jointPin(b,rig.poses.find((p:any)=>p.id===k.pose).values));
  });
  expect(locks.filter(Boolean)).toHaveLength(1);
});

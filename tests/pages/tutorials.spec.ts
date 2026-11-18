import {test,expect} from '@playwright/test';
import {openEditor} from './editor-helpers';
test('Tutorials beside Clips describes and plays rigging, motion path and pelvis lessons without editing the project',async({page})=>{
 await openEditor(page);await page.getByRole('button',{name:'Puppet Studio',exact:true}).click();await page.getByRole('button',{name:'Start rigging',exact:true}).click();
 const before=await page.evaluate(()=>window.pskl.utils.serialization.Serializer.serialize(window.pskl.app.piskelController.getPiskel()));
 const order=await page.locator('.puppet-top').evaluate(e=>Array.from(e.children).map(n=>n.textContent?.trim()));expect(order[2]).toMatch(/^Clips/);expect(order[3]).toBe('Tutorials');
 await page.getByRole('button',{name:'Tutorials',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Puppet Studio tutorials',exact:true});await expect(dialog).toBeVisible();
 const video=dialog.locator('video');
 for(const [title,duration,description] of [
  ['Rigging and adjusting joints',169.726,'fit pivots and bone lengths'],
  ['Joint motion paths and settings',275.25,'Draw and edit a path'],
  ['Connect both legs to a pelvis',33,'attach both legs']
 ] as const){
  await dialog.getByRole('combobox',{name:'Tutorial topic'}).selectOption({label:title});
  await expect(dialog.locator('.puppet-tutorial-description')).toContainText(description);
  await expect(dialog.locator('h4')).toHaveText(title);
  await expect.poll(()=>video.evaluate((v:HTMLVideoElement)=>v.readyState)).toBeGreaterThanOrEqual(1);
  expect(await video.evaluate((v:HTMLVideoElement)=>v.duration)).toBeCloseTo(duration,0);
  await video.evaluate((v:HTMLVideoElement)=>v.play());await expect.poll(()=>video.evaluate((v:HTMLVideoElement)=>v.currentTime)).toBeGreaterThan(.1);
  await video.evaluate((v:HTMLVideoElement)=>{v.currentTime=v.duration-2});
  await expect.poll(()=>video.evaluate((v:HTMLVideoElement)=>v.currentTime)).toBeGreaterThan(duration-3);
 }
 await page.getByRole('button',{name:'Close tutorial',exact:true}).click();await expect(dialog).toHaveCount(0);expect(await page.evaluate(()=>window.pskl.utils.serialization.Serializer.serialize(window.pskl.app.piskelController.getPiskel()))).toBe(before);
 await page.getByRole('button',{name:'Tutorials',exact:true}).click();await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(page.locator('.puppet-dialog')).toBeVisible();
});

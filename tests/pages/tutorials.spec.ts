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
  ['Joints & Layers',253.294,'Includes step-by-step demonstrations'],
  ['Joint motion paths and settings',275.25,'Draw and edit a path'],
  ['Connect both legs to a pelvis',33,'attach both legs']
 ] as const){
  await dialog.getByRole('combobox',{name:'Tutorial topic'}).selectOption({label:title});
  await expect(dialog.locator('.puppet-tutorial-description')).toContainText(description);
  await expect(dialog.getByRole('heading',{name:title,exact:true})).toBeVisible();
  await expect.poll(()=>video.evaluate((v:HTMLVideoElement)=>v.readyState)).toBeGreaterThanOrEqual(1);
  expect(await video.evaluate((v:HTMLVideoElement)=>v.duration)).toBeCloseTo(duration,0);
  await video.evaluate((v:HTMLVideoElement)=>v.play());await expect.poll(()=>video.evaluate((v:HTMLVideoElement)=>v.currentTime)).toBeGreaterThan(.1);
  const chapters=dialog.getByRole('navigation',{name:'Tutorial chapters'}).getByRole('button');
  expect(await chapters.count()).toBeGreaterThanOrEqual(5);
  for(const index of [Math.floor(await chapters.count()/2),0,(await chapters.count())-1]){
   const chapter=chapters.nth(index),at=Number(await chapter.getAttribute('data-chapter-at'));
   await chapter.click();
   await expect.poll(()=>video.evaluate((v:HTMLVideoElement)=>v.currentTime)).toBeGreaterThanOrEqual(at);
   await expect(chapter).toHaveAttribute('aria-current','true');
   expect(await video.evaluate((v:HTMLVideoElement)=>v.currentTime)).toBeLessThan(at+4);
  }
 }
 await page.setViewportSize({width:700,height:900});
 const chapterList=dialog.getByRole('navigation',{name:'Tutorial chapters'});await chapterList.getByRole('button').last().click();
 const bounds=await chapterList.boundingBox();expect(bounds!.width).toBeLessThan(700);
 await page.screenshot({path:test.info().outputPath('tutorial-chapters-narrow.png')});
 await page.getByRole('button',{name:'Close tutorial',exact:true}).click();await expect(dialog).toHaveCount(0);expect(await page.evaluate(()=>window.pskl.utils.serialization.Serializer.serialize(window.pskl.app.piskelController.getPiskel()))).toBe(before);
 await page.getByRole('button',{name:'Tutorials',exact:true}).click();await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(page.locator('.puppet-dialog')).toBeVisible();
});

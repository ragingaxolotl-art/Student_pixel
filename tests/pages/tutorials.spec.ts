import {test,expect} from '@playwright/test';
import {openEditor} from './editor-helpers';
test('Tutorials beside Clips plays the narrated pelvis recording and closes without editing the rig',async({page})=>{
 await openEditor(page);await page.getByRole('button',{name:'Puppet Studio',exact:true}).click();await page.getByRole('button',{name:'Start rigging',exact:true}).click();
 const before=await page.evaluate(()=>window.pskl.utils.serialization.Serializer.serialize(window.pskl.app.piskelController.getPiskel()));
 const order=await page.locator('.puppet-top').evaluate(e=>Array.from(e.children).map(n=>n.textContent?.trim()));expect(order[2]).toMatch(/^Clips/);expect(order[3]).toBe('Tutorials');
 await page.getByRole('button',{name:'Tutorials',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Puppet Studio tutorials',exact:true});await expect(dialog).toBeVisible();
 const video=dialog.locator('video');await expect.poll(()=>video.evaluate((v:any)=>v.readyState)).toBeGreaterThanOrEqual(1);expect(await video.evaluate((v:any)=>v.duration)).toBeCloseTo(33,0);await video.evaluate((v:any)=>v.play());await expect.poll(()=>video.evaluate((v:any)=>v.currentTime)).toBeGreaterThan(.1);
 await page.getByRole('button',{name:'Close tutorial',exact:true}).click();await expect(dialog).toHaveCount(0);expect(await page.evaluate(()=>window.pskl.utils.serialization.Serializer.serialize(window.pskl.app.piskelController.getPiskel()))).toBe(before);
 await page.getByRole('button',{name:'Tutorials',exact:true}).click();await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(page.locator('.puppet-dialog')).toBeVisible();
});

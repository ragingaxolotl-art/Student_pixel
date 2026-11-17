import {test,expect}from'@playwright/test';
import{openEditor,downloadPiskelFile,importPiskelFile}from'./editor-helpers';
test('Add unconnected joint places roots even over an existing bone, preserves existing joints, and supports undo and file reload',async({page})=>{
 await openEditor(page);await page.getByRole('button',{name:'Puppet Studio',exact:true}).click();await page.getByRole('button',{name:'Start rigging',exact:true}).click();
 const original=await page.evaluate(()=>window.pskl.app.piskelController.getPiskel().toolState.rigStudio.bones);
 await page.getByRole('button',{name:'Add unconnected joint',exact:true}).click();await expect(page.getByRole('tab',{name:'Setup rig',exact:true})).toHaveAttribute('aria-selected','true');
 const loc=page.locator('[data-art-preview="after"]');await loc.hover();const box=(await loc.boundingBox())!;const at=await page.evaluate(()=>{const s=window.pskl,r=s.app.piskelController.getPiskel().toolState.rigStudio,b=r.bones[0],w=s.utils.RigStudioUtils.world(r,{})[b.id];return{x:(w.start.x+w.end.x)/2,y:(w.start.y+w.end.y)/2,width:s.app.piskelController.getWidth(),height:s.app.piskelController.getHeight()};});
 await page.mouse.click(box.x+box.width*at.x/at.width,box.y+box.height*at.y/at.height);
 await expect.poll(()=>page.evaluate(()=>window.pskl.app.piskelController.getPiskel().toolState.rigStudio.bones.length)).toBe(original.length+1);
 const bones=await page.evaluate(()=>window.pskl.app.piskelController.getPiskel().toolState.rigStudio.bones);expect(bones.slice(0,-1).map(b=>({...b,layerName:b.layerName??null}))).toEqual(original.map(b=>({...b,layerName:b.layerName??null})));const added=bones.at(-1)!;expect(added.parent).toBeNull();expect(added.x).toBeCloseTo(at.x,1);expect(added.y).toBeCloseTo(at.y,1);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.pskl.app.piskelController.getPiskel().toolState.rigStudio.bones.length)).toBe(original.length);await page.getByRole('button',{name:'Redo',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.pskl.app.piskelController.getPiskel().toolState.rigStudio.bones.length)).toBe(original.length+1);
 await page.getByRole('button',{name:'Close Puppet Studio',exact:true}).click();const file=await downloadPiskelFile(page);await page.reload();await importPiskelFile(page,file);expect(await page.evaluate(()=>window.pskl.app.piskelController.getPiskel().toolState.rigStudio.bones.at(-1))).toEqual(added);
});

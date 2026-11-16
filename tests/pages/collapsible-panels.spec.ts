import {test,expect,Page} from '@playwright/test';
import {openEditor} from './editor-helpers';
const panel=(page:Page,id:string)=>page.locator(`[data-workspace-panel="${id}"]`);
const toggle=(page:Page,name:string,collapse=true)=>page.getByRole('button',{name:`${collapse?'Collapse':'Expand'} ${name} panel`,exact:true}).click();
const height=(page:Page,id:string)=>panel(page,id).evaluate(e=>e.getBoundingClientRect().height);
async function dock(page:Page,name:string,side:string) {
 await page.getByRole('button',{name:`Move ${name} panel`,exact:true}).click();
 await page.getByRole('button',{name:`Dock ${side}`,exact:true}).click();
}

test('all eight panels collapse to accessible headers and reopen at their previous size',async({page})=>{
 await openEditor(page);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.locator('.layer-fx').first().click();
 for(const [id,name,body] of [['tools','Tools','.sticky-section-wrap'],['preview','Preview','#animated-preview-container'],['frames','Frames','.preview-list-wrapper'],['layers','Layers','.layers-list-container'],['transform','Transform','.tools-wrapper'],['palettes','Palettes','.palettes-list-colors'],['studios','Studios','.studio-launchers'],['options','Layer options','#layer-options']]) {
  const before=await height(page,id);expect(before).toBeGreaterThan(32);
  await toggle(page,name);
  if(id==='tools') {
    expect((await panel(page,id).boundingBox())!.width).toBe(54);
    expect(await height(page,id)).toBe(before);
  } else expect(await height(page,id)).toBeLessThan(34);
  await expect(panel(page,id).locator(body)).toBeHidden();
  const expand=page.getByRole('button',{name:`Expand ${name} panel`,exact:true});await expect(expand).toHaveAttribute('aria-expanded','false');
  await expand.press('Enter');await expect(panel(page,id).locator(body)).toBeVisible();
  expect(await height(page,id)).toBe(before);
 }
 expect(errors).toEqual([]);
});

test('collapse states survive panel movement and reload without changing saved sizes or artwork',async({page})=>{
 await openEditor(page);
 const before=await page.evaluate(()=>{const s=window.pskl;s.app.piskelController.getCurrentFrame().setPixel(4,4,0xffab1234);return s.utils.serialization.Serializer.serialize(s.app.piskelController.getPiskel());});
 await page.getByRole('separator',{name:'Resize palettes height',exact:true}).focus();await page.keyboard.press('ArrowDown');
 const paletteHeight=await height(page,'palettes'),sizes=await page.evaluate(()=>window.pskl.UserSettings.get(window.pskl.UserSettings.WORKSPACE_LAYOUT));
 for(const name of ['Palettes','Frames','Tools'])await toggle(page,name);
 await dock(page,'Palettes','left');
 expect(await page.evaluate(()=>window.pskl.utils.serialization.Serializer.serialize(window.pskl.app.piskelController.getPiskel()))).toBe(before);
 await page.reload();await expect(panel(page,'palettes')).toHaveClass(/workspace-collapsed/);await expect(panel(page,'frames')).toHaveClass(/workspace-collapsed/);await expect(panel(page,'tools')).toHaveClass(/workspace-collapsed/);
 await expect(page.locator('[data-dock="left"] [data-workspace-panel="palettes"]')).toBeVisible();
 expect(await page.evaluate(()=>window.pskl.UserSettings.get(window.pskl.UserSettings.WORKSPACE_LAYOUT))).toEqual(sizes);
 await toggle(page,'Palettes',false);expect(await height(page,'palettes')).toBe(paletteHeight);
});

test('collapsed preview hides its tabs and preserves an unfinished effect; opening FX reveals collapsed options',async({page})=>{
 await openEditor(page);await page.locator('.layer-fx').first().click();await page.getByLabel('Effect',{exact:true}).selectOption('invert');
 const settings=await page.evaluate(()=>window.pskl.app.layersListController.options());
 await toggle(page,'Preview');await expect(page.locator('.layer-preview-tabs')).toBeHidden();await expect(page.locator('[data-workspace-resize="previewHeight"]')).toBeHidden();
 // Keep editing while Preview is collapsed: a hidden preview must not cache a zero-sized result.
 await page.getByLabel('Effect',{exact:true}).selectOption('grayscale');await page.getByLabel('Effect',{exact:true}).selectOption('invert');
 await toggle(page,'Preview',false);await expect(page.locator('.layer-preview-tabs')).toBeVisible();await expect(page.locator('.layer-result-preview canvas')).toBeVisible();
 expect(await page.evaluate(()=>window.pskl.app.layersListController.options())).toEqual(settings);
 await toggle(page,'Layer options');await page.locator('.layer-fx').first().click();
 await expect(panel(page,'options')).not.toHaveClass(/workspace-collapsed/);await expect(page.getByLabel('Effect',{exact:true})).toHaveValue('invert');
});

test('toolbar spans the full height and bottom rows stay between the sidebars at wide and narrow sizes',async({page})=>{
 await openEditor(page);
 for(const width of [1440,900]) {
  await page.setViewportSize({width,height:850});
  const boxes=await page.evaluate(()=>{
   const r=(q:string)=>{const b=document.querySelector(q)!.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom};};
   return {root:r('#main-wrapper'),tools:r('#tool-section'),frames:r('.frames-column'),layers:r('.layers-column'),right:r('[data-dock="right"].workspace-side')};
  });
  expect(boxes.tools.top).toBe(boxes.root.top);expect(boxes.tools.bottom).toBe(boxes.root.bottom);
  for(const row of [boxes.frames,boxes.layers]){expect(row.left).toBeGreaterThanOrEqual(boxes.tools.right);expect(row.right).toBeLessThanOrEqual(boxes.right.left);}
 }
 await page.setViewportSize({width:1440,height:850});await dock(page,'Tools','right');await dock(page,'Preview','left');
 const boxes=await page.evaluate(()=>{const p=window.pskl.app.workspaceController;return {frame:p.panels.frames.getBoundingClientRect().toJSON(),left:p.docks.left.root.getBoundingClientRect().toJSON(),right:p.docks.right.root.getBoundingClientRect().toJSON(),tools:p.panels.tools.getBoundingClientRect().toJSON(),root:p.root.getBoundingClientRect().toJSON()};});
 expect(boxes.frame.left).toBeGreaterThanOrEqual(boxes.left.right);expect(boxes.frame.right).toBeLessThanOrEqual(boxes.right.left);expect(boxes.tools.bottom).toBe(boxes.root.bottom);
});

test('placement menus and reset reopen panels, and collapse works when preference storage is blocked',async({page})=>{
 await page.addInitScript(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='student-pixel.workspace.v1')throw new DOMException('Blocked','SecurityError');return set.call(this,key,value);};});
 await openEditor(page);await toggle(page,'Layers');
 await page.getByRole('button',{name:'Move Layers panel',exact:true}).click();await page.getByRole('button',{name:'Expand panel',exact:true}).click();await expect(panel(page,'layers')).not.toHaveClass(/workspace-collapsed/);
 await toggle(page,'Tools');await page.getByRole('button',{name:'Expand Tools panel',exact:true}).press('Space');await expect(panel(page,'tools')).not.toHaveClass(/workspace-collapsed/);
 await toggle(page,'Frames');await page.getByRole('button',{name:'Move Frames panel',exact:true}).click();await page.getByRole('button',{name:'Reset layout',exact:true}).click();
 await expect(page.locator('.workspace-collapsed')).toHaveCount(0);await expect(page.getByRole('status').filter({hasText:'Browser storage is unavailable'})).toBeVisible();
});

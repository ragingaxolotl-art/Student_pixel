describe("Effect-only layers and painted group masks", function () {
  var u = pskl.utils, layers;
  function pixel(r,g,b,a) { return ((((a === undefined ? 255 : a) << 24) | (b << 16) | (g << 8) | r) >>> 0); }
  function layer(name, values) { return pskl.model.Layer.fromFrames(name,[pskl.model.Frame.fromPixelGrid(new Uint32Array(values),values.length,1)]); }
  function render() { return Array.from(new Uint32Array(u.LayerUtils.flattenFrameAt(layers,0,true,layers).getContext("2d").getImageData(0,0,layers[0].getFrameAt(0).getWidth(),1).data.buffer)); }
  function effect(target, operation, params) { target.rowState.effects=[{id:"test-effect",operation:operation,enabled:true,frame:null,params:Object.assign({amount:100,feather:0},params||{})}]; }
  it("Difference changes only the target, preserves target alpha and hides overhanging ink", function () {
    var base=layer("Target",[pixel(64,128,192,128),0]),ink=layer("Effect",[pixel(192,64,128),pixel(255,0,0)]);
    ink.rowState.effectOnly=true;effect(ink,"difference");layers=[base,ink];
    var before=Array.from(base.frames[0].pixels),out=render();
    expect(out[0]>>>24).toBe(128);expect(out[0]&255).toBe(128);expect((out[0]>>>8)&255).toBe(64);expect(out[1]).toBe(0);expect(Array.from(base.frames[0].pixels)).toEqual(before);
  });
  it("does not change a background outside the layer being affected",function(){
    var back=layer("Backdrop",[pixel(20,150,40),pixel(20,150,40)]),base=layer("Target",[pixel(64,128,192),0]),ink=layer("Effect",[pixel(192,64,128),pixel(255,0,0)]);
    ink.rowState.effectOnly=true;effect(ink,"difference");layers=[back,base,ink];expect(render()[1]).toBe(back.frames[0].pixels[1]);
  });
  it("keeps source artwork hidden when its FX dot is off",function(){
    var base=layer("Target",[pixel(10,50,90)]),ink=layer("Effect",[pixel(255,0,0)]);ink.rowState.effectOnly=true;effect(ink,"multiply");ink.rowState.effects[0].enabled=false;layers=[base,ink];expect(render()[0]).toBe(base.frames[0].pixels[0]);
  });
  it("uses source alpha, layer opacity and strength without changing target coverage",function(){
    var value=u.LayerMaskUtils.effectPixel(pixel(40,80,120,64),pixel(255,255,255,128),"difference",.5,.5);
    expect(value>>>24).toBe(64);expect(value&255).toBeCloseTo(62,0);
  });
  ["mask","maskInverse"].forEach(function(mode){
    it(mode+" respects full, half and empty mask paint on a nested group",function(){
      var art=layer("Art",[pixel(255,0,0),pixel(255,0,0),pixel(255,0,0)]),inner=layer("Inner",[0,0,0]),outer=layer("Outer",[0,0,0]),mask=layer("Paint mask",[pixel(0,0,0),pixel(255,255,255,128),0]);
      inner.rowState.isGroup=outer.rowState.isGroup=true;
      art.rowState.parentGroup=u.LayerGroupUtils.id(inner);inner.rowState.parentGroup=u.LayerGroupUtils.id(outer);mask.rowState.hidden=true;layers=[art,inner,outer,mask];
      effect(outer,mode,{maskId:u.LayerGroupUtils.id(mask),hideMask:true});
      expect(render().map(function(p){return p>>>24;})).toEqual(mode==="mask"?[255,128,0]:[0,127,255]);
      outer.rowState.collapsed=true;expect(render().map(function(p){return p>>>24;})).toEqual(mode==="mask"?[255,128,0]:[0,127,255]);
    });
  });
  it("can use a visible painted layer as mask without showing its colors",function(){
    var art=layer("Art",[pixel(255,0,0),pixel(255,0,0)]),mask=layer("Mask",[0,pixel(0,255,0,128)]);layers=[art,mask];effect(art,"mask",{maskId:u.LayerGroupUtils.id(mask),hideMask:true});var out=render();expect(out[0]).toBe(0);expect(out[1]>>>24).toBe(128);expect(out[1]&255).toBe(255);expect((out[1]>>>8)&255).toBe(0);
  });
  it("feather zero keeps exact pixels; positive feather softens alpha without dark fringes",function(){
    var frame=new pskl.model.Frame(16,16);for(var y=4;y<12;y++){for(var x=4;x<12;x++){frame.setPixel(x,y,pixel(255,255,255));}}
    expect(u.LayerMaskUtils.feather(frame,0)).toBe(frame);var out=u.LayerMaskUtils.feather(frame,1),edge=out.getPixel(3,8);expect(edge>>>24).toBeGreaterThan(0);expect(edge>>>24).toBeLessThan(255);expect(edge&255).toBe(255);expect(frame.getPixel(3,8)).toBe(0);expect(out.getPixel(8,8)>>>24).toBeGreaterThan(200);
  });
  it("effect-only source can target the composite of a group",function(){
    var art=layer("Art",[pixel(64,128,192),0]),folder=layer("Group",[0,0]),ink=layer("FX",[pixel(192,64,128),pixel(255,0,0)]);folder.rowState.isGroup=true;art.rowState.parentGroup=u.LayerGroupUtils.id(folder);ink.rowState.effectOnly=true;effect(ink,"difference");layers=[art,folder,ink];expect(render()[0]&255).toBe(128);expect(render()[1]).toBe(0);
  });
  it("mask layer opacity multiplies paint alpha instead of adding color",function(){
    var art=layer("Art",[pixel(0,0,255)]),mask=layer("Mask",[pixel(255,0,0,128)]);mask.setOpacity(.5);mask.rowState.hidden=true;effect(art,"mask",{maskId:u.LayerGroupUtils.id(mask),hideMask:true});layers=[art,mask];expect(render()[0]>>>24).toBe(64);
  });
  it("duplicating a group binds its painted mask to the duplicated source",function(){
    var art=layer("Art",[pixel(255,0,0)]),mask=layer("Mask",[pixel(255,255,255,128)]),folder=layer("Group",[0]);folder.rowState.isGroup=true;art.rowState.parentGroup=mask.rowState.parentGroup=u.LayerGroupUtils.id(folder);effect(folder,"mask",{maskId:u.LayerGroupUtils.id(mask),hideMask:true});layers=[art,mask,folder];var copy=u.LayerGroupUtils.duplicate(layers,folder),source=layers.find(function(l){return l!==mask&&l.getName()==="Mask";});expect(copy.rowState.effects[0].params.maskId).toBe(u.LayerGroupUtils.id(source));expect(copy.rowState.effects[0].params.maskId).not.toBe(u.LayerGroupUtils.id(mask));
  });
});

describe("Dither bucket and gradients", function () {
  var U = pskl.utils.DitherPaintUtils, P = pskl.utils.DitherPatterns;
  var red = pskl.utils.colorToInt("#ff0000"), blue = pskl.utils.colorToInt("#0000ff");
  function frame(){return new pskl.model.Frame(16,16);}
  function settings(angle){return U.settings({fill:"gradient",gradient:{angle:angle,stops:[{at:0,color:"#ff0000",opacity:100},{at:100,color:"#0000ff",opacity:100}]}});}
  it("fills only a four-connected region, preserving boundaries and disconnected islands",function(){
    var f=frame();for(var y=0;y<16;y++)f.setPixel(8,y,"#ffffff");f.setPixel(1,1,"#ffffff");
    var s=U.settings({paint:"bucket"});U.fill(f,2,2,s,red,blue,false,100);
    for(var y=0;y<16;y++)for(var x=0;x<16;x++)expect(f.getPixel(x,y)).toBe(x===8||(x===1&&y===1)?0xffffffff:x>8?0:P.sample(x,y,s)?red:blue);
  });
  it("visits the entire original region even when primary-only pattern cells are skipped",function(){
    var f=frame(),s=U.settings({colors:"primary"});U.fill(f,0,0,s,red,blue,false,100);
    expect(f.getPixel(0,0)).toBe(0);expect(f.getPixel(15,14)).toBe(red);expect(f.getPixel(14,14)).toBe(0);
  });
  it("swaps the two bucket colors on right click and honors scaled density",function(){
    var a=frame(),b=frame(),s=U.settings({mode:"density",density:25,scale:2});U.fill(a,0,0,s,red,blue,false,100);U.fill(b,0,0,s,red,blue,true,100);
    for(var y=0;y<16;y++)for(var x=0;x<16;x++){expect(a.getPixel(x,y)).toBe(P.sample(x,y,s)?red:blue);expect(b.getPixel(x,y)).toBe(P.sample(x,y,s)?blue:red);}
  });
  it("fits gradient endpoints to the filled region instead of the whole canvas",function(){
    var f=frame();for(var y=0;y<16;y++)for(var x=0;x<16;x++)if(x<3||x>12||y<4||y>10)f.setPixel(x,y,"#ffffff");
    U.fill(f,5,6,settings(0),red,blue,false,100);expect(f.getPixel(3,6)).toBe(red);expect(f.getPixel(12,6)).toBe(blue);expect(f.getPixel(2,6)).toBe(0xffffffff);
    expect(Array.from(f.pixels).every(function(p){return [red,blue,0xffffffff].indexOf(p)!==-1;})).toBe(true);
  });
  [[0,[2,3],[12,13]],[90,[2,3],[12,13]],[180,[12,13],[2,3]],[270,[12,13],[2,3]],[45,[2,3],[12,13]],[135,[12,3],[2,13]],[225,[12,13],[2,3]],[315,[2,13],[12,3]]].forEach(function(example){
    it("supports exact endpoints at "+example[0]+" degrees and right-click reversal",function(){var s=settings(example[0]),b={minX:2,minY:3,maxX:12,maxY:13},a=example[1],z=example[2];expect(U.gradientColor(a[0],a[1],s,b)).toBe(red);expect(U.gradientColor(z[0],z[1],s,b)).toBe(blue);expect(U.gradientColor(a[0],a[1],s,b,true)).toBe(blue);});
  });
  it("supports multiple color stops, partial alpha, and single-pixel fills",function(){
    var s=settings(0);s.gradient.stops.splice(1,0,{at:50,color:"#00ff00",opacity:50});var b={minX:0,minY:0,maxX:10,maxY:10};
    expect(U.gradientColor(5,5,s,b)).toBe(0x8000ff00);var f=new pskl.model.Frame(1,1);U.fill(f,0,0,s,red,blue,false,50);expect(f.getPixel(0,0)).toBe(0x800000ff);
    expect(U.region(f,-1,0)).toBe(null);
  });
  it("handles large fills iteratively and applies brush opacity to existing paint alpha",function(){
    var f=new pskl.model.Frame(256,256);expect(U.region(f,0,0).pixels.length).toBe(65536);expect(U.opacity("rgba(255,0,0,0.5)",50)>>>24).toBe(64);expect(U.opacity(red,0)>>>24).toBe(0);
  });
  it("repairs invalid saved gradients while keeping valid pen preferences",function(){
    var s=U.settings({scale:2,gradient:{angle:-90,matrix:17,stops:[null,{at:NaN,color:'red'}]}});expect(s.paint).toBe('pen');expect(s.fill).toBe('pattern');expect(s.scale).toBe('2');expect(s.gradient.angle).toBe(270);expect(s.gradient.matrix).toBe(4);expect(s.gradient.stops.length).toBe(2);
  });
});

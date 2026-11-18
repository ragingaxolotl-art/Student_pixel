describe('Tile Studio data and rendering', function () {
  var U;
  beforeEach(function () { U=pskl.utils.TileStudioUtils; });
  it('rejects dangling tile references and malformed pixels', function () {
    var c=U.create(8); U.tile(c); c.layers[0].cells[0]={tile:'missing',turn:0,flip:false};
    expect(function(){U.validate(c);}).toThrow();
    c.layers[0].cells[0]=null;c.tiles[0].pixels[0]=-1;
    expect(function(){U.validate(c);}).toThrow();
  });
  it('flood fill respects disconnected regions and does not alias cells', function () {
    var a=[null,1,null,null,1,null],v={tile:'a',turn:0,flip:false};
    U.fill(a,3,2,0,0,v);expect(a[0]).toEqual(v);expect(a[3]).toEqual(v);expect(a[2]).toBeNull();
    a[0].turn=2;expect(a[3].turn).toBe(0);
  });
  it('resizing keeps overlapping map coordinates', function () {
    var c=U.create(8),t=U.tile(c);c.layers[0].cells[25]={tile:t.id,turn:0,flip:false};
    U.resize(c,12,8);expect(c.layers[0].cells[13].tile).toBe(t.id);expect(U.validate(c)).toBe(c);
  });
  it('rotates tile pixels clockwise, hides layers and renders linked updates', function () {
    var c=U.create(2);U.resize(c,1,1);var t=U.tile(c,[0xff0000ff,0,0,0]);
    c.layers[0].cells[0]={tile:t.id,turn:1,flip:false};
    var data=U.mapCanvas(c).getContext('2d').getImageData(0,0,2,2).data;
    expect(data[7]).toBe(255);expect(data[4]).toBe(255);expect(data[3]).toBe(0);
    t.pixels[0]=0xff00ff00;data=U.mapCanvas(c).getContext('2d').getImageData(0,0,2,2).data;expect(data[5]).toBe(255);
    c.layers[0].visible=false;expect(Array.from(U.mapCanvas(c).getContext('2d').getImageData(0,0,2,2).data).every(function(v){return v===0;})).toBe(true);
  });
});
describe('Tile resolution changes', function () {
 it('nearest-neighbor scaling retains IDs, stamps and map links', function () {
   var U=pskl.utils.TileStudioUtils,c=U.create(2),t=U.tile(c,[1,2,3,4]);
   c.layers[0].cells[0]={tile:t.id,turn:1,flip:true};
   U.resolution(c,4,'scale');expect(c.tiles[0].id).toBe(t.id);
   expect(t.pixels).toEqual([1,1,2,2,1,1,2,2,3,3,4,4,3,3,4,4]);expect(c.layers[0].cells[0].tile).toBe(t.id);
 });
 it('canvas resizing pads and crops at the top left without resampling',function(){
   var U=pskl.utils.TileStudioUtils,c=U.create(2),t=U.tile(c,[1,2,3,4]);
   U.resolution(c,3,'canvas');expect(t.pixels).toEqual([1,2,0,3,4,0,0,0,0]);
   U.resolution(c,1,'canvas');expect(t.pixels).toEqual([1]);
 });
});

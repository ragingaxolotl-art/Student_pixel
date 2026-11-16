describe("Filled rectangle and ellipse drawing", function () {
  var s = pskl.utils, red = s.colorToInt("#ff0000"), blue = s.colorToInt("#0000ff");
  ["Rectangle", "Circle"].forEach(function (name) {
    function tool() {
      var t = new pskl.tools.drawing[name]();
      t.startCol = 2;
      t.startRow = 2;
      return t;
    }
    it(name + " starts empty and leaves interior pixels intact", function () {
      var t = tool(), f = new pskl.model.Frame(12,12);
      f.setPixel(5,5,blue);
      expect(t.shapeMode).toBe("empty");
      t.draw(8,8,red,f,1);
      expect(f.getPixel(5,5)).toBe(blue);
      expect(f.getPixel(5,2)).toBe(red);
      expect(f.getPixel(0,0)).toBe(0);
    });
    it(name + " fills with its own alpha color while retaining a distinct border", function () {
      var t = tool(), f = new pskl.model.Frame(12,12), ink = s.colorToInt("rgba(0,0,255,0.5)");
      t.draw(8,8,red,f,1,{mode:"solid",fillColor:ink});
      expect(f.getPixel(5,5)).toBe(ink);
      expect(f.getPixel(5,2)).toBe(red);
      expect(f.getPixel(0,0)).toBe(0);
    });
    it(name + " fill-only ignores border color and width, and permits transparent erasing", function () {
      var t = tool(), f = new pskl.model.Frame(12,12);
      t.draw(8,8,red,f,32,{mode:"fill-only",fillColor:blue});
      expect(f.getPixel(5,5)).toBe(blue);
      expect(Array.from(f.pixels).some(function(p){return p===red;})).toBe(false);
      t.draw(8,8,red,f,1,{mode:"fill-only",fillColor:Constants.TRANSPARENT_COLOR});
      expect(Array.from(f.pixels).some(Boolean)).toBe(false);
    });
    it(name + " replays the captured fill even after the current tool settings change", function () {
      var t = tool(), before = new pskl.model.Frame(12,12), after = new pskl.model.Frame(12,12);
      var event={startCol:2,startRow:2,col:8,row:8,color:red,penSize:1,shapeStyle:{mode:"solid",fillColor:blue}};
      t.replay(before,event); t.shapeMode="empty";t.fillColor=red;t.replay(after,event);
      expect(Array.from(after.pixels)).toEqual(Array.from(before.pixels));
      expect(after.getPixel(5,5)).toBe(blue);
      t.replay(after,Object.assign({},event,{shapeStyle:undefined}));
      expect(after.getPixel(5,5)).toBe(blue);
    });
    it(name + " safely draws points, thin boxes and reverse drags", function () {
      [[4,4,4,4],[2,3,2,8],[2,3,8,3],[2,3,3,8],[8,8,2,2]].forEach(function(c){
        var t=tool(), f=new pskl.model.Frame(12,12);t.startCol=c[0];t.startRow=c[1];
        t.draw(c[2],c[3],red,f,1,{mode:"fill-only",fillColor:blue});
        expect(Array.from(f.pixels).some(function(p){return p===blue;})).toBe(true);
      });
    });
  });
  it("keeps ellipse contours identical when translated across the origin",function(){
    var t=new pskl.tools.drawing.Circle();
    for(var x=-5;x<=5;x++)for(var y=-5;y<=5;y++){
      var first=t.getCirclePixels_(x,y,x+7,y+5,1).map(function(p){return [p[0]-x,p[1]-y].join(',');}).sort(),
        base=t.getCirclePixels_(0,0,7,5,1).map(function(p){return p.join(',');}).sort();
      expect(first).toEqual(base);
    }
  });
  it("shift-constrained drags stay finite on either axis",function(){
    var t=new pskl.tools.drawing.Rectangle();t.startCol=3;t.startRow=4;
    expect(t.getScaledCoordinates_(3,8)).toEqual({col:3,row:4});
    expect(t.getScaledCoordinates_(8,4)).toEqual({col:3,row:4});
  });
});

describe('Selection mask combinations',function(){
 var frame,combine=pskl.selection.BaseSelection.combine;
 function p(x,y){return {col:x,row:y};}
 beforeEach(function(){frame=new pskl.model.Frame(4,4);});
 it('adds disconnected areas and removes overlapping duplicates',function(){expect(combine([p(0,0),p(1,0)],[p(1,0),p(3,3)],'add',frame).pixels).toEqual([p(0,0),p(1,0),p(3,3)]);});
 it('subtracts only the intersecting area and leaves the source mask intact',function(){var base=[p(0,0),p(1,0),p(2,0)];expect(combine(base,[p(1,0),p(3,3)],'subtract',frame).pixels).toEqual([p(0,0),p(2,0)]);expect(base.length).toBe(3);});
 it('can remove the entire selection and subtract from an empty one',function(){expect(combine([p(1,1)],[p(1,1)],'subtract',frame).pixels).toEqual([]);expect(combine([],[p(1,1)],'subtract',frame).pixels).toEqual([]);});
 it('replaces masks, clips bounds and rejects fractional coordinates',function(){expect(combine([p(0,0)],[p(-1,0),p(4,0),p(1.2,1),p(2,2),p(2,2)],'replace',frame).pixels).toEqual([p(2,2)]);});
 it('creates independent geometry without retaining pasted pixel colors',function(){var base=[{col:1,row:1,color:'#ff0000'}],selection=combine(base,[],'add',frame);expect(selection.pixels).toEqual([p(1,1)]);selection.move(1,0);expect(base[0].col).toBe(1);});
});

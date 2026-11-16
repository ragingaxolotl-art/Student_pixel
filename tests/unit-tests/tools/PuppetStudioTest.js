describe("Rig and puppet geometry",function(){
 var r,p;
 beforeEach(function(){r=pskl.utils.RigStudioUtils;var f=new pskl.model.Frame(32,32);f.setPixel(1,1,0x80123456);p=pskl.model.Piskel.fromLayers([pskl.model.Layer.fromFrames("Art",[f])],12,{name:"Rig",description:""});});
 it("builds five original templates with stable IDs and visible skin",function(){["humanoid","chibi","quadruped","winged","serpent"].forEach(function(name){var rig=r.template(name,32,32);expect(function(){r.validate(rig);}).not.toThrow();expect(rig.bones[0].id).toBe(r.template(name,32,32).bones[0].id);var renderer=new pskl.utils.RigStudioRenderer(p,rig);expect(renderer.frame({}).getPixels().some(function(c){return c>>>24;})).toBe(true);});});
 it("carries parent rotation, scale and shear into child matrices",function(){var rig=r.template("humanoid",32,32),b=rig.bones[0],child=rig.bones[1],pose={};pose[b.id]={rotation:30,scaleX:1.5,scaleY:0.75,shear:0.2};var world=r.world(rig,pose),point=r.point(r.inverse(world[child.id].matrix),world[child.id].end.x,world[child.id].end.y);expect(point.x).toBeCloseTo(child.length,6);expect(point.y).toBeCloseTo(0,6);});
 it("rejects parent cycles and duplicate layer bindings",function(){var rig=r.template("humanoid",32,32);rig.bones[0].parent=rig.bones[1].id;expect(function(){r.validate(rig);}).toThrow();rig.bones[0].parent=null;rig.bones[0].layerId="art";rig.bones[1].layerId="art";expect(function(){r.validate(rig);}).toThrow();});
 it("solves a two-bone chain at either bend side without stretching",function(){var rig=r.template("humanoid",32,32),lower=rig.bones.find(function(b){return b.name==="Left forearm";}),target={x:8,y:13};[-1,1].forEach(function(bend){var pose=r.solveIK(rig,{},lower.id,target,bend),world=r.world(rig,pose);expect(world[lower.id].end.x).toBeCloseTo(8,5);expect(world[lower.id].end.y).toBeCloseTo(13,5);});});
 it("interpolates keyed poses, holds and ping-pong endpoints",function(){var rig=r.template("humanoid",32,32),id=rig.bones[0].id;rig.poses=[{id:"a",name:"A",values:{}},{id:"b",name:"B",values:{}}];rig.poses[1].values[id]={rotation:90};var clip={frames:12,pingpong:false,loop:false,keys:[{at:0,pose:"a",easing:"linear"},{at:10,pose:"b",easing:"linear"}]};expect(r.poseAt(rig,clip,5)[id].rotation).toBeCloseTo(45,6);clip.keys[0].hold=true;expect(r.poseAt(rig,clip,5)[id].rotation).toBe(0);clip.keys[0].hold=false;clip.pingpong=true;expect(r.poseAt(rig,clip,17)[id].rotation).toBeCloseTo(45,6);});
 it("mirrors paired poses and preserves exact source RGBA under affine sampling",function(){var rig=r.template("humanoid",32,32),left=rig.bones.find(function(b){return b.name==="Left forearm";}),right=rig.bones.find(function(b){return b.name==="Right forearm";}),pose={};pose[left.id]={rotation:25,x:2};var mirrored=r.mirrorPose(rig,pose);expect(mirrored[right.id].rotation).toBe(-25);expect(mirrored[right.id].x).toBe(-2);var renderer=new pskl.utils.RigStudioRenderer(p,rig),out=renderer.affine(p.getLayerAt(0).getFrameAt(0),r.identity(),1);expect(out.getPixel(1,1)).toBe(0x80123456);});
});
describe("Isolated limb joint dragging",function(){
 var r,rig;
 beforeEach(function(){r=pskl.utils.RigStudioUtils;rig=r.template('humanoid',32,32);});
 ['Left upper arm','Right upper arm','Left thigh','Right thigh'].forEach(function(name){it('keeps torso, head and other limbs fixed when moving '+name,function(){var bone=rig.bones.find(function(b){return b.name===name;}),before=r.world(rig,{}),joint=before[bone.id].end,chosen=r.pickJoint(rig,before,joint);expect(chosen.id).toBe(bone.id);expect(chosen.kind).toBe('end');var pose=r.dragJoint(rig,{},bone.id,'end',{x:joint.x+2,y:joint.y+1},1),after=r.world(rig,pose);expect(Object.keys(pose)).toEqual([bone.id]);rig.bones.filter(function(b){return b.id!==bone.id&&b.parent!==bone.id;}).forEach(function(b){expect(after[b.id].matrix).toEqual(before[b.id].matrix);});expect(function(){r.solveIK(rig,{},bone.id,joint,1);}).toThrow();});});
 it('uses arm-only IK at the wrist',function(){var lower=rig.bones.find(function(b){return b.name==='Left forearm';}),upper=rig.bones.find(function(b){return b.id===lower.parent;}),pose=r.dragJoint(rig,{},lower.id,'end',{x:8,y:13},1),world=r.world(rig,pose);expect(Object.keys(pose).sort()).toEqual([lower.id,upper.id].sort());expect(world[lower.id].end.x).toBeCloseTo(8,5);expect(world[lower.id].end.y).toBeCloseTo(13,5);});
 it('picks the shared endpoint even when children are listed first',function(){rig.bones.reverse();var upper=rig.bones.find(function(b){return b.name==='Left upper arm';}),world=r.world(rig,{});expect(r.pickJoint(rig,world,world[upper.id].end)).toEqual({id:upper.id,kind:'end',distance:0});});
});
describe("Manual puppet constraints and timing",function(){
 var r,rig;
 beforeEach(function(){r=pskl.utils.RigStudioUtils;rig=r.template("humanoid",32,32);});
 it("pins a joint in world space while allowing rotation around it",function(){
  var bone=rig.bones.find(function(b){return b.name==="Left forearm";}),world=r.world(rig,{}),pin=world[bone.id].start;
  bone.pin={x:pin.x,y:pin.y};var pose={};pose[rig.bones[0].id]={rotation:40,x:4,y:3};
  var after=r.world(rig,pose);expect(after[bone.id].start).toEqual(pin);
  var moved=r.dragJoint(rig,pose,bone.id,"start",{x:1,y:1},1);expect(moved).toEqual(pose);
  var rotated=r.dragJoint(rig,pose,bone.id,"end",{x:pin.x+3,y:pin.y+2},1),end=r.world(rig,rotated)[bone.id];
  expect(end.start).toEqual(pin);expect(end.end.x).toBeGreaterThan(pin.x);expect(end.end.y).toBeGreaterThan(pin.y);
  expect(r.world(rig,null)[bone.id].start).not.toEqual(r.world(rig,pose)[bone.id].end);
 });
 it("adds connected custom joints with no template matching or stretched pose",function(){
  var root=rig.bones[0],world=r.world(rig,null),end=world[root.id].end,target={x:end.x+4,y:end.y+3},bone=r.addJoint(rig,root.id,target),w=r.world(rig,null)[bone.id];
  expect(bone.length).toBeCloseTo(5,6);expect(w.start.x).toBeCloseTo(end.x,6);expect(w.end.x).toBeCloseTo(target.x,6);expect(w.end.y).toBeCloseTo(target.y,6);
 });
 it("retimes markers without overwriting another pose",function(){var clip={frames:12,keys:[{at:0,pose:"a"},{at:5,pose:"b"}]};r.moveKey(clip,0,3);expect(clip.keys[0].at).toBe(3);expect(function(){r.moveKey(clip,3,5);}).toThrow();expect(function(){r.moveKey(clip,3,12);}).toThrow();});
 it("rejects malformed pins and invalid guide colors",function(){rig.bones[0].pin={x:NaN,y:0};expect(function(){r.validate(rig);}).toThrow();delete rig.bones[0].pin;rig.guides=[{name:"Floor",axis:"horizontal",position:20,color:"bad"}];expect(function(){r.validate(rig);}).toThrow();});
 it("locks the knee point after the thigh tip was selected, leaving foot rotation free",function(){
  var upper=rig.bones.find(function(b){return b.name==="Left thigh";}),lower=rig.bones.find(function(b){return b.name==="Left shin";}),pose={},target=r.pinTarget(rig,pose,upper.id,"end");expect(target.id).toBe(lower.id);
  pose[upper.id]={rotation:-60};var before=r.world(rig,pose);lower.pin=Object.assign({},before[lower.id].start);
  var out=r.dragJoint(rig,pose,lower.id,"end",{x:lower.pin.x,y:lower.pin.y+lower.length},1),after=r.world(rig,out);
  expect(r.dragJoint(rig,out,upper.id,"end",{x:lower.pin.x+5,y:lower.pin.y+5},1)).toEqual(out);
  expect(after[lower.id].start).toEqual(lower.pin);expect(after[upper.id]).toEqual(before[upper.id]);expect(after[rig.bones[0].id]).toEqual(before[rig.bones[0].id]);expect(after[lower.id].end.x).toBeCloseTo(lower.pin.x,6);expect(after[lower.id].end.y).toBeCloseTo(lower.pin.y+lower.length,6);
 });
 it("resolves elbow tips to forearm pivots and avoids locking a different point at terminal tips",function(){var upper=rig.bones.find(function(b){return b.name==="Left upper arm";}),lower=rig.bones.find(function(b){return b.name==="Left forearm";});expect(r.pinTarget(rig,{},upper.id,"end").id).toBe(lower.id);expect(r.pinTarget(rig,{},lower.id,"start").id).toBe(lower.id);expect(r.pinTarget(rig,{},lower.id,"end")).toBe(null);});
 it("does not guess which branch to pin at a shared fork",function(){var upper=rig.bones.find(function(b){return b.name==="Left thigh";}),lower=rig.bones.find(function(b){return b.name==="Left shin";}),copy=pskl.utils.ToolStateUtils.clone(lower);copy.id="other-shin";rig.bones.push(copy);expect(r.pinTarget(rig,{},upper.id,"end")).toBe(null);});
});
describe("Puppet reference effects preserve the current artwork",function(){
 it("samples Multiply against the reference backdrop and keeps the raw source editable",function(){
  var s=pskl.utils,back=pskl.model.Layer.fromFrames("Backdrop",[new pskl.model.Frame(4,4)]),source=pskl.model.Layer.fromFrames("Art",[new pskl.model.Frame(4,4)]);
  back.frames[0].setPixel(1,1,0xff808080);source.frames[0].setPixel(1,1,0x80c0a0e0);source.rowState.id="rig-source";
  source.rowState.effects=[{id:"blend",operation:"multiply",enabled:true,frame:null,params:{amount:100}}];
  var p=pskl.model.Piskel.fromLayers([back,source],12,{name:"FX",description:""}),rig=s.RigStudioUtils.template("humanoid",4,4);rig.bones=rig.bones.slice(0,1);rig.bones[0].layerId="rig-source";rig.skin=false;
  var renderer=new s.RigStudioRenderer(p,rig),actual=renderer.scene({},0).getContext("2d").getImageData(1,1,1,1).data,expected=s.LayerUtils.flattenFrameAt(p.getLayers(),0,true).getContext("2d").getImageData(1,1,1,1).data;
  for(var i=0;i<4;i++){expect(Math.abs(actual[i]-expected[i])).toBeLessThanOrEqual(2);}
  expect(source.frames[0].getPixel(1,1)).toBe(0x80c0a0e0);expect(source.rowState.effects[0].enabled).toBe(true);
 });
});

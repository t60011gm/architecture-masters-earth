// Island-only controls. Pure math and gesture state remain testable without WebGL.
import {lineWalkable} from './core.js';
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export const ISLAND_CAMERA_LIMITS={minPitch:.28,maxPitch:1.4,minDistance:30,maxDistance:78};
export class IslandCamera {
 constructor(){this.reset();}
 reset(mobile=false){this.yaw=.45;this.pitch=.78;this.distance=mobile?57:47;}
 orbit(dx,dy){if(!Number.isFinite(dx)||!Number.isFinite(dy))return;this.rotate(-dx*.006);this.tilt(dy*.005);}
 rotate(delta){if(Number.isFinite(delta))this.yaw=Math.atan2(Math.sin(this.yaw+delta),Math.cos(this.yaw+delta));}
 tilt(delta){if(Number.isFinite(delta))this.pitch=clamp(this.pitch+delta,ISLAND_CAMERA_LIMITS.minPitch,ISLAND_CAMERA_LIMITS.maxPitch);}
 zoom(delta){if(Number.isFinite(delta))this.distance=clamp(this.distance+delta,ISLAND_CAMERA_LIMITS.minDistance,ISLAND_CAMERA_LIMITS.maxDistance);}
 zoomBy(factor){if(Number.isFinite(factor)&&factor>0)this.zoom(this.distance*(factor-1));}
 pose(){const flat=this.distance*Math.cos(this.pitch);return {x:Math.sin(this.yaw)*flat,y:2.6+Math.sin(this.pitch)*this.distance,z:Math.cos(this.yaw)*flat};}
}
export function movementVector(keys,yaw=0){
 const held=(...names)=>names.some(name=>keys.has(name));
 const x=Number(held('d','arrowright','right'))-Number(held('a','arrowleft','left'));
 const z=Number(held('s','arrowdown','down'))-Number(held('w','arrowup','up'));
 const length=Math.hypot(x,z);if(!length)return {x:0,z:0};
 return {x:(x*Math.cos(yaw)+z*Math.sin(yaw))/length,z:(-x*Math.sin(yaw)+z*Math.cos(yaw))/length};
}
export function walkStep(position,direction,dt,rect,maxDistance=Infinity){
 const length=Math.hypot(direction.x,direction.z);
 if(!Number.isFinite(length)||!Number.isFinite(dt)||length<1e-9||dt<=0)return {...position};
 const step=Math.min(5.2*Math.min(dt,.05),maxDistance),dx=direction.x/length*step,dz=direction.z/length*step;
 const next={x:position.x+dx,z:position.z+dz};
 if(lineWalkable(position,next,rect))return next;
 const result={...position};
 if(lineWalkable(result,{x:next.x,z:result.z},rect))result.x=next.x;
 if(lineWalkable(result,{x:result.x,z:next.z},rect))result.z=next.z;
 return result;
}
export function islandKey(event){
 const codes={KeyW:'w',KeyA:'a',KeyS:'s',KeyD:'d',KeyQ:'q',KeyE:'e',KeyR:'r',Space:' '};
 return codes[event.code]||event.key?.toLowerCase()||'';
}
export function blocksGameKeys(target){return Boolean(target?.closest?.('input,select,textarea,button,a,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="menu"],[role="listbox"],dialog'));}
export class IslandGestures {
 constructor({orbit,zoom,select}){Object.assign(this,{orbit,zoom,select});this.points=new Map();this.hadMulti=false;}
 down(e){
  if(e.pointerType==='mouse'&&e.button!==0)return false;
  if(!this.points.size)this.hadMulti=false;
  this.points.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false,target:e.target});
  if(this.points.size>1){this.hadMulti=true;for(const point of this.points.values())point.moved=true;}
  return true;
 }
 move(e){
  const point=this.points.get(e.pointerId);if(!point)return false;
  const before=[...this.points.values()].map(p=>({...p}));
  const dx=e.clientX-point.x,dy=e.clientY-point.y;point.x=e.clientX;point.y=e.clientY;
  if(Math.hypot(point.x-point.startX,point.y-point.startY)>7)point.moved=true;
  if(this.points.size>1){
   const after=[...this.points.values()];
   const oldDistance=Math.hypot(before[0].x-before[1].x,before[0].y-before[1].y),newDistance=Math.hypot(after[0].x-after[1].x,after[0].y-after[1].y);
   if(oldDistance>5&&newDistance>5)this.zoom(oldDistance/newDistance);
  }else if(point.moved)this.orbit(dx,dy);
  return point.moved;
 }
 up(e){
  const point=this.points.get(e.pointerId);if(!point)return {handled:false,tap:false};
  const tap=!point.moved&&!this.hadMulti&&Math.hypot(e.clientX-point.startX,e.clientY-point.startY)<=7;
  this.points.delete(e.pointerId);
  if(tap)this.select(e.clientX,e.clientY,point.target);
  return {handled:true,tap};
 }
 cancel(){this.points.clear();this.hadMulti=false;}
}

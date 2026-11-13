// Live eye-level exploration in the existing scene. One player position owns
// the camera, collisions, floor and quest interaction; no remote still view.
import {canWalk,lineWalkable} from './core.js';
import {observationCanStand,observationMoveAllowed} from './observation-navigation.js';
export const OBSERVATION_ENTER_RADIUS=1.6,OBSERVATION_REARM_RADIUS=2.6;
// Kept as imports for historical regression harnesses, not photography controls.
export const PHOTO_ENTER_RADIUS=OBSERVATION_ENTER_RADIUS,PHOTO_EXIT_RADIUS=OBSERVATION_REARM_RADIUS;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),copy=s=>({yaw:s.yaw,pitch:s.pitch,distance:s.distance,fov:s.fov??40});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),smooth=t=>t*t*(3-2*t),mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
export function freeCameraPose(orbit,player={x:0,z:0}){
 const flat=orbit.distance*Math.cos(orbit.pitch),p=orbit.pose?.()||{x:Math.sin(orbit.yaw)*flat,y:2.6+Math.sin(orbit.pitch)*orbit.distance,z:Math.cos(orbit.yaw)*flat},x=player.x*.16,z=player.z*.16;
 return {position:[p.x+x,p.y,p.z+z],target:[x,2.6,z],fov:orbit.fov??40,near:.1,far:600};
}
export class ObservationCamera {
 constructor(points=[],shots=[],reduced=false){this.points=points;this.shots=shots;this.reduced=reduced;this.blocked=new Set();this.active=null;this.display=null;this.snapshot=null;this.phase=null;this.elapsed=0;this.opacity=0;this.player=null;this.yaw=0;this.pitch=0;this.fov=60;this.exitRequested=false;this.enabled=true;}
 get shot(){return this.display==null?null:this.shots[this.display];}
 get movementYaw(){return this.active==null?undefined:this.yaw;}
 get moving(){return this.active!=null&&!this.phase;}
 begin(index,player,state){
  const shot=this.shots[index];if(shot.kind==='interior'&&!shot.navigation)return false;
  this.player=player;this.active=index;this.allowedIndex=null;this.snapshot=copy(state);this.entryPlayer={x:player.x,z:player.z,y:player.y??.375};this.entryPoint={...this.points[index]};this.display=index;this.elapsed=0;this.opacity=0;this.exitRequested=false;this.gateArmed=false;
  this.yaw=Math.atan2(player.x-shot.target[0],player.z-shot.target[2]);this.pitch=clamp(shot.entryPitch??0,-1.15,1.15);this.fov=60;
  if(shot.kind==='interior'){
   const start=shot.navigation.startXZ;this.yaw=Math.atan2(start.x-shot.target[0],start.z-shot.target[2]);
   this.fromPose=freeCameraPose(state,player);this.display=null;this.pending=index;
   this.phase='fade-enter-out';if(this.reduced){this.placeInterior(player,index);this.phase=null;}
  }else{
   player.y=shot.floorY;this.fromPose=freeCameraPose(state,player);this.toPose=this.eyePose(player);this.phase=this.reduced?null:'travel-in';
  }
  return true;
 }
 placeInterior(player,index){const s=this.shots[index],start=s.navigation.startXZ;player.x=start?.x??s.position[0];player.z=start?.z??s.position[2];player.y=s.floorY;this.display=index;this.pending=null;}
 update(player,state){
  this.player=player;
  if(this.phase)return null;
  if(this.active!=null){
   const shot=this.shots[this.active];
   if(this.exitRequested||(shot.kind==='exterior'&&distance(player,this.entryPoint)>shot.walkRadius))return this.override(player);
   return null;
  }
  for(const i of this.blocked)if(distance(player,this.points[i])>OBSERVATION_REARM_RADIUS)this.blocked.delete(i);
  if(!this.enabled)return null;
  let index=null,best=OBSERVATION_ENTER_RADIUS;
  for(let i=0;i<this.points.length;i++){if(this.blocked.has(i)||!this.shots[i]||(this.allowedIndex!=null&&i!==this.allowedIndex))continue;const d=distance(player,this.points[i]);if(d<=best){index=i;best=d;}}
  if(index!=null)this.begin(index,player,state);
  return null;
 }
 override(player=this.player,{immediate=false}={}){
  if(this.active==null){if(immediate&&this.phase){this.finish(player);}return null;}
  const index=this.active,shot=this.shots[index],restore=this.snapshot,from=this.pose(player,restore);
  this.blocked.add(index);for(let i=0;i<this.points.length;i++)if(distance(this.entryPlayer,this.points[i])<=OBSERVATION_REARM_RADIUS)this.blocked.add(i);
  this.active=null;this.snapshot=null;this.exitRequested=false;this.elapsed=0;this.returnState=restore;
  if(shot.kind==='interior'){
   this.pendingPlayer={...this.entryPlayer};this.fromPose=from;this.phase='fade-exit-out';
   if(immediate||this.reduced)this.finish(player);
  }else{
   this.fromPose=from;this.toPose=freeCameraPose(restore,player);this.phase=immediate||this.reduced?null:'travel-out';this.display=null;this.opacity=0;
  }
  return restore;
 }
 finish(player=this.player){if(this.pendingPlayer&&player){Object.assign(player,this.pendingPlayer);this.pendingPlayer=null;}this.display=this.active;this.pending=null;this.phase=null;this.opacity=0;this.elapsed=0;}
 advance(dt,player=this.player){
  if(!this.phase)return;
  this.elapsed+=clamp(Number.isFinite(dt)?dt:0,0,.05);
  if(this.phase.startsWith('travel')){if(this.elapsed>=1.05)this.finish(player);return;}
  if(this.phase.endsWith('-out')){
   this.opacity=clamp(this.elapsed/.18,0,1);
   if(this.elapsed>=.18){if(this.phase==='fade-enter-out')this.placeInterior(player,this.pending);else {Object.assign(player,this.pendingPlayer);this.pendingPlayer=null;this.display=null;}
    this.phase=this.phase==='fade-enter-out'?'fade-enter-in':'fade-exit-in';this.elapsed=0;this.opacity=1;}
  }else{this.opacity=1-clamp(this.elapsed/.22,0,1);if(this.elapsed>=.22)this.finish(player);}
 }
 eyePose(player){const shot=this.shot||this.shots[this.active],y=(player.y??shot.floorY)+shot.eyeHeight,cp=Math.cos(this.pitch);return {position:[player.x,y,player.z],target:[player.x-Math.sin(this.yaw)*cp,y+Math.sin(this.pitch),player.z-Math.cos(this.yaw)*cp],fov:this.fov,near:shot.near,far:180};}
 pose(player,state){
  if(this.phase?.startsWith('travel')){
   const a=this.fromPose,b=this.toPose,ceiling=Math.max(a.position[1],b.position[1],...this.shots.map(s=>s.travelCeiling||16));
   const path=[a.position,[a.position[0],ceiling,a.position[2]],[b.position[0],ceiling,b.position[2]],b.position],t=clamp(this.elapsed/1.05,0,1);
   const segment=t<.18?0:t<.45?1:2,local=segment===0?t/.18:segment===1?(t-.18)/.27:(t-.45)/.55;
   return {position:mix(path[segment],path[segment+1],smooth(local)),target:mix(a.target,b.target,smooth(t)),fov:a.fov+(b.fov-a.fov)*smooth(t),near:.03,far:600};
  }
  if(this.display!=null)return this.eyePose(player);
  return freeCameraPose(state,player);
 }
 look(dx,dy){if(this.active==null||!Number.isFinite(dx)||!Number.isFinite(dy))return;this.yaw=Math.atan2(Math.sin(this.yaw-dx*.006),Math.cos(this.yaw-dx*.006));this.pitch=clamp(this.pitch-dy*.005,-1.1,1.1);if(this.phase==='travel-in')this.toPose=this.eyePose(this.player);}
 rotate(delta){this.look(delta/.006,0);}
 tilt(delta){this.look(0,-delta/.005);}
 zoomBy(factor){if(this.active!=null&&Number.isFinite(factor)&&factor>0){this.fov=clamp(this.fov*factor,40,80);if(this.phase==='travel-in')this.toPose=this.eyePose(this.player);}}
 canStep(from,to){const shot=this.shots[this.active];if(!shot)return false;if(shot.kind==='interior')return observationMoveAllowed(shot.navigation,from,to);return canWalk(to.x,to.z,shot.walkRect,18.9)&&lineWalkable(from,to,shot.walkRect);}
 walk(player,direction,dt,maxDistance=Infinity){
  if(!this.moving)return {...player};const shot=this.shots[this.active],length=Math.hypot(direction.x,direction.z);if(!Number.isFinite(length)||length<1e-9||!Number.isFinite(dt)||dt<=0)return {...player};
  const step=Math.min(1.5*shot.scale*clamp(dt,0,.05),maxDistance),dx=direction.x/length*step,dz=direction.z/length*step,result={...player};
  // Capsule-safe segments, then axis slides. No endpoint-only wall tunnelling.
  const next={...player,x:player.x+dx,z:player.z+dz};
  if(shot.kind==='exterior'&&Math.hypot(next.x,next.z)>18.9&&lineWalkable(player,next,shot.walkRect)){result.x=next.x;result.z=next.z;this.exitRequested=true;}else if(this.canStep(player,next)){result.x=next.x;result.z=next.z;}else{const x={...result,x:result.x+dx},z={...result,z:result.z+dz};if(this.canStep(player,x))result.x=x.x;else if(this.canStep(player,z))result.z=z.z;}
  result.y=shot.floorY;
  if(shot.kind==='interior'){
   const gate=shot.navigation.gate;
   if(gate){const d=distance(result,gate),r=gate.radius??.35*shot.scale;if(d>r*1.5)this.gateArmed=true;if(this.gateArmed&&d<=r)this.exitRequested=true;}
  }
  return result;
 }
}

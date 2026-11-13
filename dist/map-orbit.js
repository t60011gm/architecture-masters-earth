// Small deterministic orbit controller. No inertia: reduced-motion and repeated
// pointer interactions settle immediately; one camera is retained across visits.
import * as THREE from 'three';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export class MapOrbit {
  constructor(camera,onChange=()=>{}) {this.camera=camera;this.onChange=onChange;this.aspect=1;this.width=1;this.height=1;this.yaw=0;this.pitch=1.23;this.target=new THREE.Vector3();this.scale=1;this.baseSpan=90;}
  resize(w,h){this.width=Math.max(1,w);this.height=Math.max(1,h);this.aspect=this.width/this.height;this.baseSpan=Math.max(83+360/this.height,127/this.aspect);this.update();}
  reset(){this.yaw=0;this.pitch=1.23;this.target.set(0,0,0);this.scale=1;this.update();}
  orbit(dx,dy){this.yaw-=dx*.006;this.pitch=clamp(this.pitch+dy*.005,.30,1.42);this.update();}
  zoomBy(factor){this.scale=clamp(this.scale*factor,.13,1.75);this.update();}
  pan(dx,dy){const unit=this.baseSpan*this.scale*2/this.height;const sx=-dx*unit,sz=-dy*unit/Math.max(.3,Math.sin(this.pitch));this.target.x=clamp(this.target.x+sx*Math.cos(this.yaw)+sz*Math.sin(this.yaw),-140,140);this.target.z=clamp(this.target.z-sx*Math.sin(this.yaw)+sz*Math.cos(this.yaw),-95,95);this.update();}
  focus(point){this.target.set(point.x,0,point.z);this.scale=clamp(15/this.baseSpan,.13,1.75);this.update();}
  update(){const c=this.camera,span=this.baseSpan*this.scale;c.left=-span*this.aspect;c.right=span*this.aspect;c.top=span;c.bottom=-span;const dist=280,cos=Math.cos(this.pitch);c.position.set(this.target.x+Math.sin(this.yaw)*dist*cos,Math.sin(this.pitch)*dist,this.target.z+Math.cos(this.yaw)*dist*cos);c.lookAt(this.target.x,1,this.target.z);c.updateProjectionMatrix();c.updateMatrixWorld();this.onChange();}
}

// Pointer state is separate from rendering, so gestures can be tested without GPU.
export class MapGestures {
  constructor({orbit,pan,zoom,select}){Object.assign(this,{orbit,pan,zoom,select});this.points=new Map();this.dragMode='orbit';this.hadMulti=false;}
  down(e){if(!this.points.size)this.hadMulti=false;this.points.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false,pan:e.button===2||e.button===1||e.shiftKey});if(this.points.size>1){this.hadMulti=true;for(const p of this.points.values())p.moved=true;}}
  move(e){const p=this.points.get(e.pointerId);if(!p)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;const previous=[...this.points.values()].map(p=>({...p}));p.x=e.clientX;p.y=e.clientY;if(Math.hypot(p.x-p.startX,p.y-p.startY)>7)p.moved=true;if(this.points.size>1){const now=[...this.points.values()];const a=previous[0],b=previous[1],c=now[0],d=now[1];const oldDistance=Math.hypot(a.x-b.x,a.y-b.y),newDistance=Math.hypot(c.x-d.x,c.y-d.y);if(oldDistance>5&&newDistance>5)this.zoom(oldDistance/newDistance);this.pan(((c.x+d.x)-(a.x+b.x))/2,((c.y+d.y)-(a.y+b.y))/2);}else if(p.moved){if(p.pan||this.dragMode==='pan')this.pan(dx,dy);else this.orbit(dx,dy);}}
  up(e){const p=this.points.get(e.pointerId);if(!p)return;const click=!p.moved&&!this.hadMulti&&e.button!==2&&e.button!==1&&Math.hypot(e.clientX-p.startX,e.clientY-p.startY)<=7;this.points.delete(e.pointerId);if(click)this.select(e.clientX,e.clientY);}
  cancel(){this.points.clear();this.hadMulti=false;}
}

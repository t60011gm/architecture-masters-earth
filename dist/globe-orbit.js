import * as THREE from 'three';
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
// A perspective, target-centred orbital camera. The globe never translates or
// flattens. Zoom approaches its surface; focus turns the selected cell toward us.
export class GlobeOrbit {
  constructor(camera,onChange=()=>{},radius=40){this.camera=camera;this.onChange=onChange;this.radius=radius;this.aspect=1;this.width=1;this.height=1;this.yaw=-.23;this.pitch=.37;this.scale=1;this.target=new THREE.Vector3();this.baseSpan=radius;this.update();}
  resize(w,h){this.width=Math.max(1,w);this.height=Math.max(1,h);this.aspect=this.width/this.height;this.update();}
  reset(){this.yaw=-.23;this.pitch=.37;this.scale=1;this.update();}
  orbit(dx,dy){this.yaw-=dx*.006;this.pitch=clamp(this.pitch+dy*.005,-1.46,1.46);this.update();}
  pan(dx,dy){this.orbit(dx,dy);}
  zoomBy(factor){this.scale=clamp(this.scale*factor,.065,1.6);this.update();}
  focus(point,scale=.23){const p=Array.isArray(point)?new THREE.Vector3(...point):point.clone?point.clone():new THREE.Vector3(point.x,point.y,point.z);p.normalize();this.yaw=Math.atan2(p.x,p.z);this.pitch=Math.asin(clamp(p.y,-1,1));this.scale=clamp(scale,.065,1.6);this.update();}
  update(){const c=this.camera,halfFov=THREE.MathUtils.degToRad(c.fov/2),limiting=Math.min(halfFov,Math.atan(Math.tan(halfFov)*this.aspect));this.distance=this.radius+(this.radius/Math.sin(limiting)*1.10-this.radius)*this.scale;c.aspect=this.aspect;c.near=.1;c.far=this.radius*12;c.position.set(Math.sin(this.yaw)*Math.cos(this.pitch),Math.sin(this.pitch),Math.cos(this.yaw)*Math.cos(this.pitch)).multiplyScalar(this.distance);c.up.set(0,1,0);c.lookAt(0,0,0);c.updateProjectionMatrix();c.updateMatrixWorld();this.onChange();}
}
// Used by both WebGL label projection and the explicit software fallback.
export function sphereVisible(point,camera,radius){const p=point.clone?point:new THREE.Vector3(...point),c=camera.position||camera;const d=p.clone().sub(c),length=d.length();d.normalize();const b=c.dot(d),q=c.lengthSq()-radius*radius,disc=b*b-q;if(disc<0)return true;const hit=-b-Math.sqrt(disc);return hit<0||hit>=length-.045;}
export function insetCell(tile,amount=.94){const c=new THREE.Vector3(...tile.center);return tile.vertices.map(v=>new THREE.Vector3(...v).lerp(c,1-amount).normalize());}

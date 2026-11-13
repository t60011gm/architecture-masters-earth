import {fetchModelBuffer} from './split-model-loader.mjs';
import * as THREE from 'three';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {MeshoptDecoder} from './vendor/meshopt_decoder.module.js';
import {prepareBuilding} from './model-display.js';
import {createArchitecturalLighting} from './architectural-lighting.js';
import {createMiniature,MINIATURE_INFO} from './miniatures.js';
import {MapOrbit,MapGestures} from './map-orbit.js';
import {GlobeOrbit} from './globe-orbit.js';
import {ObservationCamera,freeCameraPose} from './observation-camera.js';
import {observationShots} from './observation-shots.js';
import {IslandCamera,IslandGestures,movementVector,walkStep,islandKey,blocksGameKeys} from './island-controls.js';
import {buildGlobe} from './globe-geometry.js';
import {GlobeMethods} from './globe-view.js';
import {CONTINENTS,EMPTY_ISLANDS,EDGE_TYPES,edgePoint} from './world-map.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
import {mapPosition,buildingLayout,canWalk,lineWalkable,findPath,ISLAND_RADIUS} from './core.js';
const $=s=>document.getElementById(s), clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const material=(c,extra={})=>new THREE.MeshStandardMaterial({color:c,roughness:.86,...extra});
function mesh(geometry,mat,x=0,y=0,z=0){const m=new THREE.Mesh(geometry,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;return m;}
function dispose(root){if(!root)return;const geos=new Set(),mats=new Set(),tex=new Set(),images=new Set();root.traverse(o=>{if(o.geometry)geos.add(o.geometry);if(o.isLight)o.shadow?.dispose?.();for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m)mats.add(m);});for(const m of mats){for(const v of Object.values(m))if(v?.isTexture)tex.add(v);m.dispose();}for(const t of tex){if(t.source?.data?.close)images.add(t.source.data);t.dispose();}for(const image of images)image.close();for(const g of geos)g.dispose();root.clear();}
function seeded(seed){let n=seed;return()=>{n=(n*1664525+1013904223)>>>0;return n/4294967296;};}
function terrain(radius,seed,small=false){const group=new THREE.Group(),rand=seeded(seed);const sand=mesh(new THREE.CylinderGeometry(radius,radius*.91,small?.7:1.5,12),material('#cbbc8c'),0,small?-.3:-.7);sand.rotation.y=.2;group.add(sand);const land=mesh(new THREE.CylinderGeometry(radius*.94,radius*.99,small?.3:.65,12),material(seed%3===0?'#94b69a':'#a7bd8d'),0,small?.05:.05);land.rotation.y=.2;group.add(land);const shore=mesh(new THREE.CylinderGeometry(radius*1.15,radius*1.15,.05,24),new THREE.MeshBasicMaterial({color:'#c6ded0',transparent:true,opacity:.55}),0,small?-.65:-1.3);shore.castShadow=false;group.add(shore);for(let i=0;i<(small?3:15);i++){const a=rand()*Math.PI*2,r=radius*(small?.75:.85);let t=tree(small?.45:.9+rand()*.6);t.position.set(Math.cos(a)*r,.3,Math.sin(a)*r);group.add(t);}return group;}
function tree(scale){const g=new THREE.Group();g.add(mesh(new THREE.CylinderGeometry(.12,.16,1.3,5),material('#7e795b'),0,.65,0));g.add(mesh(new THREE.IcosahedronGeometry(.83,0),material('#668866'),0,1.65,0));g.add(mesh(new THREE.IcosahedronGeometry(.65,0),material('#81a47b'),.25,2.1,.05));g.scale.setScalar(scale);return g;}
// Merge static terrain by appearance. Miniature modules batch their own meshes.
function batchTerrain(root){root.updateMatrixWorld(true);const buckets=new Map();root.traverse(o=>{if(!o.isMesh)return;const m=o.material,k=[m.type,m.color.getHex(),m.opacity,m.transparent].join('/');let b=buckets.get(k);if(!b){b={material:m,geometries:[]};buckets.set(k,b);}let g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrixWorld);b.geometries.push(g);});const out=new THREE.Group();for(const b of buckets.values()){const g=mergeGeometries(b.geometries);const m=mesh(g,b.material);m.castShadow=false;out.add(m);for(const x of b.geometries)x.dispose();}return out;}
function person(color,master=false,id=0){const g=new THREE.Group(),skin=material('#dbb995'),suit=material(color),ink=material('#344b45');const torso=mesh(new THREE.CylinderGeometry(.24,.29,.65,7),suit,0,.83,0);g.add(torso);g.add(mesh(new THREE.SphereGeometry(.25,8,6),skin,0,1.42,0));for(const s of [-1,1]){g.add(mesh(new THREE.CylinderGeometry(.085,.085,.43,5),ink,s*.13,.31,0));const arm=mesh(new THREE.CylinderGeometry(.075,.075,.55,5),suit,s*.32,.83,0);arm.rotation.z=s*.18;g.add(arm);}if(master){g.add(mesh(new THREE.SphereGeometry(.255,8,4,0,Math.PI*2,0,1.15),material(id===3?'#aaa994':'#bbc1b0'),0,1.47,0));if(id===5){for(const s of [-1,1])g.add(mesh(new THREE.TorusGeometry(.083,.022,5,10),ink,s*.095,1.44,.225));g.add(mesh(new THREE.BoxGeometry(.07,.025,.03),ink,0,1.44,.235));}if(id===4){g.add(mesh(new THREE.BoxGeometry(.15,.04,.06),ink,0,1.25,.2));}}else{g.add(mesh(new THREE.CylinderGeometry(.32,.32,.06,10),material('#e6d5a1'),0,1.62,0));g.add(mesh(new THREE.CylinderGeometry(.2,.25,.18,8),material('#dcc993'),0,1.72,0));g.add(mesh(new THREE.BoxGeometry(.3,.35,.16),material('#d59e55'),0,.9,-.24));}g.scale.setScalar(master?1.24:1.08);return g;}
export class World{
 constructor(catalog,callbacks={},atlas={architects:[]},relationships=[]){this.atlas=atlas;this.relationships=relationships;this.edgeFilters=new Set(Object.keys(EDGE_TYPES));this.edgeScope='all';this.catalog=catalog;this.cb=callbacks;this.mode='map';this.quality='auto';this.canvas=$('scene');this.flat=$('flat-world');this.labels=$('map-labels');this.w=1;this.h=1;this.gpu=false;this.active=null;this.path=[];this.keys=new Set();this.padPointers=new Map();this.paused=false;this.playerPos={x:0,z:20};this.islandCamera=new IslandCamera();this.islandCamera.fov=40;this.observation=null;this.suppressIslandClickUntil=0;this.nearest=null;this.seq=0;this.selected=4;this.mapDirty=true;this.suppressMapClickUntil=0;this.reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;this.clock=0;this.last=0;this.globe=buildGlobe(catalog,atlas);this.mapCamera=new THREE.PerspectiveCamera(36,1,.1,500);this.mapOrbit=new GlobeOrbit(this.mapCamera,()=>{this.mapDirty=true;},this.globe.radius);this.bindEvents();this.init3D();this.createLabels();this.resize();this.animate=this.animate.bind(this);this.raf=requestAnimationFrame(this.animate);}
 init3D(){try{const context=this.canvas.getContext('webgl2',{alpha:false,antialias:false,powerPreference:'default'});if(!context)throw Error('WebGL2 unavailable');this.renderer=new THREE.WebGLRenderer({canvas:this.canvas,context,antialias:false});this.renderer.setClearColor('#b8d4cf');this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.22;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#b8d4cf');this.hemisphere=new THREE.HemisphereLight('#fff7df','#6b8978',2.65);this.scene.add(this.hemisphere);this.sun=new THREE.DirectionalLight('#fff2cc',3.2);this.sun.position.set(-35,65,40);this.sun.castShadow=true;this.sun.shadow.mapSize.set(1024,1024);this.sun.shadow.camera.left=-32;this.sun.shadow.camera.right=32;this.sun.shadow.camera.top=32;this.sun.shadow.camera.bottom=-32;this.sun.shadow.bias=-.0006;this.sun.shadow.normalBias=.08;this.scene.add(this.sun);this.camera=new THREE.PerspectiveCamera(40,1,.1,600);this.raycaster=new THREE.Raycaster();this.plane=new THREE.Plane(new THREE.Vector3(0,1,0),-.4);this.mapGroup=new THREE.Group();this.mapMeshes=[];for(const item of this.catalog){const p=mapPosition(item.id),g=batchTerrain(terrain(item.playable?5:4.1,item.id,true));g.position.set(p.x,0,p.z);let b=createMiniature(item);b.position.y=.25;g.add(b);this.mapGroup.add(g);g.userData.id=item.id;this.mapMeshes.push(g);}this.scene.add(this.mapGroup);this.addMapDecorations();this.addAtlasTerrain();this.addRelationshipBridges();this.gpu=true;this.canvas.hidden=false;this.flat.hidden=true;}catch(e){this.gpu=false;this.canvas.hidden=true;this.flat.hidden=false;this.cb.status?.('相容平面模式 · 無 WebGL2');}this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.cb.contextLost?.();});}
 createLabels(){this.labels.replaceChildren();for(const i of this.catalog){let b=document.createElement('button');b.className='island-label'+(i.playable?' playable':'');b.dataset.id=i.id;b.title=`${String(i.id).padStart(2,'0')} ${i.title}｜${i.architect}｜${i.playable?'可探索':'預覽'}${this.atlas.architects.find(a=>a.id===i.id)?.building.siteRole==='original'?'｜歷史原址・原構造已移建':''}`;b.setAttribute('aria-label',b.title);b.innerHTML=`<span class="number">${String(i.id).padStart(2,'0')}</span><span class="name">${i.title}</span>`;b.onclick=()=>{if(!this.paused&&performance.now()>this.suppressMapClickUntil)this.cb.select?.(i.id);};this.labels.append(b);}}
 updateLabels(selected,stamps=[]){this.selected=selected;this.refreshBridges();this.mapDirty=true;if(this.selectionRing){const p=mapPosition(selected);this.selectionRing.position.set(p.x,.28,p.z);this.selectionRing.scale.setScalar(this.catalog.find(i=>i.id===selected)?.playable?1.16:1);}for(const b of this.labels.children){b.classList.toggle('selected',+b.dataset.id===selected);b.classList.toggle('completed',stamps.includes(+b.dataset.id));b.setAttribute('aria-pressed',String(+b.dataset.id===selected));}}
 addMapDecorations(){
  const water=mesh(new THREE.PlaneGeometry(700,700),material('#b8d4cf'),0,-1.4,0);water.rotation.x=-Math.PI/2;water.castShadow=false;this.mapGroup.add(water);
  const waveMaterial=new THREE.MeshBasicMaterial({color:'#a1c9c1',transparent:true,opacity:.48,side:THREE.DoubleSide});
  const waves=new THREE.Group();for(let i=0;i<54;i++){const x=(i%9-4)*15+Math.sin(i)*3,z=(Math.floor(i/9)-2.5)*15;const arc=mesh(new THREE.TorusGeometry(2.8,.035,3,14,1.1),waveMaterial,x,-.95,z);arc.rotation.x=-Math.PI/2;arc.rotation.z=i*.71;arc.castShadow=false;waves.add(arc);}this.mapGroup.add(batchTerrain(waves));
  this.selectionRing=mesh(new THREE.TorusGeometry(5.1,.105,4,48),new THREE.MeshBasicMaterial({color:'#f3d58c'}));this.selectionRing.rotation.x=-Math.PI/2;this.selectionRing.castShadow=false;this.mapGroup.add(this.selectionRing);
 }
 resize(){const rect=$('world').getBoundingClientRect();this.w=Math.max(1,rect.width);this.h=Math.max(1,rect.height);const mobile=this.w<=700,landscape=this.w>=520&&this.h<430;this.mapRect=landscape?{x:232,y:68,w:this.w-244,h:Math.max(100,this.h-145)}:mobile?{x:6,y:this.h<590?137:180,w:this.w-12,h:Math.max(95,this.h-(this.h<590?390:475))}:{x:Math.min(345,this.w*.31),y:113,w:this.w-Math.min(345,this.w*.31)-18,h:Math.max(145,this.h-232)};if(this.gpu){this.renderer.setSize(this.w,this.h,false);this.renderer.setPixelRatio((this.quality==='low'||(this.quality==='auto'&&mobile))?1:Math.min(devicePixelRatio,this.quality==='high'?1.75:1.35));this.camera.aspect=this.w/this.h;this.camera.updateProjectionMatrix();if(this.mode==='island')this.updateCamera();}this.mapOrbit.resize(this.mapRect.w,this.mapRect.h);this.mapDirty=true;if(this.mode==='map')this.layoutLabels();else if(!this.gpu)this.drawFlatIsland();}
 projectMap(p,y=0){const r=this.mapRect,v=new THREE.Vector3(p.x,y,p.z).project(this.mapCamera);return {x:r.x+(v.x+1)*r.w/2,y:r.y+(1-v.y)*r.h/2,visible:v.z>=-1&&v.z<=1};}
 layoutLabels(){const r=this.mapRect;this.mapCamera.updateMatrixWorld();for(const b of this.labels.children){const p=mapPosition(+b.dataset.id),v=this.projectMap({x:p.x,z:p.z+5.2});b.style.left=v.x+'px';b.style.top=v.y+'px';b.hidden=!v.visible||v.x<r.x+10||v.x>r.x+r.w-10||v.y<r.y+8||v.y>r.y+r.h-8;b.classList.toggle('close-view',this.mapOrbit.scale<.56);b.classList.toggle('overview',this.mapOrbit.scale>=.56);}this.drawAtlasOverlay();if(!this.gpu)this.drawFlatMap();const compass=$('map-compass');if(compass)compass.style.transform=`rotate(${-this.mapOrbit.yaw}rad)`;}
 svgPath(points){return points.map((p,i)=>{const v=this.projectMap({x:p[0],z:p[1]},-1);return `${i?'L':'M'}${v.x.toFixed(1)},${v.y.toFixed(1)}`;}).join(' ')+'Z';}
 svgEdge(edge){let d='';for(let i=0;i<=40;i++){const p=edgePoint(edge,i/40),v=this.projectMap(p,.65);d+=`${i?'L':'M'}${v.x.toFixed(1)},${v.y.toFixed(1)} `;}return d;}
 visibleEdges(){return this.relationships.filter(e=>this.edgeFilters.has(e.type)&&(this.edgeScope==='all'||e.from===this.selected||e.to===this.selected));}
 setNetworkFilter(type,on){if(on)this.edgeFilters.add(type);else this.edgeFilters.delete(type);this.refreshBridges();}
 setNetworkScope(scope){this.edgeScope=scope;this.refreshBridges();}
 refreshBridges(){if(this.bridgeGroups){const ids=new Set(this.visibleEdges().map(e=>e.id));for(const g of this.bridgeGroups)g.visible=ids.has(g.userData.edge);}this.mapDirty=true;}
 drawAtlasOverlay(){const target=$('atlas-overlay');if(!target)return;const r=this.mapRect;let svg=`<svg viewBox="0 0 ${this.w} ${this.h}"><defs><clipPath id="atlas-clip"><rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"/></clipPath></defs><g clip-path="url(#atlas-clip)">`;
 for(const region of CONTINENTS){const p=this.projectMap({x:region.label[0],z:region.label[1]},-1);svg+=`<text x="${p.x}" y="${p.y}" text-anchor="middle" class="region-label">${region.name}<tspan x="${p.x}" dy="12" class="region-english">${region.english}</tspan></text>`;}
 for(const e of this.visibleEdges()){const style=EDGE_TYPES[e.type],d=this.svgEdge(e),related=e.from===this.selected||e.to===this.selected;svg+=`<g class="connection-hit ${related?'related':''}" role="button" tabindex="0" aria-label="${e.shortLabel||e.label}：${style.label}，開啟來源說明" data-edge="${e.id}"><title>${e.shortLabel||e.label} · ${style.label}</title><path d="${d}" fill="none" stroke="${style.color}" stroke-width="${related?2.8:1.7}" stroke-dasharray="${style.dash}" opacity="${this.gpu?'.08':related?'.9':'.54'}"/><path d="${d}" fill="none" stroke="transparent" stroke-width="15" class="edge-target"/></g>`;}
 for(const island of EMPTY_ISLANDS){const p=this.projectMap({x:island.x,z:island.z+6});svg+=`<g class="empty-label" data-empty="${island.id}" role="button" tabindex="0" aria-label="${island.name}，查看說明"><title>${island.description}</title><text x="${p.x}" y="${p.y}" text-anchor="middle">◇ ${island.name}</text><rect x="${p.x-55}" y="${p.y-17}" width="110" height="26" fill="transparent"/></g>`;}
 svg+='</g></svg>';target.innerHTML=svg;}
 drawFlatMap(){const r=this.mapRect;let svg=`<svg viewBox="0 0 ${this.w} ${this.h}" aria-hidden="true"><defs><pattern id="waves" width="90" height="55" patternUnits="userSpaceOnUse"><path d="M0 20q10 -4 20 0t20 0" stroke="#91bdb3" opacity=".35" fill="none"/></pattern><clipPath id="flat-clip"><rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"/></clipPath></defs><rect width="100%" height="100%" fill="url(#waves)"/><g clip-path="url(#flat-clip)">`;
 for(const region of CONTINENTS)svg+=`<path d="${this.svgPath(region.points)}" fill="#93b6a3" fill-opacity=".25" stroke="#699b8c" stroke-opacity=".25" stroke-width="1" stroke-dasharray="3 5"/>`;
 const unit=r.h/(this.mapOrbit.baseSpan*this.mapOrbit.scale*2);for(const island of EMPTY_ISLANDS){const v=this.projectMap(island),rx=Math.max(3,island.r*unit),ry=rx*.75;svg+=`<g transform="translate(${v.x},${v.y})"><ellipse rx="${rx*1.15}" ry="${ry*1.15}" fill="#c8dec9"/><ellipse rx="${rx}" ry="${ry}" fill="#94ae93" stroke="#c8b88f" stroke-width="2"/><path d="M${-rx*.45},0L0,${-ry*1.2}L${rx*.45},0" fill="#71947a"/></g>`;}
 for(const i of this.catalog){const p=mapPosition(i.id),v=this.projectMap(p),rx=Math.max(4,(i.playable?5:4.1)*unit),ry=rx*.75;svg+=`<g transform="translate(${v.x},${v.y})"><ellipse rx="${rx*1.22}" ry="${ry*1.24}" fill="#c9ddce"/><ellipse rx="${rx}" ry="${ry}" fill="${i.playable?'#a0b583':'#b6c5a0'}" stroke="#cabc92" stroke-width="2"/><image href="assets/miniatures/${String(i.id).padStart(2,'0')}.png" x="${-rx*1.2}" y="${-rx*1.85}" width="${rx*2.4}" height="${rx*2.4}"/></g>`;}svg+='</g></svg>';this.flat.innerHTML=svg;}
 addAtlasTerrain(){const group=new THREE.Group();for(const region of CONTINENTS){const shape=new THREE.Shape();region.points.forEach((p,i)=>i?shape.lineTo(p[0],p[1]):shape.moveTo(p[0],p[1]));shape.closePath();const g=new THREE.ShapeGeometry(shape),m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:'#88ad9b',transparent:true,opacity:.26,side:THREE.DoubleSide}));m.rotation.x=Math.PI/2;m.position.y=-1.1;group.add(m);}for(const island of EMPTY_ISLANDS){const g=batchTerrain(terrain(island.r,85+island.id.length,true));g.position.set(island.x,0,island.z);group.add(g);}this.mapGroup.add(group);}
 addRelationshipBridges(){this.bridgeGroups=[];for(const e of this.relationships){const g=new THREE.Group(),style=EDGE_TYPES[e.type],distance=Math.hypot(mapPosition(e.from).x-mapPosition(e.to).x,mapPosition(e.from).z-mapPosition(e.to).z),cut=Math.min(.3,6/distance),count=Math.ceil(distance/2.6);for(let i=0;i<count;i++){if(e.type==='thematic'&&i%2)continue;const t=cut+(1-2*cut)*i/count,t2=cut+(1-2*cut)*(i+.9)/count,a=edgePoint(e,t),b=edgePoint(e,t2),length=Math.hypot(b.x-a.x,b.z-a.z);const plank=mesh(new THREE.BoxGeometry(e.type==='mentorship'?.66:.38,.13,length),material(style.color),(a.x+b.x)/2,.48+Math.sin(t*Math.PI)*.18,(a.z+b.z)/2);plank.rotation.y=Math.atan2(b.x-a.x,b.z-a.z);plank.castShadow=false;g.add(plank);if(e.type==='mentorship'&&i%3===0)for(const side of [-1,1]){const pole=mesh(new THREE.CylinderGeometry(.07,.07,.75,4),material('#bf9b66'),a.x+side*.35,.65,a.z);pole.castShadow=false;g.add(pole);}}g.userData.edge=e.id;this.bridgeGroups.push(g);this.mapGroup.add(g);}}
 miniatureInfo(id){return MINIATURE_INFO[id]?.motif||'';}
 mapAction(action){if(this.mode!=='map'||this.paused)return;if(action.startsWith('region-')){const regions={'region-america':[-66,-23,43,45],'region-europe':[11,-34,49,49],'region-japan':[91,-20,40,30]},region=regions[action];if(region){this.mapOrbit.yaw=0;this.mapOrbit.pitch=1.3;this.mapOrbit.target.set(region[0],0,region[1]);this.mapOrbit.scale=clamp(Math.max(region[2],region[3]/this.mapOrbit.aspect)/this.mapOrbit.baseSpan,.13,1.75);this.mapOrbit.update();}}else if(action==='reset')this.mapOrbit.reset();else if(action==='focus')this.mapOrbit.focus(mapPosition(this.selected));else if(action==='left')this.mapOrbit.orbit(-55,0);else if(action==='right')this.mapOrbit.orbit(55,0);else if(action==='in')this.mapOrbit.zoomBy(.78);else if(action==='out')this.mapOrbit.zoomBy(1.28);else if(action==='pan'){this.mapGestures.dragMode=this.mapGestures.dragMode==='pan'?'orbit':'pan';$('map-pan').setAttribute('aria-pressed',String(this.mapGestures.dragMode==='pan'));$('map-pan').textContent=this.mapGestures.dragMode==='pan'?'旋轉模式':'平移模式';}}
 pickMap(clientX,clientY){if(this.mode!=='map'||this.paused)return;const label=document.elementFromPoint(clientX,clientY)?.closest('.island-label');if(label){this.cb.select?.(+label.dataset.id);return;}if(!this.gpu){const bounds=$('world').getBoundingClientRect(),r=this.mapRect,localX=clientX-bounds.left,localY=clientY-bounds.top;if(localX<r.x||localX>r.x+r.w||localY<r.y||localY>r.y+r.h)return;let best=null,distance=22;for(const item of this.catalog){const p=this.projectMap(mapPosition(item.id)),d=Math.hypot(p.x-(clientX-bounds.left),p.y-(clientY-bounds.top));if(d<distance){best=item.id;distance=d;}}if(best)this.cb.select?.(best);return;}const bounds=this.canvas.getBoundingClientRect(),r=this.mapRect,x=clientX-bounds.left-r.x,y=clientY-bounds.top-r.y;if(x<0||x>r.w||y<0||y>r.h)return;this.raycaster.setFromCamera(new THREE.Vector2(x/r.w*2-1,1-y/r.h*2),this.mapCamera);for(const hit of this.raycaster.intersectObjects(this.mapMeshes,true)){let o=hit.object;while(o&&!o.userData.id)o=o.parent;if(o?.userData.id){this.cb.select?.(o.userData.id);return;}}}
 async enter(item,onProgress){
  this.clearIslandInput();this.mapGestures?.cancel();$('world').classList.remove('dragging');
  const ticket=++this.seq;this.abort?.abort();this.abort=new AbortController();const signal=this.abort.signal;
  this.releaseIsland();this.active=item;this.layout=buildingLayout(item);
  this.observation=new ObservationCamera(this.layout.quests,observationShots(item,this.layout),this.reduced);this.observation.enabled=this.gpu;
  this.photoUIKey=null;this.boundaryIndex=null;this.mode='island';this.path=[];this.keys.clear();this.playerPos={...this.layout.spawn};this.nearest=null;
  this.islandCamera.reset(this.w<=700);this.islandCamera.fov=40;this.syncPhotoUI();this.labels.hidden=true;$('atlas-overlay').hidden=true;
  if(!this.gpu){this.drawFlatIsland();this.cb.status?.('相容平面模式 · 縮圖非 3D');return {fallback:true};}
  this.scene.background=new THREE.Color('#b8d4cf');this.mapGroup.visible=false;
  const group=terrain(ISLAND_RADIUS,item.id,false);this.islandGroup=group;this.scene.add(group);
  const dock=mesh(new THREE.BoxGeometry(3.4,.35,8),material('#ae9974'),0,.45,22);group.add(dock);
  for(let z=18;z<26;z+=.6)group.add(mesh(new THREE.BoxGeometry(3.35,.025,.035),material('#806c50'),0,.64,z));
  this.avatar=person('#d37f51');this.avatar.position.set(0,.4,this.playerPos.z);group.add(this.avatar);
  this.npc=person(item.id===3?'#768e83':'#52645f',true,item.id);this.npc.position.set(this.layout.npc.x,.4,this.layout.npc.z);group.add(this.npc);
  this.beacons=[];
  for(let index=0;index<3;index++){
   const p=this.layout.quests[index],b=new THREE.Group();const ring=mesh(new THREE.TorusGeometry(.7,.055,6,32),material('#e8cb72',{emissive:'#8d6e2d',emissiveIntensity:.35}));ring.rotation.x=-Math.PI/2;b.add(ring);
   const pin=mesh(new THREE.OctahedronGeometry(.25),material('#f4d777',{emissive:'#b57b25',emissiveIntensity:.25}),0,1.25,0);b.add(pin);b.position.set(p.x,.5,p.z);this.beacons.push(b);group.add(b);
  }
  group.add(mesh(new THREE.CylinderGeometry(1.05,1.05,.05,24),material('#d8c899'),this.layout.npc.x,.39,this.layout.npc.z));
  this.targetRing=mesh(new THREE.TorusGeometry(.45,.035,6,24),new THREE.MeshBasicMaterial({color:'#f6ecd0'}));this.targetRing.rotation.x=-Math.PI/2;this.targetRing.visible=false;group.add(this.targetRing);this.updateCamera();
  let pendingModel=null,pendingLighting=null;
  try{
   let buffer=await fetchModelBuffer(item.model,{signal,onProgress});
   if(ticket!==this.seq||signal.aborted)return {cancelled:true};onProgress?.(86);
   const loader=new GLTFLoader();loader.setMeshoptDecoder(MeshoptDecoder);
   const gltf=await loader.parseAsync(buffer,new URL(item.model,location.href).href.replace(/[^/]+$/,''));buffer=null;pendingModel=gltf.scene;
   if(ticket!==this.seq||signal.aborted){dispose(pendingModel);return {cancelled:true};}
   prepareBuilding(pendingModel,item);pendingModel.scale.setScalar(this.layout.scale);pendingModel.position.set(-this.layout.center[0]*this.layout.scale,this.layout.modelY,-this.layout.center[2]*this.layout.scale);
   pendingModel.traverse(o=>{if(o.isLight)o.visible=false;});group.add(pendingModel);onProgress?.(90);
   const preparedQuality=this.quality;
   pendingLighting=await createArchitecturalLighting({scene:this.scene,renderer:this.renderer,model:pendingModel,item,layout:this.layout,quality:preparedQuality,signal});
   if(ticket!==this.seq||signal.aborted){pendingLighting?.dispose();if(pendingModel.parent===group)group.remove(pendingModel);dispose(pendingModel);return {cancelled:true};}
   this.model=pendingModel;this.architecturalLighting=pendingLighting;this.sun.visible=false;if(this.hemisphere)this.hemisphere.visible=false;
   // The footer remains usable during preparation. Replay a newer quality choice
   // onto the newly attached controller, and reconcile again if it changes mid-await.
   let appliedQuality=preparedQuality;
   while(appliedQuality!==this.quality){const requested=this.quality;await this.setQuality(requested);if(ticket!==this.seq||signal.aborted)return {cancelled:true};appliedQuality=requested;}
   await this.setTimeOfDay(this.timeOfDay||'day');if(ticket!==this.seq||signal.aborted)return {cancelled:true};onProgress?.(100);return {ready:true,lighting:pendingLighting?.summary};
  }catch(error){
   pendingLighting?.dispose();if(pendingModel?.parent===group)group.remove(pendingModel);dispose(pendingModel);
   if(ticket!==this.seq||signal.aborted||error.name==='AbortError')return {cancelled:true};
   this.releaseIsland();throw error;
  }
 }
 releaseIsland(){
  this.architecturalLighting?.dispose();this.architecturalLighting=null;
  if(this.islandGroup){this.scene?.remove(this.islandGroup);dispose(this.islandGroup);this.islandGroup=null;}
  this.model=null;this.avatar=null;this.npc=null;this.beacons=[];this.targetRing=null;this.observationBoundary=null;this.boundaryIndex=null;
  if(this.sun)this.sun.visible=true;if(this.hemisphere)this.hemisphere.visible=true;
  if(this.scene){this.scene.environment=null;this.scene.fog=null;}this.renderer?.renderLists?.dispose?.();
 }
 async setTimeOfDay(mode){const requested=['day','golden','night'].includes(mode)?mode:'day',controller=this.architecturalLighting;if(!controller){this.timeOfDay=requested;return true;}try{const ok=await controller.setTime(requested);if(controller!==this.architecturalLighting)return false;if(ok)this.timeOfDay=requested;return Boolean(ok);}catch(error){if(controller===this.architecturalLighting&&error.name!=='AbortError')this.cb.toast?.('這個光影情境載入未完成，保留目前情境；可再選一次重試。');return false;}}
 setLamps(enabled){this.architecturalLighting?.setLamps(Boolean(enabled));}

 showMap(){this.observation=null;this.syncPhotoUI();this.clearIslandInput();this.mapGestures?.cancel();$('world').classList.remove('dragging');this.mapDirty=true;++this.seq;this.abort?.abort();this.path=[];this.keys.clear();this.active=null;this.mode='map';this.labels.hidden=false;$('atlas-overlay').hidden=false;this.nearest=null;this.releaseIsland();if(this.gpu){this.scene.background=new THREE.Color('#102a37');this.mapGroup.visible=true;this.renderer.toneMappingExposure=1.22;this.renderer.info.reset();}this.layoutLabels();this.cb.status?.(this.gpu?'3D 六角地球 · 25 件 Q 版建築':'平面投影相容模式 · 非即時 3D');}
 async setQuality(value){this.quality=value;if(this.gpu){this.renderer.shadowMap.enabled=value!=='low';this.sun.castShadow=value!=='low';}this.resize();const controller=this.architecturalLighting;try{const ok=await controller?.setQuality(value);return controller===this.architecturalLighting&&ok!==false;}catch(error){if(controller===this.architecturalLighting&&error.name!=='AbortError')this.cb.toast?.('部分材質畫質未完成更新，保留可用材質；可再選一次重試。');return false;}}
 setPaused(value){this.paused=value;if(value){this.clearIslandInput();this.mapGestures?.cancel();$('world').classList.remove('dragging');} }
 moveTo(point){if(this.mode!=='island'||this.paused)return;if(this.observation)this.observation.allowedIndex=null;if(this.observation?.active!=null){if(this.observation.phase)return;if(this.observation.canStep(this.playerPos,point)){this.path=[point];}else this.cb.toast?.('請點選同一可行走區內、沒有牆面阻擋的地板，或用方向鈕移動。');return;}this.path=findPath(this.playerPos,point,this.layout.rect);if(this.path.length&&this.targetRing){const t=this.path.at(-1);this.targetRing.position.set(t.x,.48,t.z);this.targetRing.visible=true;}if(!this.path.length)this.cb.toast?.('這裡無法通行，請點選建築周圍的步道。');}
 guide(kind,index){if(this.mode!=='island'||this.paused)return;if(this.observation?.active!=null||this.observation?.phase){this.pendingGuide={kind,index};this.manualCamera();this.focusControls();return;}const p=kind==='npc'?this.layout.npc:this.layout.quests[index];this.moveTo(p);if(this.observation)this.observation.allowedIndex=kind==='quest'?index:-1;this.focusControls();}
 focusControls(){(this.gpu?this.canvas:$('world')).focus({preventScroll:true});}
 clearIslandInput(){
  const pads=[...(this.padPointers?.entries()||[])];this.padPointers?.clear();
  for(const [id,{button}] of pads)if(button.hasPointerCapture(id))button.releasePointerCapture(id);
  this.keys.clear();this.path=[];this.pendingGuide=null;if(this.targetRing)this.targetRing.visible=false;
  const surface=$('world'),ids=[...(this.islandGestures?.points.keys()||[])];this.islandGestures?.cancel();
  for(const id of ids)if(surface.hasPointerCapture?.(id))surface.releasePointerCapture(id);
  surface.classList.remove('dragging');
  for(const button of document.querySelectorAll('[data-move].held'))button.classList.remove('held');
 }
 beginPad(direction,button,pointerId){
  if(this.mode!=='island'||this.paused)return;
  this.padPointers??=new Map();this.padPointers.set(pointerId,{direction,button});
  button.setPointerCapture(pointerId);button.classList.add('held');this.keys.add(direction);this.path=[];
 }
 releasePad(pointerId){
  const pad=this.padPointers?.get(pointerId);if(!pad)return;this.padPointers.delete(pointerId);
  if(![...this.padPointers.values()].some(p=>p.direction===pad.direction))this.keys.delete(pad.direction);
  if(![...this.padPointers.values()].some(p=>p.button===pad.button))pad.button.classList.remove('held');
  if(pad.button.hasPointerCapture(pointerId))pad.button.releasePointerCapture(pointerId);
 }
 orbitState(){return {...this.islandCamera,fov:this.islandCamera.fov??40};}
 restoreOrbit(state){if(state)Object.assign(this.islandCamera,state);}
 manualCamera(immediate=false){if(!this.observation)return;this.restoreOrbit(this.observation.override(this.playerPos,{immediate}));this.path=[];this.syncPhotoUI();}
 rotate(d){if(this.mode!=='island'||this.paused||!this.gpu)return;if(this.observation?.active!=null)this.observation.rotate(d);else this.islandCamera.rotate(d);this.updateCamera();}
 tilt(d){if(this.mode!=='island'||this.paused||!this.gpu)return;if(this.observation?.active!=null)this.observation.tilt(d);else this.islandCamera.tilt(d);this.updateCamera();}
 setZoom(d){if(this.mode!=='island'||this.paused||!this.gpu)return;if(this.observation?.active!=null)this.observation.zoomBy(Math.exp(d*.015));else this.islandCamera.zoom(d);this.updateCamera();}
 resetCamera(){if(this.mode!=='island'||this.paused||!this.gpu)return;if(this.observation?.active!=null){this.manualCamera();}else if(!this.observation?.phase){this.islandCamera.reset(this.w<=700);this.islandCamera.fov=40;}this.updateCamera();}
 focusPoint(){/* A quiz pauses the same live player and camera. */}
 leaveObservation(){if(this.mode!=='island'||this.paused)return;this.manualCamera();this.focusControls();this.updateCamera();}
 syncPhotoUI(){
  const o=this.observation,index=o?.active??o?.display,shot=index!=null?o?.shots[index]:null;
  const key=shot?`${index}/${Boolean(this.gpu)}/${o.phase||'live'}`:'free';
  const veil=$('photo-veil');if(veil)veil.style.opacity=this.gpu?o?.opacity||0:0;
  if(key!==this.photoUIKey){this.photoUIKey=key;this.cb.photo?.(shot?{...shot,index,fallback:!this.gpu,transitioning:Boolean(o.phase),returning:o.active===null}:null);}
 }
 updateCamera(){
  if(!this.gpu||this.mode!=='island')return;
  const o=this.observation,live=o?.active!=null||o?.display!=null,pose=o?o.pose(this.playerPos,this.islandCamera):freeCameraPose(this.islandCamera,this.playerPos);
  this.camera.position.fromArray(pose.position);this.camera.fov=pose.fov;this.camera.aspect=this.w/this.h;this.camera.near=pose.near??.1;this.camera.far=pose.far??600;
  this.camera.lookAt(...pose.target);this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();this.architecturalLighting?.updateForCamera(this.camera.position);
  if(this.avatar){this.avatar.visible=!live;this.avatar.position.set(this.playerPos.x,this.playerPos.y??.375,this.playerPos.z);}
  for(const object of [this.npc,...(this.beacons||[])])if(object)object.visible=!live;
  if(this.targetRing)this.targetRing.visible=!live&&Boolean(this.path.length);
  this.updateObservationBoundary();
 }
 updateObservationBoundary(){
  if(!this.islandGroup)return;const o=this.observation,index=o?.active;
  if(index==null){if(this.observationBoundary)this.observationBoundary.visible=false;return;}
  if(this.boundaryIndex!==index||!this.observationBoundary){
   if(this.observationBoundary){this.islandGroup.remove(this.observationBoundary);dispose(this.observationBoundary);}
   const s=o.shots[index],g=new THREE.Group(),gate=s.navigation?.gate,center=gate||o.entryPoint,r=gate?.radius||s.walkRadius;
   const ring=mesh(new THREE.TorusGeometry(r,.022,5,64),new THREE.MeshBasicMaterial({color:'#ffe098',transparent:true,opacity:.82}),center.x,s.floorY+.035,center.z);ring.rotation.x=-Math.PI/2;ring.castShadow=false;g.add(ring);
   this.islandGroup.add(g);this.observationBoundary=g;this.boundaryIndex=index;
  }
  this.observationBoundary.visible=!o.phase;
 }
 setCompleted(indices){this.completed=indices;for(let i=0;i<(this.beacons?.length||0);i++){this.beacons[i].children[1].material.color.set(indices.includes(i)?'#769d7d':'#f4d777');}if(!this.gpu&&this.mode==='island')this.drawFlatIsland();}
 flatProjection(p){const mobile=this.w<=700,scale=Math.min(this.w/(mobile?54:70),(this.h-80)/54),cx=this.w*(mobile?.5:.58),cy=this.h*.56;return {x:cx+p.x*scale,y:cy+p.z*scale*.78,s:scale};}
 drawFlatIsland(){if(!this.active)return;const c=this.flatProjection({x:0,z:0}),r=ISLAND_RADIUS*c.s,layout=this.layout;this.flat.innerHTML=`<svg viewBox="0 0 ${this.w} ${this.h}" aria-hidden="true"><ellipse cx="${c.x}" cy="${c.y}" rx="${r*1.09}" ry="${r*.85}" fill="#ccdec8"/><ellipse cx="${c.x}" cy="${c.y}" rx="${r}" ry="${r*.78}" fill="#d8c59b"/><ellipse cx="${c.x}" cy="${c.y}" rx="${r*.96}" ry="${r*.74}" fill="#a2ba8a"/><ellipse cx="${c.x}" cy="${c.y}" rx="${r*.73}" ry="${r*.58}" stroke="#d8cfab" stroke-width="10" fill="none"/></svg><img class="flat-building" alt="${this.active.title}原模型外觀縮圖" src="${this.active.poster}" style="left:${c.x}px;top:${c.y}px;width:${Math.max(90,(layout.rect.maxX-layout.rect.minX)*c.s)}px;height:${Math.max(70,(layout.rect.maxZ-layout.rect.minZ)*c.s*.78)}px"><span class="flat-caption">無 WebGL2：原模型縮圖，無法呈現 3D 眼高行走</span>`;for(let i=0;i<3;i++){let p=this.flatProjection(layout.quests[i]),b=document.createElement('button');b.className='flat-marker';b.style.left=p.x+'px';b.style.top=p.y+'px';b.textContent=this.completed?.includes(i)?'✓':String(i+1);b.setAttribute('aria-label',`前往觀察點 ${i+1}`);b.dataset.islandQuest=i;this.flat.append(b);}let p=this.flatProjection(layout.npc),npc=document.createElement('button');npc.className='flat-marker npc';npc.style.left=p.x+'px';npc.style.top=p.y+'px';npc.textContent='師';npc.setAttribute('aria-label','走向大師');npc.dataset.islandNpc='true';this.flat.append(npc);this.flatAvatar=document.createElement('span');this.flatAvatar.className='flat-marker avatar';this.flatAvatar.textContent='●';this.flat.append(this.flatAvatar);this.updateFlatAvatar();}
 updateFlatAvatar(){if(!this.flatAvatar)return;const p=this.flatProjection(this.playerPos);this.flatAvatar.style.left=p.x+'px';this.flatAvatar.style.top=p.y+'px';}
 bindEvents(){
  window.addEventListener('resize',()=>this.resize());
  window.addEventListener('blur',()=>{this.clearIslandInput();this.mapGestures?.cancel();});
  document.addEventListener('visibilitychange',()=>{this.clearIslandInput();this.mapGestures?.cancel();this.last=0;});
  window.addEventListener('pagehide',()=>{this.clearIslandInput();});
  document.addEventListener('focusin',e=>{if(this.mode==='island'&&blocksGameKeys(e.target))this.clearIslandInput();});
  window.addEventListener('keydown',e=>{
   if(this.paused||$('modal').open||e.isComposing||e.ctrlKey||e.metaKey||e.altKey)return;
   const key=islandKey(e);
   if(this.mode==='map'&&(e.target===this.canvas||e.target===$('world'))){
    if(['arrowleft','arrowright','arrowup','arrowdown','+','=','-','0','f'].includes(key)){
     e.preventDefault();if(key==='0')this.mapAction('reset');else if(key==='f')this.mapAction('focus');else if(key==='+'||key==='=')this.mapAction('in');else if(key==='-')this.mapAction('out');else if(e.shiftKey)this.mapOrbit.pan(key==='arrowleft'?25:key==='arrowright'?-25:0,key==='arrowup'?25:key==='arrowdown'?-25:0);else this.mapOrbit.orbit(key==='arrowleft'?-20:key==='arrowright'?20:0,key==='arrowup'?-20:key==='arrowdown'?20:0);
    }return;
   }
   if(this.mode!=='island'||blocksGameKeys(e.target))return;
   if(['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d'].includes(key)){e.preventDefault();this.keys.add(key);this.path=[];}
   else if(['q','e','r','+','=','-','[',']',' ','escape'].includes(key)){
    e.preventDefault();if(key==='escape'){this.manualCamera();this.updateCamera();}else if(key==='q')this.rotate(-.12);else if(key==='e')this.rotate(.12);else if(key==='[')this.tilt(-.08);else if(key===']')this.tilt(.08);else if(key==='+'||key==='=')this.setZoom(-3);else if(key==='-')this.setZoom(3);else if(key==='r'&&!e.repeat)this.resetCamera();else if(key===' '&&!e.repeat)this.cb.interact?.();
   }
  });
  window.addEventListener('keyup',e=>this.keys.delete(islandKey(e)));
  this.bindMapEvents();this.bindIslandEvents();
 }
 pickIsland(x,y,target){
  if(this.mode!=='island'||this.paused||this.observation?.phase)return;
  const marker=target?.closest?.('[data-island-quest],[data-island-npc]');
  if(marker){if(marker.dataset.islandNpc)this.guide('npc');else this.guide('quest',+marker.dataset.islandQuest);return;}
  if(!this.gpu){const r=this.flat.getBoundingClientRect(),c=this.flatProjection({x:0,z:0});this.moveTo({x:(x-r.left-c.x)/c.s,z:(y-r.top-c.y)/(c.s*.78)});return;}
  const r=this.canvas.getBoundingClientRect(),live=this.observation?.active!=null;const area={x:0,y:0,w:r.width,h:r.height};const lx=x-r.left-area.x,ly=y-r.top-area.y;if(lx<0||ly<0||lx>area.w||ly>area.h)return;const v=new THREE.Vector2(lx/area.w*2-1,-ly/area.h*2+1);
  this.raycaster.setFromCamera(v,this.camera);const point=new THREE.Vector3();
  const floor=live?(this.observation.shots[this.observation.active].floorY):.4;const plane=new THREE.Plane(new THREE.Vector3(0,1,0),-floor);if(this.raycaster.ray.intersectPlane(plane,point))this.moveTo({x:point.x,z:point.z});else if(live)this.cb.toast?.('請點地面前往，或用 WASD／方向鈕行走；拖曳可上下左右觀看。');
 }
 bindIslandEvents(){
  const surface=$('world');
  this.islandGestures=new IslandGestures({orbit:(x,y)=>{if(this.gpu){if(this.observation?.active!=null)this.observation.look(x,y);else if(!this.observation?.phase)this.islandCamera.orbit(x,y);this.updateCamera();}},zoom:factor=>{if(this.gpu){if(this.observation?.active!=null)this.observation.zoomBy(factor);else if(!this.observation?.phase)this.islandCamera.zoomBy(factor);this.updateCamera();}},select:(x,y,target)=>this.pickIsland(x,y,target)});
  surface.addEventListener('pointerdown',e=>{
   if(this.mode!=='island'||this.paused||!this.islandGestures.down(e))return;
   e.preventDefault();this.focusControls();surface.setPointerCapture(e.pointerId);
  });
  surface.addEventListener('pointermove',e=>{if(this.mode==='island'&&!this.paused&&this.islandGestures.move(e)){surface.classList.add('dragging');this.suppressIslandClickUntil=performance.now()+400;}});
  surface.addEventListener('pointerup',e=>{
   if(this.mode!=='island')return;
   if(this.paused){this.clearIslandInput();return;}
   const result=this.islandGestures.up(e);if(result.handled&&!result.tap)this.suppressIslandClickUntil=performance.now()+400;
   if(surface.hasPointerCapture(e.pointerId))surface.releasePointerCapture(e.pointerId);
   if(!this.islandGestures.points.size)surface.classList.remove('dragging');
  });
  const cancel=()=>{if(this.mode==='island'){this.suppressIslandClickUntil=performance.now()+400;this.clearIslandInput();}};
  surface.addEventListener('pointercancel',cancel);
  surface.addEventListener('lostpointercapture',e=>{if(this.islandGestures.points.has(e.pointerId))cancel();});
  surface.addEventListener('click',e=>{
   if(this.mode!=='island')return;
   if(this.paused||(e.detail>0&&performance.now()<this.suppressIslandClickUntil)){e.preventDefault();e.stopImmediatePropagation();return;}
   // Keyboard-activated accessible fallback markers do not emit pointerup.
   if(e.detail===0&&e.target.closest('[data-island-quest],[data-island-npc]'))this.pickIsland(0,0,e.target);
  },true);
  surface.addEventListener('wheel',e=>{if(this.mode!=='island'||this.paused||!this.gpu)return;e.preventDefault();const factor=Math.exp(clamp(e.deltaY,-120,120)*.002);if(this.observation?.active!=null)this.observation.zoomBy(factor);else if(!this.observation?.phase)this.islandCamera.zoomBy(factor);this.updateCamera();},{passive:false});
  surface.addEventListener('contextmenu',e=>{if(this.mode==='island')e.preventDefault();});
 }
 bindMapEvents(){
  this.mapGestures=new MapGestures({orbit:(x,y)=>this.mapOrbit?.orbit(x,y),pan:(x,y)=>this.mapOrbit?.pan(x,y),zoom:f=>this.mapOrbit?.zoomBy(f),select:(x,y)=>this.pickMap(x,y)});
  const surface=$('world');surface.setAttribute('tabindex','0');const overlay=$('atlas-overlay');const activate=e=>{if(this.paused)return;const edge=e.target.closest('[data-edge]'),empty=e.target.closest('[data-empty]'),master=e.target.closest('[data-master]'),cluster=e.target.closest('[data-cluster]'),geo=e.target.closest('[data-geography]'),currentSite=e.target.closest('[data-current-site]');if(currentSite)this.cb.currentSite?.(+currentSite.dataset.currentSite);else if(master)this.cb.master?.(master.dataset.master);else if(cluster)this.cb.cluster?.(+cluster.dataset.cluster);else if(geo)this.cb.geography?.(+geo.dataset.geography);else if(edge){this.cb.connection?.(edge.dataset.edge);}else if(empty)this.cb.empty?.(empty.dataset.empty);};overlay?.addEventListener('click',activate);overlay?.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate(e);}});
  surface.addEventListener('pointerdown',e=>{if(this.mode!=='map'||this.paused||e.target.closest('[data-edge],[data-empty],[data-master],[data-cluster],[data-geography],[data-current-site]'))return;if(!e.target.closest('.island-label'))(this.gpu?this.canvas:surface).focus({preventScroll:true});this.mapGestures.down(e);surface.setPointerCapture(e.pointerId);surface.classList.add('dragging');});
  surface.addEventListener('pointermove',e=>{if(this.mode!=='map'||this.paused)return;this.mapGestures.move(e);});
  surface.addEventListener('pointerup',e=>{if(this.mode!=='map')return;const p=this.mapGestures.points.get(e.pointerId);if(p?.moved||this.mapGestures.hadMulti)this.suppressMapClickUntil=performance.now()+350;this.mapGestures.up(e);if(surface.hasPointerCapture(e.pointerId))surface.releasePointerCapture(e.pointerId);if(!this.mapGestures.points.size)surface.classList.remove('dragging');});
  surface.addEventListener('pointercancel',()=>{this.mapGestures.cancel();surface.classList.remove('dragging');});
  surface.addEventListener('lostpointercapture',e=>{if(this.mapGestures.points.has(e.pointerId)){this.mapGestures.cancel();surface.classList.remove('dragging');}});
  surface.addEventListener('contextmenu',e=>{if(this.mode==='map')e.preventDefault();});
  surface.addEventListener('wheel',e=>{if(this.mode!=='map'||this.paused)return;e.preventDefault();this.mapOrbit.zoomBy(Math.exp(clamp(e.deltaY,-120,120)*.002));},{passive:false});
 }
 tick(dt){if(this.mode!=='island'||!this.layout||this.paused)return;
  let direction=movementVector(this.keys,this.gpu?(this.observation?.movementYaw??this.islandCamera.yaw):0),distance=Infinity;
  const manual=this.keys.size>0;
  if(manual){this.path=[];this.pendingGuide=null;if(this.observation)this.observation.allowedIndex=null;}
  else if(this.path.length){
   while(this.path.length&&Math.hypot(this.path[0].x-this.playerPos.x,this.path[0].z-this.playerPos.z)<.015)this.path.shift();
   if(this.path.length){const target=this.path[0];direction={x:target.x-this.playerPos.x,z:target.z-this.playerPos.z};distance=Math.hypot(direction.x,direction.z);}
  }
  const before=this.playerPos;this.playerPos=this.observation?.phase?{...before}:this.observation?.active!=null?this.observation.walk(before,direction,dt,distance):walkStep(before,direction,dt,this.layout.rect,distance);if(this.path.length&&Math.hypot(this.playerPos.x-before.x,this.playerPos.z-before.z)<1e-7)this.path=[];
  const dx=this.playerPos.x-before.x,dz=this.playerPos.z-before.z,moving=Math.hypot(dx,dz)>1e-6;
  if(this.gpu&&this.avatar&&moving)this.avatar.rotation.y=Math.atan2(dx,dz);
  if(this.gpu&&this.avatar){this.avatar.position.set(this.playerPos.x,(this.playerPos.y??.375)+(!this.reduced&&moving?Math.sin(this.clock*14)*.035:0),this.playerPos.z);if(this.targetRing&&!this.path.length)this.targetRing.visible=false;if(this.beacons&&!this.reduced)for(let i=0;i<3;i++){this.beacons[i].children[1].position.y=1.25+Math.sin(this.clock*1.8+i)*.12;this.beacons[i].children[1].rotation.y=this.clock*.25;}}else this.updateFlatAvatar();const choices=[{kind:'npc',point:this.layout.npc},...this.layout.quests.map((point,index)=>({kind:'quest',index,point}))];let nearest=null,dist=2.25;for(const p of choices){const d=Math.hypot(p.point.x-this.playerPos.x,p.point.z-this.playerPos.z);if(d<dist){dist=d;nearest={kind:p.kind,index:p.index};}}if(this.observation?.active!=null)nearest={kind:'quest',index:this.observation.active};if(JSON.stringify(nearest)!==JSON.stringify(this.nearest)){this.nearest=nearest;this.cb.near?.(nearest);}if(this.observation){if(!this.path.length&&this.observation.allowedIndex===-1)this.observation.allowedIndex=null;this.restoreOrbit(this.observation.update(this.playerPos,this.orbitState()));const wasActive=this.observation.active;this.observation.advance(dt,this.playerPos);if(this.observation.active!=null||this.observation.phase){if(wasActive!==this.observation.active||this.observation.phase)this.path=[];}this.syncPhotoUI();if(!this.observation.phase&&this.pendingGuide){const next=this.pendingGuide;this.pendingGuide=null;this.guide(next.kind,next.index);}}this.updateCamera();}
 animate(time){this.raf=requestAnimationFrame(this.animate);if(document.hidden)return;const interval=(this.quality==='low'||(this.quality==='auto'&&this.w<=700))?1000/24:1000/40;if(this.last&&time-this.last<interval)return;const dt=this.last?Math.min((time-this.last)/1000,.05):.016;this.last=time;this.clock+=dt;this.tick(dt);if(!this.gpu){if(this.mode==='map'&&this.mapDirty){this.layoutLabels();this.mapDirty=false;}return;}if(this.mode==='island'){this.renderer.setScissorTest(false);this.renderer.setViewport(0,0,this.w,this.h);this.renderer.shadowMap.enabled=!(this.quality==='low'||(this.quality==='auto'&&this.w<=700));this.renderer.render(this.scene,this.camera);this.renderer.setScissorTest(false);}else{if(!this.mapDirty)return;this.layoutLabels();this.mapDirty=false;this.renderer.setScissorTest(false);this.renderer.setViewport(0,0,this.w,this.h);this.renderer.clear();const r=this.mapRect;this.renderer.setViewport(r.x,this.h-r.y-r.h,r.w,r.h);this.renderer.setScissor(r.x,this.h-r.y-r.h,r.w,r.h);this.renderer.setScissorTest(true);this.renderer.shadowMap.enabled=false;this.renderer.render(this.scene,this.mapCamera);this.renderer.setScissorTest(false);}}}

// The globe mixin remains separate from island camera and movement controls.
const islandAnimate=World.prototype.animate;
Object.assign(World.prototype,GlobeMethods);
// Preserve the globe renderer; island live camera always uses the full viewport.
const globeAnimate=World.prototype.animate,globeResize=World.prototype.resize;
World.prototype.animate=function(time){return (this.mode==='island'?islandAnimate:globeAnimate).call(this,time);};
World.prototype.resize=function(){globeResize.call(this);if(this.mode==='island'){this.updateCamera();this.syncPhotoUI();}};

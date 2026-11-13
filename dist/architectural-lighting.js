import * as THREE from 'three';
import {ORIGINAL_TEXTURE_DIMENSIONS} from './lighting-support/texture-dimensions.js';
import {prepareMaterials} from './lighting-support/source-pbr.js';
import {NightLighting} from './lighting-support/source-night.js';
import {NightLighting as FarnsworthNight,HISTORIC_LIGHTING} from './lighting-support/source-farnsworth-night.js';
// Runtime integration only. Source GLBs, profiles, researched fixture configs,
// textures and HDR files are retained byte-for-byte in assets/ and the manifest.
const baseURL=()=>new URL('./',import.meta.url);
const resolve=(path)=>new URL(path,baseURL()).href;
function cancelled(signal){if(signal?.aborted)throw new DOMException('Island lighting cancelled','AbortError');}
async function readJSON(url,signal){const r=await fetch(url,{signal});if(!r.ok)throw Error(`原作設定載入失敗 (${r.status})`);return r.json();}
function collect(root,sets){root.traverse(o=>{if(o.geometry)sets.geometries.add(o.geometry);for(const m of(Array.isArray(o.material)?o.material:o.material?[o.material]:[])){sets.materials.add(m);for(const v of Object.values(m))if(v?.isTexture)sets.textures.add(v);}});}
function disposeResources(sets){for(const g of sets.geometries)g.dispose();for(const m of sets.materials)m.dispose();for(const t of sets.textures){t.dispose();t.image?.close?.();}sets.geometries.clear();sets.materials.clear();sets.textures.clear();}
export function textureSizeForQuality(width,height,cap){const ratio=Number.isFinite(cap)?Math.min(1,cap/Math.max(width,height)):1;return [Math.max(1,Math.round(width*ratio)),Math.max(1,Math.round(height*ratio))];}
async function decodeSurface(blob,width,height,cap){
 const [w,h]=textureSizeForQuality(width,height,cap);
 if(typeof createImageBitmap==='function')return createImageBitmap(blob,{imageOrientation:'flipY',premultiplyAlpha:'none',colorSpaceConversion:'none',...(w<width||h<height?{resizeWidth:w,resizeHeight:h,resizeQuality:'high'}:{})});
 const url=URL.createObjectURL(blob);try{const image=await new Promise((ok,no)=>{const im=new Image();im.onload=()=>ok(im);im.onerror=no;im.src=url;});if(w===width&&h===height)return image;const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;canvas.getContext('2d').drawImage(image,0,0,w,h);return canvas;}finally{URL.revokeObjectURL(url);}
}
async function texture(path,color,renderer,signal,sets,dimensions){
 const r=await fetch(path,{signal});if(!r.ok)throw Error(`原作材質載入失敗 (${r.status})`);const blob=await r.blob();cancelled(signal);
 const [width,height]=dimensions;const cap=sets.textureCap,bitmap=await decodeSurface(blob,width,height,cap);
 if(signal?.aborted){bitmap.close?.();cancelled(signal);}
 const t=new THREE.Texture(bitmap);t.flipY=!(typeof ImageBitmap!=='undefined'&&bitmap instanceof ImageBitmap);t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());t.needsUpdate=true;sets.textures.add(t);sets.textureRecords.set(t,{blob,width,height,cap});return t;
}
async function packsFor(config,catalog,renderer,signal,sets,materialsBase){
 const assets=new Map(catalog.materials.map(x=>[x.id,x])),packs=new Map(),used=[...new Set(Object.values(config.pbrProfiles||{}).map(x=>x.texture).filter(Boolean))];
 const results=await Promise.allSettled(used.map(async id=>{const asset=assets.get(id);if(!asset)throw Error('原作材質資料缺少 '+id);const p=asset.variants.web_compact||asset.variants['1k'];const read=async(key,color)=>p[key]?texture(new URL(p[key].path,materialsBase).href,color,renderer,signal,sets,ORIGINAL_TEXTURE_DIMENSIONS[p[key].path]||[1024,1024]):null;
 // allSettled waits for every owned texture before failure disposal, avoiding late leaks.
 const r=await Promise.allSettled([read('basecolor',true),read('roughness',false),read('normal',false)]);const bad=r.find(x=>x.status==='rejected');if(bad)throw bad.reason;packs.set(id,{map:r[0].value,roughnessMap:r[1].value,normalMap:r[2].value,asset});}));
 const bad=results.find(x=>x.status==='rejected');if(bad)throw bad.reason;return packs;
}
function copyEnvironment(from,to){for(const key of ['background','environment','backgroundIntensity','backgroundBlurriness','environmentIntensity'])to[key]=from[key];to.backgroundRotation.copy(from.backgroundRotation);to.environmentRotation.copy(from.environmentRotation);}
export async function createArchitecturalLighting({scene,renderer,model,item,layout,quality='auto',signal}){
 cancelled(signal);const mobile=typeof window!=='undefined'&&window.matchMedia('(max-width: 700px)').matches;const effective=q=>q==='low'||(q==='auto'&&mobile)?'low':'high';const token={},sets={textures:new Set(),materials:new Set(),geometries:new Set(),textureRecords:new Map(),textureCap:effective(quality)==='low'?512:Infinity},stage=new THREE.Scene();let lighting=null,disposed=false,attached=false,qualityGeneration=0;
 const original={background:scene.background,environment:scene.environment,backgroundIntensity:scene.backgroundIntensity,backgroundBlurriness:scene.backgroundBlurriness,environmentIntensity:scene.environmentIntensity,backgroundRotation:scene.backgroundRotation.clone(),environmentRotation:scene.environmentRotation.clone(),exposure:renderer.toneMappingExposure};
 const modelBase=new URL('./',resolve(item.model));const materialsBase=resolve('assets/_original-materials/');
 const cleanup=()=>{if(disposed)return;disposed=true;++qualityGeneration;sets.textureRecords.clear();if(lighting){lighting.disposed=true;++lighting.request;for(const o of[lighting.sun,lighting.sun.target,lighting.fixtures]){o?.removeFromParent();if(o)collect(o,sets);}for(const light of[lighting.sun,...lighting.lamps]){light.shadow?.map?.dispose();light.shadow?.mapPass?.dispose();}for(const task of lighting.cache.values())Promise.resolve(task).then(x=>{x.hdr.dispose();x.environment.dispose();},()=>{});if(lighting.nightSky){lighting.nightSky.hdr.dispose();lighting.nightSky.environment.dispose();}lighting.pmrem.dispose();}
  // The previous island must never clear a newer island's environment.
  if(attached&&scene.userData.architecturalLightingOwner===token){copyEnvironment(original,scene);renderer.toneMappingExposure=original.exposure;delete scene.userData.architecturalLightingOwner;}disposeResources(sets);signal?.removeEventListener('abort',cleanup);};
 try{
  const [config,catalog,historic]=await Promise.all([readJSON(new URL('config.json',modelBase),signal),readJSON(new URL('materials.json',modelBase),signal),Number(item.id)===4?null:readJSON(new URL('historic-lighting.json',modelBase),signal)]);cancelled(signal);
  const packs=await packsFor(config,catalog,renderer,signal,sets,materialsBase);cancelled(signal);
  collect(model,sets);
  // Parent prepares context first. UV physical tile dimensions and emission bands
  // are evaluated in ORIGINAL model metres before restoring island placement.
  const saved={parent:model.parent,position:model.position.clone(),quaternion:model.quaternion.clone(),scale:model.scale.clone()};
  model.removeFromParent();
  model.position.set(0,0,0);model.quaternion.identity();model.scale.set(1,1,1);model.updateMatrixWorld(true);
  let materialDiagnostics;
  try{materialDiagnostics=await prepareMaterials(model,renderer,config.pbrProfiles||{},catalog,packs);cancelled(signal);
   lighting=Number(item.id)===4?new FarnsworthNight(renderer,stage,catalog):new NightLighting(renderer,stage,catalog,historic);
   lighting.signal=signal;lighting.materialsBase=materialsBase;
   if(lighting.bindModel)lighting.bindModel(model);else model.traverse(o=>{for(const m of(Array.isArray(o.material)?o.material:o.material?[o.material]:[]))if(m.emissive)m.emissiveIntensity=0;});
  }finally{model.position.copy(saved.position);model.quaternion.copy(saved.quaternion);model.scale.copy(saved.scale);if(saved.parent)saved.parent.add(model);model.updateMatrixWorld(true);collect(model,sets);}
  // Drop superseded GLTF materials/geometries immediately, not at island exit.
  // Shared textures still referenced by a retained material are kept alive.
  const reachable={textures:new Set(),materials:new Set(),geometries:new Set()};collect(model,reachable);
  const liveImages=new Set([...reachable.textures].map(t=>t.image));
  for(const key of ['geometries','materials','textures'])for(const value of [...sets[key]])if(!reachable[key].has(value)){value.dispose();if(key==='textures'&&!liveImages.has(value.image))value.image?.close?.();sets[key].delete(value);if(key==='textures')sets.textureRecords.delete(value);}
  cancelled(signal);const worldScale=model.getWorldScale(new THREE.Vector3());const s=Math.max(Math.abs(worldScale.x),Math.abs(worldScale.y),Math.abs(worldScale.z));const fixtureRoot=lighting.fixtures;model.matrixWorld.decompose(fixtureRoot.position,fixtureRoot.quaternion,fixtureRoot.scale);fixtureRoot.updateMatrixWorld(true);
  // Point/spot candela scale quadratically with miniature world dimensions, so
  // original illuminance ratios survive. WebGLLights extracts rotation only for
  // area half-vectors, so area width/height need explicit world-scale conversion;
  // source luminance/baseIntensity stays unchanged.
  for(const light of lighting.lamps){if(light.isRectAreaLight){light.width*=s;light.height*=s;}else{light.userData.baseIntensity*=s*s;light.intensity*=s*s;light.distance*=s;}if(light.shadow){light.shadow.camera.near=Math.max(.002,.025*s);light.shadow.camera.far=Math.max(light.distance,1);light.shadow.normalBias=.006*s;}}
  const rawBounds=item.bounds||config.bounds;const box=new THREE.Box3(new THREE.Vector3(...rawBounds.min),new THREE.Vector3(...rawBounds.max)).applyMatrix4(model.matrixWorld);lighting.fit(box);
  if(lighting.diagnostics.indoor?.maxActiveLights){lighting.diagnostics.indoor.maxActiveLights.high=Math.min(mobile?6:12,lighting.diagnostics.indoor.maxActiveLights.high);lighting.diagnostics.indoor.maxActiveLights.low=Math.min(4,lighting.diagnostics.indoor.maxActiveLights.low);}
  lighting.setQuality(effective(quality),mobile);lighting.setLamps(false);await lighting.select('daylight');cancelled(signal);
  // No scene mutation until materials, fixtures and initial environment all ready.
  for(const child of [...stage.children])scene.add(child);copyEnvironment(stage,scene);lighting.scene=scene;renderer.toneMappingExposure=lighting.exposure;scene.userData.architecturalLightingOwner=token;attached=true;signal?.addEventListener('abort',cleanup,{once:true});
  const available=Number(item.id)!==18&&Number(item.id)!==21&&(lighting.lamps.length>0||(lighting.bindings?.length||0)>0);
  let mode='day',lampsWanted=true;const cameraSource=new THREE.Vector3();const worldToSource=new THREE.Matrix4().copy(fixtureRoot.matrixWorld).invert();
  const summary={id:Number(item.id),artificialLightingAvailable:available,artificialLightingStatus:historic?.artificialLightingStatus||(available?'source-informed-educational-estimate':'unavailable'),title:historic?.summary||'原來源中的三臂落地燈與廚房檯下螢光燈，位置與光度為教學估算。',sources:historic?.sources||HISTORIC_LIGHTING.sources,sourceUnits:'metres before game placement',availableLights:lighting.lamps.length,materialDiagnostics,originalMaterials:true,textureQuality:{requested:quality,maximumEdge:Number.isFinite(sets.textureCap)?sets.textureCap:null,status:'ready',sourceFilesUnchanged:true},materialInterpretation:config.materials,confidence:historic?.confidence||'Source-informed educational approximation, not measured photometry',notes:historic?.notes||['Fixture form, dimensions, placement and output follow the original educational source, not a measured restoration.'],activeLightBudget:lighting.diagnostics.indoor?.maxActiveLights||{high:6,low:6},lightSamplesAreNotFixtureCounts:true,indirectBounce:false,hardwareRayTracing:false};
  return{summary,
   async setTime(value){if(disposed)return false;cancelled(signal);const selected={day:'daylight',golden:'warm',night:'night',daylight:'daylight',warm:'warm'}[value]||'daylight';const ok=await lighting.select(selected);if(disposed||signal?.aborted)return false;if(ok){mode=value;renderer.toneMappingExposure=lighting.exposure;lighting.setLamps(selected==='night'&&lampsWanted&&available);}return ok;},
   async setQuality(value){
    if(disposed||signal?.aborted)return false;const generation=++qualityGeneration,cap=effective(value)==='low'?512:Infinity;lighting.setQuality(effective(value),mobile);summary.textureQuality.requested=value;summary.textureQuality.status='loading';
    const records=[...sets.textureRecords.entries()];let index=0,failed=false;
    const worker=async()=>{while(index<records.length){const [t,record]=records[index++];if(disposed||signal?.aborted||generation!==qualityGeneration)return;if(record.cap===cap)continue;let bitmap;try{bitmap=await decodeSurface(record.blob,record.width,record.height,cap);if(disposed||signal?.aborted||generation!==qualityGeneration||!sets.textures.has(t)){bitmap.close?.();return;}const old=t.image;t.image=bitmap;t.needsUpdate=true;record.cap=cap;old?.close?.();}catch{bitmap?.close?.();failed=true;}}};
    await Promise.all([worker(),worker(),worker()]);if(disposed||signal?.aborted||generation!==qualityGeneration)return false;sets.textureCap=cap;const caps=[...sets.textureRecords.values()].map(r=>r.cap);summary.textureQuality.maximumEdge=caps.some(v=>!Number.isFinite(v))?null:Math.max(0,...caps);summary.textureQuality.status=failed?'partial':'ready';return !failed;
   },
   setLamps(value){lampsWanted=!!value;if(!disposed)lighting.setLamps(mode==='night'&&lampsWanted&&available);},
   updateForCamera(position){if(disposed)return false;cameraSource.copy(position).applyMatrix4(worldToSource);return lighting.updateForCamera?.(cameraSource)||false;},
   dispose:cleanup
  };
 }catch(error){cleanup();throw error;}
}

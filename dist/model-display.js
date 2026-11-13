import * as THREE from 'three';
import {prepareExpandedContext} from './expanded-model-context.js';
// Keep the archived GLB byte-identical. Hide its old site landscape so the
// architecture can be placed on the game's invented island, not a second lawn.
export function prepareBuilding(root,item){
 const expanded=prepareExpandedContext(root,item);root.updateMatrixWorld(true);let hiddenContext=expanded.hiddenContext,removedContextTriangles=expanded.removedContextTriangles;
 const masks={3:/^(Warm-grey concrete pavement|Garden soil|Garden leaf muted)$/,4:/^(Meadow|Tree bark|Foliage_)/,5:/^(Mown grass|Crushed light aggregate|Context leaf)/};
 root.traverse(o=>{if(!o.isMesh)return;const name=o.material?.name||'';if(masks[item.id]?.test(name)){o.visible=false;hiddenContext++;return;}
 // In the Savoye source, tree trunks and parquet share one material primitive.
 // Keep its triangles within the architectural footprint, dropping only distant context.
 if(item.id===5&&name==='Oak parquet - satin'){
  const geometry=o.geometry,position=geometry.attributes.position,index=geometry.index;const kept=[],v=new THREE.Vector3(),b=item.bounds,margin=.5,count=index?index.count:position.count;
  for(let i=0;i<count;i+=3){let cx=0,cz=0;for(let j=0;j<3;j++){const k=index?index.getX(i+j):i+j;v.fromBufferAttribute(position,k).applyMatrix4(o.matrixWorld);cx+=v.x/3;cz+=v.z/3;}if(cx>=b.min[0]-margin&&cx<=b.max[0]+margin&&cz>=b.min[2]-margin&&cz<=b.max[2]+margin){for(let j=0;j<3;j++)kept.push(index?index.getX(i+j):i+j);}else removedContextTriangles++;}
  geometry.setIndex(kept);geometry.computeBoundingSphere();
 }
 o.castShadow=true;o.receiveShadow=true;
 });return {hiddenContext,removedContextTriangles};
}

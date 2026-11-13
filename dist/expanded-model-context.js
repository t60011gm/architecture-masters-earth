import * as THREE from 'three';
// Display-only landscape masks. Original archived GLB bytes remain unchanged.
// Explicit material names preserve winter gardens, architectural pools and furniture.
const hide = {
  1:/^Earth_path$/,
  6:/^PBR \| (limestone site paving|restrained lawn)$/,
  7:/^PBR_(Lawn|Fine_gravel|Illustrative_leaf_07_)/,
  8:/^PBR \| (quiet campus lawn|immediate weathered paving|tile mortar substrate)$/,
  9:/^(Michigan deciduous bark|Woodland soil \| procedural|Lake Michigan \| water|Asphalt|Context leaf shade)/,
  10:/^(Houston lawn|Tree bark|Context leaf shade)/,
  11:/^(PBR • (Gunma forest lawn|park bark)|Context leaf )/,
  12:/^PBR \| Existing pale stone context$/,
  13:/^PBR \| (pale plaza paving|schematic planted edge)$/,
  14:/^(Mown lawn •|Dark fine-grain asphalt|Fine neutral aggregate gravel|Precast kerb concrete|Context bark|Context foliage)/,
  15:/^(Landscape grass|Reflecting pond water|Tree trunks|PBR_Illustrative_leaf_15_)/,
  16:/^(Coastal sparse vegetation and earth|Atlantic water)$/,
  17:/^PBR \| gravel base$/,
  18:/^(09 Grass - procedural|13 Pale park gravel|14 Tree trunks|15 Tree canopy)$/,
  19:/^PBR \| (mown green plateau|tree bark|summer foliage)$/,
  20:/^(Asphalt|PBR • muted grass context)$/,
  21:/^Kobe courtyard • compact mineral surface$/,
  22:/^Asphalt$/,
  23:/^(PBR \| (muted park lawn|grey aggregate paving|rough tree bark)|Context leaf )/,
  25:/^M12_Granite_urban_paving$/
};
const crop = {
  1:/^(Belgian_blue_limestone|Dark_iron_and_lead|Warm_ivory_lime_plaster)$/,
  2:/^(Party wall lime masonry|Warm original lime plaster)$/,
  7:/^PBR_(Dark_timber|Oiled_pine)$/,
  8:/^PBR \| tile mortar substrate$/,
  9:/^Weathered redwood decking$/,
  10:/^(Concrete and porch aggregate|Tree bark)$/,
  13:/^PBR \| cast concrete$/,
  15:/^Warm grey terrazzo and atrium paving$/,
  16:/^Granite — weathered coastal rock$/,
  20:/^PBR • light precast terrace paver$/,
  25:/^M05_Anodized_dark_metal$/
};
export function prepareExpandedContext(root,item) {
  if([3,4,5].includes(Number(item.id)))return {hiddenContext:0,removedContextTriangles:0};
  if(root.userData.expandedContextPrepared)return root.userData.expandedContextPrepared;
  root.updateMatrixWorld(true);let hiddenContext=0,removedContextTriangles=0;
  const cropBounds={7:{min:[-21,-Infinity,-23],max:[27,Infinity,20]},10:{min:[-67,-Infinity,-26],max:[67,Infinity,26]},20:{min:[-19,-Infinity,-19],max:[19,Infinity,19]}};
  const bounds=cropBounds[item.id]||item.sourceBounds||item.originalConfigBounds||item.bounds;
  root.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const name=mesh.material?.name||'';
    if(hide[item.id]?.test(name)){mesh.visible=false;mesh.userData.skipCollision=true;hiddenContext++;return;}
    if(bounds&&crop[item.id]?.test(name)){
      const old=mesh.geometry,g=old.clone(),p=g.attributes.position,idx=g.index,kept=[],v=new THREE.Vector3();
      const count=idx?idx.count:p.count;
      for(let i=0;i<count;i+=3){let x=0,z=0,within=true;const ids=[];for(let k=0;k<3;k++){const id=idx?idx.getX(i+k):i+k;ids.push(id);v.fromBufferAttribute(p,id).applyMatrix4(mesh.matrixWorld);x+=v.x/3;z+=v.z/3;within&&=v.x>=bounds.min[0]-.5&&v.x<=bounds.max[0]+.5&&v.z>=bounds.min[2]-.5&&v.z<=bounds.max[2]+.5;}
        if(within)kept.push(...ids);else removedContextTriangles++;
      }
      g.setIndex(kept);g.computeBoundingSphere();g.userData.sourceContextCrop=true;mesh.geometry=g;old.dispose();
      if(!kept.length){mesh.visible=false;mesh.userData.skipCollision=true;}
    }
  });
  const result={hiddenContext,removedContextTriangles};root.userData.expandedContextPrepared=result;return result;
}
export function visibleArchitectureBounds(root){
 root.updateMatrixWorld(true);const box=new THREE.Box3(),v=new THREE.Vector3();
 root.traverseVisible(mesh=>{if(!mesh.isMesh)return;const g=mesh.geometry,p=g.attributes.position,idx=g.index;if(!p)return;const count=idx?idx.count:p.count;for(let i=0;i<count;i++){v.fromBufferAttribute(p,idx?idx.getX(i):i).applyMatrix4(mesh.matrixWorld);box.expandByPoint(v);}});return box;
}

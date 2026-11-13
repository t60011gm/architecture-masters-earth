import * as THREE from 'three';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';

// Playful architectural miniatures, not measured reconstructions. Poster massing
// is retained; recognisable structural details are deliberately a little plumper.
// Every surface is opaque. Static pieces are merged by material before returning.
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({color, roughness: .8, ...extra});
const M = {
  white: mat('#f5f1df'), concrete: mat('#d2d4cc'), concreteDark: mat('#a1aaa7'),
  glass: mat('#9ebfbd', {roughness:.34}), glassLight: mat('#c7dcd5', {roughness:.38}),
  glassBlue: mat('#aac6d1', {roughness:.36}), glassDark: mat('#46616a'),
  ink: mat('#34454a'), clay: mat('#bf785e'), clayLight: mat('#da9a7e'),
  pink: mat('#ce9085'), pinkDark: mat('#a16b65'), sand: mat('#d7c5a0'),
  wood: mat('#bc976b'), woodDark: mat('#795c45'), red: mat('#d86554'),
  gold: mat('#d5ad60', {metalness:.22}), stone: mat('#a8b2a8'),
  light: mat('#fff1bd', {emissive:'#ffdf9c', emissiveIntensity:.3}),
  crossLight: mat('#fff6cc', {emissive:'#ffe4a0', emissiveIntensity:.95}),
  water: mat('#7eaba9'), panel: mat('#f7f4e8', {side:THREE.DoubleSide}),
};
const PI = Math.PI;
const UP = new THREE.Vector3(0,1,0);

function mesh(g, geo, material, x=0, y=0, z=0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x,y,z); m.castShadow = true; m.receiveShadow = true;
  g.add(m); return m;
}
function box(g, w,h,d, x,y,z, material=M.white) {
  return mesh(g,new THREE.BoxGeometry(w,h,d),material,x,y,z);
}
function cylinder(g,r,h,x,y,z,material=M.concrete,segments=10) {
  return mesh(g,new THREE.CylinderGeometry(r,r,h,segments),material,x,y,z);
}
function beam(g,a,b,width,material=M.white,depth=width) {
  const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),delta=bv.clone().sub(av);
  const m=box(g,width,delta.length(),depth,0,0,0,material);
  m.position.copy(av.add(bv).multiplyScalar(.5));m.quaternion.setFromUnitVectors(UP,delta.normalize());return m;
}
function footprint(g,points,height,y,material=M.white) {
  const shape=new THREE.Shape(points.map(([x,z])=>new THREE.Vector2(x,-z)));
  const geo=new THREE.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false,curveSegments:1});
  geo.rotateX(-PI/2);return mesh(g,geo,material,0,y,0);
}
function face(g,points,material=M.panel) {
  const normal=new THREE.Vector3().subVectors(new THREE.Vector3(...points[1]),new THREE.Vector3(...points[0])).cross(new THREE.Vector3().subVectors(new THREE.Vector3(...points[2]),new THREE.Vector3(...points[0])));
  if(normal.y<0)points=[...points].reverse();
  const p=[];for(let i=1;i<points.length-1;i++)p.push(...points[0],...points[i],...points[i+1]);
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.computeVertexNormals();
  return mesh(g,geo,material);
}
function base(g,w=4,d=3.3) {box(g,w,.12,d,0,.06,0,M.sand);}
function gable(g,w,d,rise,x,y,z,material=M.clay) {
  const s=new THREE.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(0,rise);s.closePath();
  const geo=new THREE.ExtrudeGeometry(s,{depth:d,bevelEnabled:false,curveSegments:1});
  return mesh(g,geo,material,x,y,z-d/2);
}
function hipRoof(g,w,d,rise,x,y,z,material=M.clay) {
  const a=[x-w/2,y,z-d/2],b=[x+w/2,y,z-d/2],c=[x+w/2,y,z+d/2],e=[x-w/2,y,z+d/2];
  const r1=[x-w*.22,y+rise,z],r2=[x+w*.22,y+rise,z];
  face(g,[a,b,r2,r1],material);face(g,[b,c,r2],material);face(g,[c,e,r1,r2],material);face(g,[e,a,r1],material);
  box(g,w,.075,d,x,y-.025,z,material===M.white?M.concreteDark:M.woodDark);
}
function rock(g,x,z,scale=1) {
  const m=mesh(g,new THREE.IcosahedronGeometry(.36,0),M.stone,x,.18*scale,z);
  m.scale.set(scale*1.3,scale*.7,scale);m.rotation.set(.2,x*.6,z*.4);
  m.updateMatrixWorld(true);m.position.y+=.12-new THREE.Box3().setFromObject(m).min.y;
}

function vitra(g) {
  base(g,4.2,2.4);
  // Concrete planes slide past one another; the long canopy ends in a sharp point.
  footprint(g,[[-1.95,-.45],[1.3,-.63],[1.67,.43],[-1.65,.6]],1.08,.12,M.concrete);
  footprint(g,[[-2,-.6],[1.82,-.45],[2.08,.7],[-1.6,.54]],.13,1.2,M.white);
  footprint(g,[[-1.95,-.55],[-1.71,-.53],[-1.25,.9],[-1.47,.93]],1.64,.12,M.concrete);
  footprint(g,[[-1.6,-.67],[1.31,-.67],[1.7,-.5],[-1.52,-.4]],.16,1.58,M.concreteDark);
  box(g,2.83,.74,.045,.02,.62,.587,M.glassDark);
  for(let i=0;i<5;i++) {
    const x=-1.16+i*.57;
    box(g,.49,.62,.055,x,.64,.618,i%2?M.glass:M.glassBlue);
    beam(g,[x-.28,.18,.66],[x-.21,1.23,.55],.06,M.concrete);
  }
  beam(g,[1.72,.12,.7],[1.57,1.24,.66],.085,M.white);
  footprint(g,[[-2.02,.7],[-.88,.65],[1.8,1.05],[1.2,1.12]],.035,.122,M.concreteDark);
}

function zueblin(g) {
  base(g,4,3.8);
  // Reddish precast office wings step down beside the huge glazed gabled atrium.
  // Reference: zueblin.de/de/projekte/das-zueblin-haus
  for(const side of [-1,1]) {
    for(let i=0;i<5;i++) {
      const z=(i-2)*.64,h=[1.25,1.8,2.18,1.8,1.25][i];
      box(g,.85,h,.67,side*1.25,.12+h/2,z,M.glassDark);
      box(g,.96,.12,.76,side*1.25,.12+h,z,M.pink);
      for(let y=.34;y<h+.1;y+=.32)box(g,.9,.095,.7,side*1.25,y,z,M.pink);
      for(const dx of [-.38,0,.38])box(g,.065,h,.7,side*1.25+dx,.12+h/2,z,M.pinkDark);
    }
    for(const z of [-.77,.77]) {
      box(g,.29,2.3,.3,side*1.62,1.27,z,M.pink);
      box(g,.39,.15,.4,side*1.62,2.46,z,M.white);
      mesh(g,new THREE.ConeGeometry(.18,.24,4),M.pink,side*1.62,2.64,z).rotation.y=PI/4;
    }
  }
  box(g,1.6,1.98,3.05,0,1.11,0,M.glassLight);
  gable(g,1.7,3.32,.82,0,2.1,0,M.glassBlue);
  for(let z=-1.62;z<1.7;z+=.41) {
    beam(g,[-.86,2.1,z],[0,2.94,z],.045,M.white);
    beam(g,[0,2.94,z],[.86,2.1,z],.045,M.white);
  }
  for(const x of [-.72,-.36,0,.36,.72])box(g,.045,1.96,.04,x,1.11,1.55,M.white);
  for(const y of [.75,1.4,2.1])box(g,1.7,.045,.05,0,y,1.56,M.white);
  box(g,.8,.12,.4,0,.17,1.8,M.white);
}

function boaNova(g) {
  base(g,4.2,3.8);
  // Low interlocking tiled roofs nestle into the coastal granite instead of a tower.
  for(const [x,z,s] of [[-1.6,-.9,1.3],[1.55,-.75,1.4],[1.65,.3,1.3],[-1.7,.7,1],[-.95,1.38,.85],[.9,1.5,.7],[-.3,-1.5,.7]])rock(g,x,z,s);
  box(g,1.8,.73,1.65,-.78,.53,-.14,M.white);
  box(g,1.5,.76,1.96,.8,.54,-.3,M.white);
  box(g,1.75,.33,.035,-.79,.73,.7,M.glassDark);
  box(g,1.4,.31,.035,.81,.75,.695,M.glassDark);
  hipRoof(g,2.12,1.95,.34,-.79,1.04,-.16,M.clay);
  hipRoof(g,1.76,2.22,.39,.81,1.08,-.3,M.clayLight);
  hipRoof(g,1.1,.88,.29,.3,1.22,-1.03,M.clay);
  box(g,.2,.43,.25,1.1,1.5,-.9,M.white);
  for(let i=0;i<5;i++)box(g,.84,.09,.28,.0,.165+i*.075,1.58-i*.17,M.white);
  for(const x of [-1.4,-.8,-.2,.4,1.0,1.45])box(g,.045,.3,.065,x,.75,.73,M.woodDark);
  box(g,1.18,.045,.55,-.9,.16,1.18,M.concrete);
}

function churchOfLight(g) {
  base(g,3.8,3.7);
  // The cross remains a true gap, exaggerated slightly so it reads on the map.
  // Its bright backing sits just behind the face, not deep inside the thick wall.
  box(g,2.5,.13,3.15,0,.18,0,M.concreteDark);
  box(g,.16,2.12,3.05,-1.19,1.31,0,M.concrete);
  box(g,.16,2.12,3.05,1.19,1.31,0,M.concrete);
  box(g,2.53,.15,3.15,0,2.38,0,M.concrete);
  box(g,2.28,2.08,.025,0,1.3,1.535,M.crossLight);
  for(const x of [-.675,.675]) {
    box(g,1.03,1.04,.18,x,.77,1.48,M.concrete);
    box(g,1.03,.83,.18,x,1.945,1.48,M.concrete);
  }
  box(g,2.35,2.06,.12,0,1.3,-1.49,M.concrete);
  const diagonal=box(g,.15,2.17,3.15,-.86,1.325,-.32,M.white);diagonal.rotation.y=-.26;
  for(const x of [-1.275,1.275])for(const y of [.82,1.47,2.12])box(g,.012,.012,2.8,x,y,0,M.concreteDark);
  box(g,.76,.085,.65,.55,.17,1.89,M.concrete);
}

function serpentine(g) {
  base(g,3.8,3.7);
  // Ito + Balmond: a rotating-square-derived web, not a conventional window grid.
  // Reference: serpentinegalleries.org/whats-on/serpentine-gallery-pavilion-2002-toyo-ito-and-cecil-balmond-arup/
  box(g,3.1,.08,3.1,0,.17,0,M.white);
  const y0=.21,y1=1.78;
  const facade=[[-1.5,y0],[-1.5,y1],[-.6,y1],[.04,y0],[.65,y1],[1.5,y0],[1.5,y1],[-.8,y0]];
  for(const side of [-1,1]) {
    box(g,3.0,1.57,.045,0,.995,side*1.5,M.glassLight);
    box(g,.045,1.57,3.0,side*1.5,.995,0,M.glass);
    face(g,[[-1.5,y0,side*1.53],[-.65,y1,side*1.53],[-.4,y0,side*1.53]]);
    face(g,[[.1,y1,side*1.53],[.88,.63,side*1.53],[1.5,y1,side*1.53]]);
    face(g,[[side*1.53,y0,-1.5],[side*1.53,y1,-.45],[side*1.53,y0,.02]]);
    face(g,[[side*1.53,y1,.15],[side*1.53,y0,1.5],[side*1.53,y1,1.5]]);
    for(const [a,b] of [[0,2],[1,3],[2,5],[3,4],[4,5],[6,7]]) {
      beam(g,[facade[a][0],facade[a][1],side*1.55],[facade[b][0],facade[b][1],side*1.55],.065,M.white);
      beam(g,[side*1.55,facade[a][1],facade[a][0]],[side*1.55,facade[b][1],facade[b][0]],.065,M.white);
    }
  }
  box(g,3.12,.075,3.12,0,1.81,0,M.glassLight);
  const points=[[-1.5,-1.5],[-.55,-1.5],[.64,-1.5],[1.5,-.66],[1.5,.74],[.43,1.5],[-.74,1.5],[-1.5,.45]];
  for(const [a,b] of [[0,3],[0,5],[1,4],[1,6],[2,5],[2,7],[3,6],[4,7]])beam(g,[points[a][0],1.865,points[a][1]],[points[b][0],1.865,points[b][1]],.075,M.white);
  face(g,[[-1.52,1.85,-1.52],[-.55,1.85,-1.52],[-1.52,1.85,.45]]);
  face(g,[[1.52,1.85,.74],[.43,1.85,1.52],[1.52,1.85,1.52]]);
  box(g,.47,.74,.065,.28,.59,1.58,M.glassDark);
  box(g,.62,.065,.52,.28,.15,1.79,M.white);
}

function bordeaux(g) {
  base(g,4.15,3.5);
  // Heavy porthole-punctured upper storey floats above the glass living room.
  // Reference: oma.com/projects/maison-a-bordeaux
  box(g,3.45,.42,2.5,-.15,.33,-.15,M.concrete);
  box(g,3.6,.13,2.4,0,.61,-.12,M.white);
  box(g,2.25,1.03,1.95,-.46,1.18,-.2,M.glassLight);
  for(const x of [-1.52,-.42,.62])box(g,.05,1.02,.05,x,1.18,.8,M.ink);
  cylinder(g,.19,1.22,1.18,1.22,-.45,M.ink,12);
  box(g,3.75,.84,2.15,0,2.08,-.12,M.pinkDark);
  box(g,3.81,.1,2.22,0,2.54,-.12,M.white);
  const holes=[[-1.57,2.13],[-1.21,1.93],[-.82,2.2],[-.45,2.04],[-.08,2.23],[.3,1.92],[.67,2.17],[1.04,2],[1.43,2.22],[1.65,1.92]];
  for(const [x,y] of holes)mesh(g,new THREE.CylinderGeometry(.065,.065,.028,12),M.ink,x,y,.968).rotation.x=PI/2;
  for(const z of [-.85,-.35,.17,.62])mesh(g,new THREE.CylinderGeometry(.072,.072,.03,12),M.ink,1.889,2.12,z).rotation.z=PI/2;
  // The visible roof beam and a slender tension rod are explicit structural cues.
  box(g,.17,.21,3.05,.64,2.72,-.03,M.ink);
  box(g,.34,.055,3.1,.64,2.85,-.03,M.ink);
  box(g,.34,.055,3.1,.64,2.59,-.03,M.ink);
  cylinder(g,.032,2.1,.64,1.6,1.47,M.ink,6);
  box(g,.75,.08,.8,.8,.72,.54,M.concreteDark);
  box(g,1.3,.05,.62,-.75,.17,1.39,M.concreteDark);
}

function zollverein(g) {
  base(g,3.65,3.65);
  // SANAA's white concrete cube has deliberately irregular square apertures.
  box(g,2.8,2.94,2.8,0,1.59,0,M.white);
  const windows=[[-1.03,.45,.32],[-.55,.35,.22],[.05,.58,.4],[.69,.39,.3],[1.13,.65,.2],[-1.1,1.01,.23],[-.58,1.01,.37],[.01,1.12,.28],[.65,.98,.43],[1.12,1.25,.18],[-.96,1.67,.38],[-.27,1.59,.24],[.24,1.92,.34],[.91,1.72,.21],[-1.13,2.36,.2],[-.58,2.62,.27],[.04,2.43,.19],[.72,2.68,.33],[1.15,2.35,.16]];
  for(const [x,y,s] of windows)box(g,s,s,.03,x,y,1.414,M.glassDark);
  for(let i=0;i<windows.length;i++) {
    const [z,y,s]=windows[(i*7)%windows.length];
    box(g,.03,s*.93,s,1.414,y,-z,i%3?M.glass:M.glassDark);
    if(i%2===0)box(g,.03,s,s,-1.414,y,z,M.glass);
  }
  box(g,.43,.59,.045,-.36,.415,1.427,M.ink);
  box(g,.9,.06,.43,-.36,.15,1.59,M.concrete);
  box(g,1.05,.04,.83,.25,3.08,-.15,M.concrete);
}

function paperChurch(g) {
  base(g,3.8,3.7);
  // Rectangular lightweight envelope, oval paper-tube nave and a light tent roof.
  // Reference: shigerubanarchitects.com/works/cultural/paper-church-kobe/
  box(g,3.15,.08,3.02,0,.18,0,M.wood);
  for(let i=0;i<28;i++) {
    const angle=i*2*PI/28,x=Math.cos(angle)*1.25,z=Math.sin(angle)*1.1;
    if(z>.95&&Math.abs(x)<.45)continue;
    cylinder(g,.075,1.36,x,.9,z,M.sand,8);
  }
  for(const s of [-1,1]) {
    box(g,.05,1.35,2.9,s*1.53,.9,0,M.glassLight);
    box(g,3.1,.065,.065,0,1.59,s*1.46,M.concreteDark);
    for(let i=0;i<11;i++) {
      const p=-1.42+i*.284;
      box(g,.035,1.4,.04,s*1.56,.9,p,M.concreteDark);
      if(s<0||Math.abs(p)>.45)box(g,.045,1.4,.045,p,.9,s*1.48,M.glassBlue);
    }
  }
  box(g,3.05,1.35,.045,0,.9,-1.45,M.glassLight);
  box(g,3.32,.07,3.14,0,1.64,0,M.white);
  hipRoof(g,3.32,3.14,.25,0,1.67,0,M.white);
  box(g,.73,.14,.38,0,.3,-.65,M.woodDark);
  box(g,.06,.63,.06,.7,.75,1.25,M.woodDark);
  box(g,.33,.055,.06,.7,.89,1.25,M.woodDark);
  box(g,.8,.075,.52,0,.15,1.7,M.white);
}

function hiroshima(g) {
  base(g,3.85,3.5);
  // Glass-louvered civic box, visible red engines, and the open training tower.
  // Reference: riken-yamamoto.co.jp/index.html?id=140&lng=_Eng&page=ry_proj_detail
  box(g,2.86,1.94,2.47,0,1.9,-.13,M.glass);
  box(g,2.92,.11,2.55,0,.9,-.13,M.white);
  box(g,2.92,.12,2.55,0,2.91,-.13,M.white);
  box(g,1.25,.05,1.25,.12,2.98,-.15,M.ink);
  for(let y=1.06;y<2.91;y+=.18) {
    box(g,2.91,.035,.07,0,y,1.135,M.glassLight);
    box(g,.07,.035,2.5,1.46,y,-.13,M.glassBlue);
    box(g,.07,.035,2.5,-1.46,y,-.13,M.glassBlue);
  }
  for(let x=-1.42;x<1.5;x+=.47)box(g,.04,2.76,.055,x,1.52,1.18,M.white);
  for(let z=-1.34;z<1.2;z+=.49)box(g,.055,2.75,.04,1.48,1.52,z,M.white);
  box(g,2.9,.75,.12,0,.49,-1.29,M.concreteDark);
  for(const x of [-.91,0,.91]) {
    box(g,.61,.36,.76,x,.37,.94,M.red);
    box(g,.58,.28,.42,x,.64,1.08,M.red);
    box(g,.47,.17,.027,x,.66,1.3,M.glassDark);
    box(g,.52,.07,.06,x,.24,1.34,M.white);
    for(const dx of [-.28,.28])mesh(g,new THREE.CylinderGeometry(.105,.105,.05,8),M.ink,x+dx,.255,.95).rotation.z=PI/2;
    box(g,.29,.055,.1,x,.808,1.11,M.light);
  }
  for(const x of [.45,.88,1.31])box(g,.035,.81,.035,x,3.36,-1.05,M.white);
  for(const y of [3.04,3.3,3.57,3.79])box(g,.9,.035,.035,.88,y,-1.05,M.white);
  beam(g,[.45,3.03,-1.05],[1.31,3.8,-1.05],.025,M.white);
  box(g,.055,.64,.045,.91,3.39,-1.01,M.red);
  for(let y=3.12;y<3.7;y+=.12)box(g,.22,.035,.04,.91,y,-.99,M.red);
}

function vault(g,x,z,w,d,baseY,rise) {
  // Low-poly cycloid, split at the ridge to leave its characteristic skylight.
  const n=16,coords=[];
  for(let i=0;i<=n;i++) {const t=i/n*2*PI;coords.push([x+w*((t-Math.sin(t))/(2*PI)-.5),baseY+rise*(1-Math.cos(t))/2]);}
  for(const [start,end] of [[0,7],[9,16]]) {
    const s=new THREE.Shape();s.moveTo(coords[start][0],coords[start][1]);
    for(let i=start+1;i<=end;i++)s.lineTo(coords[i][0],coords[i][1]);
    for(let i=end;i>=start;i--)s.lineTo(coords[i][0],coords[i][1]-.065);
    s.closePath();const geo=new THREE.ExtrudeGeometry(s,{depth:d,bevelEnabled:false,curveSegments:1});mesh(g,geo,M.concrete,0,0,z-d/2);
  }
  box(g,w*.16,.055,d,x,baseY+rise-.035,z,M.glassLight);
}
function kimbell(g) {
  base(g,4.25,3.8);
  // Parallel cycloid vaults, skylight seams, travertine infill and shaded porticoes.
  // Reference: kimbellart.org/content/kahn-building-detail
  box(g,3.86,.69,2.53,0,.49,-.3,M.sand);
  for(let i=0;i<6;i++) {
    const x=(i-2.5)*.64;
    vault(g,x,-.07,.61,3.27,.91,.28);
    for(const dx of [-.27,.27])box(g,.075,.79,.1,x+dx,.535,1.51,M.white);
    box(g,.48,.53,.035,x,.48,.986,M.glassDark);
    box(g,.6,.07,.17,x,.165,1.6,M.white);
  }
  box(g,.82,.055,.5,0,.15,1.85,M.white);
  box(g,1.12,.055,.25,-1.43,.155,-1.7,M.water);
}

function arch(g,x,y,z,r,material=M.white,rotation=0) {
  const m=mesh(g,new THREE.TorusGeometry(r,.075,6,16,PI),material,x,y,z);m.rotation.y=rotation;return m;
}
function olivetti(g) {
  base(g,3.9,3.5);
  // Venetian arcade is the context; the open dollhouse reveals Scarpa's stone stair.
  // Reference: fondoambiente.it/luoghi/negozio-olivetti
  box(g,3.1,.07,2.7,0,.16,-.05,M.clayLight);
  box(g,3.15,2.17,.16,0,1.29,-1.29,M.white);
  box(g,.14,2.17,2.3,-1.49,1.29,-.2,M.white);
  box(g,3.23,.13,.95,0,2.43,-.91,M.white);
  box(g,.7,.12,2.02,1.1,1.53,-.17,M.wood);
  box(g,.06,.29,2,1.42,1.74,-.18,M.woodDark);
  for(let i=0;i<7;i++)box(g,.7,.13,.29,-.6+i*.13,.32+i*.175,.74-i*.24,M.sand);
  for(const x of [-1.5,-.5,.5,1.5]) {
    cylinder(g,.075,1.58,x,.98,1.25,M.white,10);
    box(g,.22,.12,.22,x,.26,1.25,M.white);
    box(g,.22,.1,.22,x,1.74,1.25,M.white);
  }
  for(const x of [-1,0,1])arch(g,x,1.76,1.25,.5);
  for(const z of [-.8,.2]) {
    cylinder(g,.075,1.58,-1.5,.98,z,M.white,10);
    box(g,.22,.11,.22,-1.5,.26,z,M.white);
    arch(g,-1.5,1.76,z+.5,.5,M.white,PI/2);
  }
  // The two eye windows and a little typewriter keep the arcade from being generic.
  for(const x of [-.75,.74]) {
    const eye=mesh(g,new THREE.SphereGeometry(1,12,6),M.glassDark,x,2.02,-1.196);eye.scale.set(.32,.14,.026);
  }
  box(g,.63,.12,.48,.79,.26,.52,M.ink);
  const sculpture=mesh(g,new THREE.IcosahedronGeometry(.18,1),M.gold,.79,.53,.52);sculpture.scale.set(.7,1.45,.6);
  box(g,.46,.06,.31,1.1,1.62,-.12,M.red);
  box(g,.38,.055,.1,1.1,1.68,-.2,M.white);
  box(g,.38,.035,.12,1.1,1.66,-.02,M.ink);
}

function bregenz(g) {
  base(g,4.2,3.75);
  // A tall, shingled etched-glass lantern next to the low dark ancillary building.
  // Reference: kunsthaus-bregenz.at/en/architecture
  const cx=-.53,w=2.48,h=3.04,d=2.6;
  box(g,w,h,d,cx,.12+h/2,0,M.glass);
  for(const y of [.78,1.53,2.29])box(g,w+.025,.075,d+.025,cx,y,0,M.concreteDark);
  for(let row=0;row<8;row++)for(let col=0;col<5;col++) {
    const y=.31+row*.379,x=cx-w/2+.25+col*.496,z=-d/2+.26+col*.52;
    const m=(row+col)%3===0?M.glassBlue:M.glassLight;
    box(g,.482,.363,.04,x,y,d/2+.03,m);
    box(g,.482,.363,.04,x,y,-d/2-.03,m);
    box(g,.04,.363,.503,cx+w/2+.03,y,z,m);
    box(g,.04,.363,.503,cx-w/2-.03,y,z,m);
  }
  box(g,w+.09,.09,d+.09,cx,3.21,0,M.glassLight);
  box(g,.42,.5,.06,cx,.37,1.355,M.ink);
  for(let i=0;i<3;i++)box(g,.82,.055,.19,cx,.15+i*.047,1.69-i*.14,M.concrete);
  box(g,.92,1.22,1.76,1.55,.73,-.29,M.ink);
  for(const y of [.4,.83,1.24]) {
    box(g,.96,.075,1.8,1.55,y,-.29,M.concreteDark);
    box(g,.94,.2,.035,1.55,y+.12,.61,M.glassDark);
  }
}

const BUILDERS={14:vitra,15:zueblin,16:boaNova,17:churchOfLight,18:serpentine,19:bordeaux,20:zollverein,21:paperChurch,22:hiroshima,23:kimbell,24:olivetti,25:bregenz};
export const MINIATURE_INFO_B={
  14:{motif:'銳角混凝土薄牆、斜向車庫、飛出的尖長雨棚'},
  15:{motif:'粉紅階梯式辦公翼、塔狀核心、玻璃山牆中庭'},
  16:{motif:'低伏紅瓦屋頂、白牆深簷、海岸花崗岩'},
  17:{motif:'清水混凝土長盒、斜插牆、十字光縫'},
  18:{motif:'白色交錯斜格、三角玻璃拼片、輕盈展亭'},
  19:{motif:'懸浮厚重上層、圓孔窗、玻璃客廳與屋頂鋼梁'},
  20:{motif:'白色混凝土方盒、大小錯落的方形窗孔'},
  21:{motif:'橢圓紙管柱列、輕薄帳篷屋頂、方形外罩'},
  22:{motif:'玻璃百葉立面、開放車庫紅消防車、訓練塔'},
  23:{motif:'平行擺線拱頂、脊線天窗、淺色石材柱廊'},
  24:{motif:'威尼斯拱廊、錯落石階、眼形窗與打字機'},
  25:{motif:'層疊磨砂玻璃燈盒、深色附屬量體、低矮入口'},
};

function compact(g) {
  g.updateMatrixWorld(true);
  const byMaterial=new Map(),originals=new Set();
  g.traverse(o=>{
    if(!o.isMesh)return;
    const geometry=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();
    geometry.applyMatrix4(o.matrixWorld);
    for(const key of Object.keys(geometry.attributes))if(key!=='position'&&key!=='normal')geometry.deleteAttribute(key);
    if(!geometry.getAttribute('normal'))geometry.computeVertexNormals();
    if(!byMaterial.has(o.material))byMaterial.set(o.material,[]);
    byMaterial.get(o.material).push(geometry);originals.add(o.geometry);
  });
  g.clear();
  for(const [material,geometries] of byMaterial) {
    const combined=mergeGeometries(geometries,false);
    if(!combined)throw new Error('Miniature geometry merge failed');
    mesh(g,combined,material);
    for(const geo of geometries)geo.dispose();
  }
  for(const geo of originals)geo.dispose();
  const b=new THREE.Box3().setFromObject(g),size=b.getSize(new THREE.Vector3());
  const scale=Math.min(1,4.35/size.x,4.35/size.z,4.15/size.y);
  const translate=new THREE.Matrix4().makeTranslation(-(b.min.x+b.max.x)/2,-b.min.y,-(b.min.z+b.max.z)/2);
  const shrink=new THREE.Matrix4().makeScale(scale,scale,scale);
  for(const child of g.children){child.geometry.applyMatrix4(translate);child.geometry.applyMatrix4(shrink);child.geometry.computeBoundingBox();child.geometry.computeBoundingSphere();}
  return g;
}

export function createMiniatureB(item) {
  const id=Number(typeof item==='object'?item.id:item),builder=BUILDERS[id];
  if(!builder)return null;
  const group=new THREE.Group();group.name=`chibi-masterpiece-${id}`;builder(group);
  compact(group);
  group.userData={miniatureId:id,motif:MINIATURE_INFO_B[id].motif,schematic:true};
  return group;
}

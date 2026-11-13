/**
 * Spherical hex Earth. Pure, dependency-free geometry; no planar hex projection.
 *
 * An icosahedron is split four times and its triangular mesh is dualized. The
 * result is 2,562 genuinely spherical cells: 2,550 hexagons and 12 pentagons.
 * Neighboring cells share exact vertex objects, including at the date line.
 *
 * Geographic convention: degrees, east-positive longitude, north-positive
 * latitude; +Y is north, +Z is Greenwich on the equator, and +X is 90°E.
 * Centers and polygon vertices are unit vectors, counterclockwise as viewed
 * from outside. World surfaces are at radius + height, not at height alone.
 *
 * Geography is a hand-drawn, low-resolution educational approximation, not GIS
 * or a map of national borders. Building coordinates and historical practice-base coordinates remain separate.
 * Every pin stays at its sourced coordinate. Shared cells use selectable clusters
 * and tethered screen labels, never invented cross-border display positions.
 * Route modes are visual metaphors for documented relationships, not claims
 * about any architect's historical travel, roads, shipping, or flight service.
 */

export const GLOBE_RADIUS = 40;
export const GLOBE_SUBDIVISIONS = 4;
export const TRANSPORT_NOTE = '交通方式為關係線的視覺比喻，不表示真實旅程、道路、船班或航班。';
const PI = Math.PI, TAU = 2 * PI, DEG = PI / 180, EARTH_KM = 6371;
const clamp = (x, a = -1, b = 1) => Math.max(a, Math.min(b, x));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const add = (a, b) => a.map((v, i) => v + b[i]);
const scale = (a, s) => a.map(v => v * s);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = a => scale(a, 1 / (Math.hypot(...a) || 1));
const angle = (a, b) => Math.acos(clamp(dot(a, b)));
const normalizeLon = lon => ((lon + 180) % 360 + 360) % 360 - 180;
const contexts = new WeakMap();

export function latLonVector(lat, lon, radius = 1) {
  const p = lat * DEG, l = lon * DEG, c = Math.cos(p);
  return [radius * c * Math.sin(l), radius * Math.sin(p), radius * c * Math.cos(l)];
}
export function vectorLatLon(vector) {
  const v = unit(vector);
  return {lat: Math.asin(clamp(v[1])) / DEG, lon: normalizeLon(Math.atan2(v[0], v[2]) / DEG)};
}

// Polygon coordinates are [longitude, latitude]. The coast is deliberately
// simplified, but separate landmasses must not turn into false land bridges.
const LAND_POLYGONS = [
  ['north-america', 'north-america', [[-168,72],[-141,70],[-128,73],[-113,76],[-96,81],[-75,82],[-61,64],[-57,54],[-63,46],[-53,47],[-58,42],[-67,44],[-75,35],[-81,25],[-87,30],[-97,26],[-99,20],[-91,17],[-88,21],[-86,21],[-83,10],[-78,8],[-77,9],[-83,15],[-88,17],[-96,16],[-105,21],[-116,29],[-123,40],[-126,49],[-137,58],[-151,59],[-166,54],[-165,60],[-169,65]]],
  ['greenland', 'greenland', [[-73,60],[-47,59],[-22,69],[-17,79],[-35,84],[-57,82],[-65,73]]],
  ['south-america', 'south-america', [[-81,12],[-72,12],[-61,10],[-49,3],[-35,-5],[-39,-20],[-48,-29],[-54,-35],[-64,-55],[-70,-53],[-74,-43],[-76,-25],[-81,-6]]],
  ['africa', 'africa', [[-17,36],[-5,36],[11,37],[25,32],[33,31],[35,23],[43,12],[51,12],[46,1],[41,-12],[35,-24],[28,-35],[18,-35],[12,-18],[8,-5],[-1,5],[-12,5],[-17,15]]],
  ['africa', 'madagascar', [[43,-12],[50,-15],[49,-25],[45,-26],[43,-20]]],
  ['europe', 'britain', [[-6,50],[1.5,50.5],[1,53],[-2,56],[0,59],[-5,59],[-7,55],[-5,53]]],
  ['europe', 'ireland', [[-11,51],[-6,51],[-5,55],[-8,56],[-11,54]]],
  ['europe', 'iceland', [[-25,63],[-14,63],[-13,66],[-22,67]]],
  ['eurasia', 'eurasia', [[-9,36],[-10,43],[-5,49],[3,51],[5,54],[10,55],[10,58],[6,58],[5,62],[17,70],[29,71],[40,68],[55,70],[70,72],[91,78],[110,77],[135,72],[159,69],[169,68],[174,65],[177,63],[171,60],[164,60],[153,59],[142,48],[134,45],[130,42],[128,39],[126,37],[126,34],[120,32],[119,28],[116,24],[112,22],[110,20],[107,8],[100,1],[96,6],[97,15],[90,22],[85,22],[80,6],[74,9],[68,24],[60,25],[56,20],[50,12],[43,13],[34,29],[36,36],[28,41],[25,40],[23,36],[21,37],[20,40],[16,40],[16,37],[12,38],[9,44],[3,43],[3,40],[-1,37]]],
  // At this resolution Japan is lightly broadened to remain a readable chain.
  ['east-asia', 'japan', [[129,31],[132,30],[134,33],[137,33],[141,35],[143,39],[146,43],[145,46],[141,45],[139,41],[136,38],[132,36],[129,34]]],
  ['mainland-asia', 'taiwan', [[120,21],[122,22],[123,25],[121,26],[119,23]]],
  ['mainland-asia', 'sri-lanka', [[79,5],[82,5],[82,10],[79,10]]],
  ['mainland-asia', 'philippines', [[119,6],[126,5],[127,10],[123,19],[120,18],[121,12]]],
  ['mainland-asia', 'sumatra', [[95,6],[101,2],[106,-5],[104,-7],[98,-1]]],
  ['mainland-asia', 'java', [[105,-6],[114,-7],[116,-9],[106,-9]]],
  ['mainland-asia', 'borneo', [[109,7],[118,7],[120,1],[116,-4],[109,-3]]],
  ['oceania', 'new-guinea', [[131,-1],[143,-2],[151,-6],[150,-10],[141,-8],[133,-5]]],
  ['oceania', 'australia', [[113,-22],[114,-32],[121,-35],[130,-32],[138,-36],[147,-40],[153,-28],[153,-23],[146,-15],[142,-11],[136,-13],[130,-11],[123,-16],[117,-20]]],
  ['oceania', 'tasmania', [[144,-40],[149,-41],[148,-44],[145,-44]]],
  ['oceania', 'new-zealand', [[166,-47],[170,-47],[174,-42],[179,-37],[176,-34],[172,-39],[167,-44]]],
  ['north-america', 'cuba', [[-85,23],[-78,24],[-74,20],[-78,19],[-84,21]]]
];
const polygonData = LAND_POLYGONS.map(([region, landmass, points]) => ({region, landmass, points, mid: points.reduce((s, p) => s + p[0], 0) / points.length}));

function inPolygon(lat, lon, polygon) {
  const x = lon + 360 * Math.round((polygon.mid - lon) / 360), points = polygon.points;
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i], [xj, yj] = points[j];
    if ((yi > lat) !== (yj > lat) && x < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export function classifyGeography(lat, lon) {
  if (lat < -69) return {land: true, region: 'antarctica', landmass: 'antarctica'};
  for (const polygon of polygonData) if (inPolygon(lat, normalizeLon(lon), polygon)) {
    const region = polygon.region === 'eurasia' ? (normalizeLon(lon) < 44 && lat >= 35 ? 'europe' : 'mainland-asia') : polygon.region;
    return {land: true, region, landmass: polygon.landmass};
  }
  return {land: false, region: 'ocean', landmass: null};
}

function buildDual(subdivisions) {
  const p = (1 + Math.sqrt(5)) / 2;
  const vertices = [[-1,p,0],[1,p,0],[-1,-p,0],[1,-p,0],[0,-1,p],[0,1,p],[0,-1,-p],[0,1,-p],[p,0,-1],[p,0,1],[-p,0,-1],[-p,0,1]].map(unit);
  let faces = [[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];
  for (let k = 0; k < subdivisions; k++) {
    const cache = new Map(), next = [];
    const midpoint = (a, b) => {
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      if (!cache.has(key)) { cache.set(key, vertices.length); vertices.push(unit(add(vertices[a], vertices[b]))); }
      return cache.get(key);
    };
    for (const [a, b, c] of faces) {
      const ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a);
      next.push([a,ab,ca],[b,bc,ab],[c,ca,bc],[ab,bc,ca]);
    }
    faces = next;
  }
  const incident = vertices.map(() => []), neighbors = vertices.map(() => new Set());
  const faceCenters = faces.map(face => unit(face.reduce((sum, id) => add(sum, vertices[id]), [0,0,0])));
  faces.forEach(([a,b,c], i) => {
    for (const v of [a,b,c]) incident[v].push(i);
    neighbors[a].add(b).add(c); neighbors[b].add(a).add(c); neighbors[c].add(a).add(b);
  });
  return vertices.map((center, id) => {
    const pole = Math.abs(center[1]) > .95 ? [0,0,1] : [0,1,0];
    const east = unit(cross(pole, center)), north = cross(center, east);
    const faceIds = incident[id].sort((a,b) => Math.atan2(dot(faceCenters[a],north),dot(faceCenters[a],east)) - Math.atan2(dot(faceCenters[b],north),dot(faceCenters[b],east)));
    return {id, center, vertices: faceIds.map(i => faceCenters[i]), vertexIds: faceIds, neighbors: [...neighbors[id]].sort((a,b) => a-b), ...vectorLatLon(center)};
  });
}

function terrainHeight(tile) {
  if (!tile.land) return .12 + .055 * (.5 + .5 * Math.sin(tile.lon * .13 + tile.lat * .07));
  const mountain = (lat, lon, a, b, height) => height * Math.exp(-(((tile.lat - lat) / a) ** 2) - (normalizeLon(tile.lon - lon) / b) ** 2);
  const ridges = mountain(31,84,7,19,.52) + mountain(-20,-70,24,5,.42) + mountain(44,-112,18,8,.34) + mountain(46,10,4,8,.2) + mountain(8,38,17,9,.18);
  return .42 + .17 * (.5 + .5 * Math.sin(tile.lat * .22) * Math.cos(tile.lon * .17)) + ridges + (tile.region === 'antarctica' ? .14 : 0);
}

// At four subdivisions a cell is several degrees wide. Polygon sampling alone
// cannot reliably retain a small island, a sea strait, or a narrow isthmus.
// Resolve these three visual topology constraints on the *existing* neighbor
// graph. Only terrain labels change: no cell vertices, IDs, or sourced pins move.
// The slight coastal exaggeration is intentional, not a claim of GIS precision.
function resolveTerrainTopology(tiles) {
  const paint = (tile, landmass, region, reason) => {
    Object.assign(tile, {land: Boolean(landmass), landmass, region: region || 'ocean', terrainApproximation: reason});
  };
  const trace = (anchors, visit) => {
    const cells = anchors.map(([lat,lon]) => nearestTile(latLonVector(lat,lon),tiles));
    visit(cells[0]);
    for (let i=1;i<cells.length;i++) {
      // Nearest-cell anchors and great-circle graph edges work across ±180°;
      // a planar longitude subtraction here would take the long way around.
      for (const tile of graphPath(cells[i-1],cells[i],tiles,()=>true)) visit(tile);
    }
  };
  trace([[32,130.5],[34,133.5],[35,136],[36,140],[40,141],[44,143]],
    tile => paint(tile,'japan','east-asia','readable-island-chain'));
  trace([[22,120.8],[25.4,122.5]],
    tile => paint(tile,'taiwan','mainland-asia','readable-island-chain'));

  // A whole ocean-cell buffer is visible in both the extruded WebGL mesh and
  // software sphere. This also prevents a diagonal corner-only land contact:
  // every three-cell dual vertex joins a pair of neighboring cells.
  const islandIds = new Set(tiles.filter(t=>t.landmass==='japan'||t.landmass==='taiwan').map(t=>t.id));
  for (const id of islandIds) for (const neighbor of tiles[id].neighbors) {
    if (!islandIds.has(neighbor) && tiles[neighbor].land) paint(tiles[neighbor],null,null,'island-water-separation');
  }

  // Keep a continuous Bering Sea → Arctic channel through the antimeridian.
  trace([[54,179],[60,179],[66,179],[74,179]],
    tile => paint(tile,null,null,'bering-strait-water'));
  const bering = tile => tile.lat>48 && tile.lat<77 && Math.abs(tile.lon)>150;
  const contacts = tiles.filter(tile=>bering(tile)&&tile.landmass==='eurasia'&&
    tile.neighbors.some(id=>tiles[id].landmass==='north-america'));
  for (const tile of contacts) paint(tile,null,null,'bering-strait-water');

  // The Mexico → Guatemala → Costa Rica → Panama → Colombia corridor must be
  // traversable by adjacent land cells, not just look close in a projection.
  trace([[23,-103],[19,-98],[16,-93],[14,-88],[11,-85],[9,-82],[8.5,-79],[8,-76],[5,-75]], tile => {
    const south = tile.landmass==='south-america' || (tile.lon>-79 && tile.lat<10);
    paint(tile,south?'south-america':'north-america',south?'south-america':'north-america','central-american-land-bridge');
  });
}

export const EMPTY_REGION_ANCHORS = [
  {id:'south-america',lat:-14,lon:-60,region:'south-america'},
  {id:'africa',lat:3,lon:20,region:'africa'},
  {id:'mainland-asia',lat:30,lon:88,region:'mainland-asia'},
  {id:'oceania',lat:-25,lon:134,region:'oceania'}
];

export function buildGlobe(catalog, atlas, options = {}) {
  const radius = options.radius ?? GLOBE_RADIUS, subdivisions = options.subdivisions ?? GLOBE_SUBDIVISIONS;
  if (!Number.isFinite(radius) || radius <= 0 || !Number.isInteger(subdivisions) || subdivisions < 2 || subdivisions > 5) throw new Error('Invalid spherical grid options.');
  const tiles = buildDual(subdivisions);
  for (const tile of tiles) {
    Object.assign(tile, classifyGeography(tile.lat, tile.lon));
    // Preserve narrow Japanese land intersecting a cell even if its center is at
    // sea; center-only rasterization would erase most of this small archipelago.
    if (!tile.land && tile.vertices.some(vertex => { const p = vectorLatLon(vertex); return classifyGeography(p.lat,p.lon).region === 'east-asia'; })) {
      Object.assign(tile, {land:true,region:'east-asia',landmass:'japan',coastalApproximation:true});
    }
  }
  resolveTerrainTopology(tiles);
  for (const tile of tiles) {
    tile.height = terrainHeight(tile); tile.radius = radius; tile.kind = tile.land ? 'land' : 'ocean';
  }
  const placements = new Map(), masterPlacements = new Map(), emptyPlacements = new Map(), source = new Map((atlas?.architects || []).map(a => [Number(a.id), a]));
  const list = Array.isArray(catalog) ? catalog : catalog?.architects || [];
  // Geographic points, not invented display locations. Several buildings may
  // share their nearest cell; they remain separately selectable at their pins.
  const point = (anchor, kind, id) => {
    if (!Number.isFinite(anchor?.lat) || !Number.isFinite(anchor?.lon)) throw new Error(`Missing ${kind} coordinates for ${id}.`);
    const center=latLonVector(anchor.lat,anchor.lon),cell=nearestTile(center,tiles);
    return {...cell,id:cell.id,tileId:cell.id,center,lat:anchor.lat,lon:anchor.lon,
      region:anchor.region||classifyGeography(anchor.lat,anchor.lon).region,countryCode:anchor.countryCode,
      height:Math.max(cell.height,.65)+.2,kind,sourceAnchor:{lat:anchor.lat,lon:anchor.lon},
      displayAnchor:{lat:anchor.lat,lon:anchor.lon},displayOffset:{lat:0,lon:0,distanceKm:0},
      cellAnchor:{lat:cell.lat,lon:cell.lon},cellDistanceKm:angle(center,cell.center)*EARTH_KM,
      displayPositionIsApproximate:false,coordinatePrecision:anchor.coordinatePrecision};
  };
  const buildingClusters=new Map(),masterClusters=new Map(),secondaryPlacements=new Map(),associations=[];
  for(const entry of [...list].sort((a,b)=>Number(a.id)-Number(b.id))){
    const id=Number(entry.id),meta=source.get(id);if(!meta)throw new Error(`Missing geography ${id}.`);
    const work=point(meta.building,'building',id),base=point(meta.practiceBase,'master',id);
    work.architectId=id;base.masterId=id;placements.set(id,work);masterPlacements.set(id,base);
    const cell=tiles[work.tileId];cell.buildingIds??=[];cell.buildingIds.push(id);cell.architectId??=id;
    if(!buildingClusters.has(work.tileId))buildingClusters.set(work.tileId,[]);buildingClusters.get(work.tileId).push(id);
    // Same city shares one figurine landmark; nearby cities never acquire a false identity.
    const key=`${meta.practiceBase.countryCode}:${meta.practiceBase.lat}:${meta.practiceBase.lon}`;
    if(!masterClusters.has(key))masterClusters.set(key,{key,ids:[],point:base,label:meta.practiceBase.label});
    masterClusters.get(key).ids.push(id);base.clusterKey=key;
    if(meta.building.countryCode!==meta.practiceBase.countryCode)associations.push({id:`geography-${id}`,architectId:id,from:id,to:id,type:'geography',fromKind:'building',toKind:'master',crossCountry:true});
    if(meta.building.currentSite&&meta.building.siteRole==='original')secondaryPlacements.set(id,point(meta.building.currentSite,'current-site',id));
  }
  for(const cluster of masterClusters.values()){
    cluster.coLocatedBuildingIds=[...placements].filter(([,p])=>angle(p.center,cluster.point.center)*EARTH_KM<35).map(([id])=>id);
    cluster.hasSelectedWork=cluster.coLocatedBuildingIds.length>0;
  }
  for (const anchor of EMPTY_REGION_ANCHORS) {
    const direction = latLonVector(anchor.lat,anchor.lon);
    const tile = tiles.filter(t => t.land && t.region === anchor.region && !t.buildingIds?.length && !t.emptyId).sort((a,b) => dot(b.center,direction)-dot(a.center,direction) || a.id-b.id)[0];
    if (!tile) throw new Error(`No land cell for empty region ${anchor.id}.`);
    tile.emptyId = anchor.id; tile.kind = 'uninhabited'; tile.height = 1.15;emptyPlacements.set(anchor.id,tile);
  }
  const result = {radius,tiles,placements,masterPlacements,masterClusters,buildingClusters,secondaryPlacements,associations,emptyPlacements,subdivisions,geographyIsApproximate:true,transportNote:TRANSPORT_NOTE};
  contexts.set(placements,result);contexts.set(masterPlacements,result);return result;
}

// Distinct cyan arcs mean authorship geography, never mentorship or travel.
export function associationRoute(association,globe){
  const a=globe.placements.get(association.architectId),b=globe.masterPlacements.get(association.architectId);
  const points=geographicArc(a,b,globe.radius,6);
  return {points,mode:'association',label:'作品 ↔ 代表執業基地',transportIsIllustrative:false,semantics:'authorship-geography'};
}
function geographicArc(a,b,radius,lift=4){
  return Array.from({length:81},(_,i)=>{const t=i/80;return scale(slerp(a.center,b.center,t),radius+a.height*(1-t)+b.height*t+.2+Math.sin(PI*t)*lift);});
}

function slerp(a,b,t) {
  const theta = angle(a,b);
  if (theta < 1e-8) return unit(add(scale(a,1-t),scale(b,t)));
  // A deterministic orthogonal arc also handles antipodal points without NaNs.
  if (PI-theta < 1e-6) {
    const axis = unit(cross(a,Math.abs(a[1]) < .8 ? [0,1,0] : [1,0,0]));
    return unit(add(scale(a,Math.cos(PI*t)),scale(axis,Math.sin(PI*t))));
  }
  const sine = Math.sin(theta);
  return add(scale(a,Math.sin((1-t)*theta)/sine),scale(b,Math.sin(t*theta)/sine));
}

function graphPath(start,end,tiles,allowed,penalty = () => 1) {
  const open = new Set([start.id]), previous = new Map(), score = new Map([[start.id,0]]);
  while (open.size) {
    let current = -1, best = Infinity;
    for (const id of open) {
      const estimate = score.get(id) + angle(tiles[id].center,end.center);
      if (estimate < best) { best = estimate; current = id; }
    }
    if (current === end.id) {
      const path = [tiles[current]];
      while (previous.has(current)) {current = previous.get(current); path.push(tiles[current]);}
      return path.reverse();
    }
    open.delete(current);
    for (const neighbor of tiles[current].neighbors) {
      const next = tiles[neighbor];
      if (!allowed(next)) continue;
      const tentative = score.get(current) + angle(tiles[current].center,next.center)*penalty(next);
      if (tentative < (score.get(neighbor) ?? Infinity)) {previous.set(neighbor,current);score.set(neighbor,tentative);open.add(neighbor);}
    }
  }
  return null;
}
function pathLength(path) {let sum=0;for(let i=1;i<path.length;i++)sum+=angle(path[i-1].center,path[i].center);return sum;}
function nearestTile(direction,tiles) {
  let best = tiles[0], maximum = -Infinity;
  for (const tile of tiles) {const d=dot(direction,tile.center);if(d>maximum){maximum=d;best=tile;}}
  return best;
}
function pointsOnPath(path,radius,mode) {
  const points = [];
  for (let i = 1; i < path.length; i++) {
    const a=path[i-1],b=path[i],steps=Math.max(5,Math.ceil(angle(a.center,b.center)/.008));
    for(let j=i===1?0:1;j<=steps;j++) {
      const t=j/steps,direction=slerp(a.center,b.center,t);
      // Follow terraces, with a continuous ramp entirely on the lower side of
      // each shared boundary. A road cannot slice through a raised master cell.
      const ah=mode==='road'||a.land?a.height:.20,bh=mode==='road'||b.land?b.height:.20;
      const ramp=clamp(ah>bh?(t-.5)*2:t*2,0,1),smooth=ramp*ramp*(3-2*ramp);
      const surface=ah+(bh-ah)*smooth+(mode==='road'?.10:.12);
      points.push(scale(direction,radius+Math.max(.60,surface)));
    }
  }
  return points;
}

export function routeForEdge(edge, placements) {
  const a=placements.get(Number(edge.from)),b=placements.get(Number(edge.to));
  if(!a||!b) throw new Error(`Missing route endpoint for ${edge.id || `${edge.from}:${edge.to}`}.`);
  const context=contexts.get(placements),radius=context?.radius ?? a.radius ?? GLOBE_RADIUS,tiles=context?.tiles;
  const distance=angle(a.center,b.center),distanceKm=distance*EARTH_KM;
  const sourceDistanceKm=angle(latLonVector(a.sourceAnchor?.lat??a.lat,a.sourceAnchor?.lon??a.lon),latLonVector(b.sourceAnchor?.lat??b.lat,b.sourceAnchor?.lon??b.lon))*EARTH_KM;
  if(sourceDistanceKm<1){
    const radial=unit(a.center),east=unit(cross(Math.abs(radial[1])>.9?[0,0,1]:[0,1,0],radial)),north=cross(radial,east);
    const points=Array.from({length:49},(_,i)=>{const t=i/48,theta=t*TAU,offset=add(scale(east,Math.sin(theta)*.016),scale(north,(1-Math.cos(theta))*.016));return scale(unit(add(radial,offset)),radius+a.height+.2+Math.sin(PI*t)*.7);});
    return {points,mode:'local',label:'同城關係',sourceDistanceKm,distanceKm:0,transportIsIllustrative:true,transportNote:TRANSPORT_NOTE,tilePath:[]};
  }
  let mode='flight',path=null,points;
  if(tiles && a.region===b.region && a.landmass===b.landmass && sourceDistanceKm<=2000) {
    const candidate=graphPath(a,b,tiles,t=>t.land&&t.landmass===a.landmass);
    if(candidate && pathLength(candidate)<=Math.max(distance*1.9,.2)) {mode='road';path=candidate;}
  }
  if(!path && tiles && sourceDistanceKm<=3000) {
    // Find coastal ports, then a water-only graph path. Short endpoint approaches
    // are retained separately from the actual sea leg instead of sailing on land.
    const portFor=site=>tiles.filter(t=>t.land&&t.landmass===site.landmass&&t.neighbors.some(id=>!tiles[id].land)).sort((x,y)=>angle(x.center,site.center)-angle(y.center,site.center)||x.id-y.id)[0];
    const portA=portFor(a),portB=portFor(b);
    if(portA&&portB) {
      const start=portA.neighbors.map(id=>tiles[id]).filter(t=>!t.land).sort((x,y)=>angle(x.center,b.center)-angle(y.center,b.center))[0];
      const end=portB.neighbors.map(id=>tiles[id]).filter(t=>!t.land).sort((x,y)=>angle(x.center,a.center)-angle(y.center,a.center))[0];
      const sea=graphPath(start,end,tiles,t=>!t.land);
      const approachA=graphPath(a,portA,tiles,t=>t.land&&t.landmass===a.landmass),approachB=graphPath(portB,b,tiles,t=>t.land&&t.landmass===b.landmass);
      if(sea&&approachA&&approachB&&pathLength(sea)<=Math.max(distance*3,.55)) {mode='ship';path=[...approachA,...sea,...approachB];}
    }
  }
  if(path&&path.length>1) points=pointsOnPath(path,radius,mode);
  else if(path){mode='local';points=geographicArc(a,b,radius,.8);}
  else {
    const steps=Math.max(64,Math.ceil(distance*60)),lift=Math.min(radius*.23,Math.max(radius*.105,distance*radius*.14));
    points=Array.from({length:steps+1},(_,i)=>{
      const t=i/steps,direction=slerp(a.center,b.center,t),surface=tiles?nearestTile(direction,tiles).height:.6;
      const endpointHeight=a.height*(1-t)+b.height*t;
      return scale(direction,radius+Math.max(surface+.14,endpointHeight+.12+Math.sin(PI*t)*lift));
    });
  }
  // Pin endpoints to each marker's elevated tile and add a tiny clearance.
  points[0]=scale(a.center,radius+a.height+.12);points[points.length-1]=scale(b.center,radius+b.height+.12);
  return {
    mode,label:{road:'道路',ship:'船舶航線',flight:'飛機航線',local:'近距離關係示意'}[mode],points,distanceKm,sourceDistanceKm,
    fromTileId:a.id,toTileId:b.id,tilePath:path?.map(t=>t.id)??null,
    transportIsIllustrative:true,transportNote:TRANSPORT_NOTE,
    ...(mode==='ship'?{includesLandApproaches:true}:{}),
    // Relationship evidence/type remain on the caller's original edge.
    edgeId:edge.id
  };
}

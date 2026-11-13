import * as THREE from 'three';

// Hand-built, deliberately toy-proportioned architectural studies, not measured models.
// All glazing is opaque. Repeated details are merged by shared material at the end.
const MAT = {};
function material(key, color, metalness = 0, roughness = 0.76) {
  return MAT[key] || (MAT[key] = new THREE.MeshStandardMaterial({ color, metalness, roughness, side: THREE.DoubleSide }));
}
const white = material('white', '#fff6e4');
const ivory = material('ivory', '#e8d9b7');
const stone = material('stone', '#cbbba0');
const glass = material('glass', '#a5ced4', 0.12, 0.31);
const blueGlass = material('blueGlass', '#669aaa', 0.15, 0.35);
const dark = material('dark', '#42515b');
const iron = material('iron', '#4f7167', 0.24);
const bronze = material('bronze', '#ae8551', 0.24);
const wood = material('wood', '#b68c60');
const brick = material('brick', '#bd705b');
const brickLight = material('brickLight', '#dc987b');
const copper = material('copper', '#69837c', 0.12);
const grass = material('grass', '#a4b888');
const water = material('water', '#88c9d3', 0.1, 0.28);
const silver = material('silver', '#c5d2d4', 0.46, 0.41);
const red = material('red', '#d65d54');
const yellow = material('yellow', '#ecc04e');
const blue = material('blue', '#467bba');
const pink = material('pink', '#d99faf');
const lavender = material('lavender', '#9f9cba');
const roofGold = material('roofGold', '#e9be77');
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitSphere = new THREE.SphereGeometry(1, 10, 7);
const unitCylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
const up = new THREE.Vector3(0, 1, 0);

function mesh(g, geometry, mat, pos = [0, 0, 0], scale = [1, 1, 1], rotation) {
  const m = new THREE.Mesh(geometry, mat);
  m.position.set(...pos); m.scale.set(...scale);
  if (rotation) m.rotation.set(...rotation);
  g.add(m); return m;
}
function box(g, x, y, z, w, h, d, mat = white, rot) {
  return mesh(g, unitBox, mat, [x, y, z], [w, h, d], rot);
}
function ball(g, x, y, z, w, h, d, mat = white) {
  return mesh(g, unitSphere, mat, [x, y, z], [w, h, d]);
}
function column(g, x, y, z, radius, h, mat = white) {
  return mesh(g, unitCylinder, mat, [x, y, z], [radius, h, radius]);
}
function beam(g, a, b, r, mat = white) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), v = vb.clone().sub(va);
  const m = mesh(g, unitCylinder, mat, va.clone().add(vb).multiplyScalar(0.5).toArray(), [r, v.length(), r]);
  m.quaternion.setFromUnitVectors(up, v.normalize()); return m;
}
function curve(g, pts, r, mat = white) {
  const path = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)));
  return mesh(g, new THREE.TubeGeometry(path, Math.max(8, pts.length * 2), r, 5, false), mat);
}
function polygon(g, points, depth, mat, pos = [0, 0, 0], rotation) {
  const shape = new THREE.Shape();
  points.forEach((p, i) => i ? shape.lineTo(...p) : shape.moveTo(...p)); shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, steps: 1, bevelEnabled: false, curveSegments: 8 });
  geometry.translate(0, 0, -depth / 2);
  return mesh(g, geometry, mat, pos, [1, 1, 1], rotation);
}
function oval(g, x, y, z, rx, ry, tube, mat = white) {
  const geo = new THREE.TorusGeometry(1, tube, 5, 16);
  return mesh(g, geo, mat, [x, y, z], [rx, ry, 0.85]);
}
function arcWall(g, cx, y, cz, r, h, start, sweep, mat = white, thick = 0.11) {
  const pts = [], count = 18;
  for (let i = 0; i <= count; i++) {
    const a = start + sweep * i / count; pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  for (let i = count; i >= 0; i--) {
    const a = start + sweep * i / count; pts.push([Math.cos(a) * (r - thick), Math.sin(a) * (r - thick)]);
  }
  return polygon(g, pts, h, mat, [cx, y + h / 2, cz], [-Math.PI / 2, 0, 0]);
}
function steps(g, x, z, width, count = 4, rise = 0.1, tread = 0.18, mat = white) {
  for (let n = 0; n < count; n++) box(g, x, (n + 1) * rise / 2, z - n * tread, width, (n + 1) * rise, tread + 0.025, mat);
}
function base(g, w, d, mat = ivory) { box(g, 0, 0.065, 0, w, 0.13, d, mat); }
function mullions(g, x0, x1, y0, y1, z, count, mat = white, radius = 0.025) {
  for (let i = 0; i <= count; i++) beam(g, [x0 + (x1 - x0) * i / count, y0, z], [x0 + (x1 - x0) * i / count, y1, z], radius, mat);
}

// Merges only opaque geometry, retaining one draw call per material and valid normals.
function finish(g, id) {
  g.updateMatrixWorld(true);
  const buckets = new Map();
  const temporary = new Set();
  g.traverse(m => {
    if (!m.isMesh) return;
    const source = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    source.applyMatrix4(m.matrixWorld);
    if (source.attributes.position.array.some(v => !Number.isFinite(v))) throw new Error(`Non-finite ${id} ${m.geometry.type} pos=${m.position.toArray()} scale=${m.scale.toArray()} matrix=${m.matrixWorld.elements}`);
    const arr = buckets.get(m.material) || []; arr.push(source); buckets.set(m.material, arr);
    if (![unitBox, unitSphere, unitCylinder].includes(m.geometry)) temporary.add(m.geometry);
  });
  const result = new THREE.Group();
  for (const [mat, geos] of buckets) {
    const n = geos.reduce((sum, geo) => sum + geo.attributes.position.count, 0);
    const p = new Float32Array(n * 3), normal = new Float32Array(n * 3);
    let offset = 0;
    for (const geo of geos) {
      if (!geo.attributes.normal) geo.computeVertexNormals();
      p.set(geo.attributes.position.array, offset); normal.set(geo.attributes.normal.array, offset);
      offset += geo.attributes.position.array.length; geo.dispose();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(p, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
    const m = new THREE.Mesh(geometry, mat); m.castShadow = true; m.receiveShadow = true;
    m.name = `miniature-${id}-${Object.keys(MAT).find(k => MAT[k] === mat)}`; result.add(m);
  }
  temporary.forEach(geo => geo.dispose());
  const bounds = new THREE.Box3().setFromObject(result), size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
  const s = Math.min(1, 4.3 / size.x, 4.3 / size.z, 4.1 / size.y);
  const offset = new THREE.Vector3(-center.x, -bounds.min.y, -center.z);
  for (const child of result.children) {
    child.geometry.translate(...offset.toArray()); child.geometry.scale(s, s, s);
    child.geometry.computeBoundingBox(); child.geometry.computeBoundingSphere();
  }
  result.name = `architectural-miniature-${id}`;
  result.userData = { miniatureId: id, schematic: true, motif: MINIATURE_INFO_A[id].motif };
  return result;
}

function tassel(g) {
  // Narrow stone townhouse, projecting green bow window, whiplash ironwork and slate roof.
  base(g, 2.65, 2.0);
  box(g, 0, 1.72, -0.08, 2.13, 3.16, 1.34, ivory);
  box(g, 0, 1.85, 0.65, 1.07, 2.7, 0.28, glass);
  for (const x of [-0.88, 0.88]) {
    for (const y of [0.67, 1.55, 2.39]) box(g, x, y, 0.602, 0.19, 0.52, 0.06, wood);
    box(g, x, 1.79, 0.64, 0.08, 2.94, 0.08, white);
  }
  // Three faceted, shallow projecting bays create the characteristic central vertical strip.
  for (let row = 0; row < 3; row++) {
    const y = 1.08 + row * 0.76;
    for (let n = -1; n <= 1; n++) {
      const angle = n * -0.38;
      box(g, n * 0.36, y + 0.28, 0.81 - Math.abs(n) * 0.075, 0.37, 0.58, 0.07, glass, [0, angle, 0]);
    }
    box(g, 0, y - 0.04, 0.79, 1.3, 0.10, 0.40, white);
    for (const x of [-0.51, 0, 0.51]) beam(g, [x, y, 0.88], [x, y + 0.59, 0.88], 0.027, bronze);
    curve(g, [[-0.59, y + 0.10, 0.96], [-0.30, y + 0.20, 1.00], [0, y + 0.12, 1.02], [0.3, y + 0.20, 1.0], [0.59, y + 0.10, 0.96]], 0.025, iron);
    for (const x of [-0.42, -0.21, 0, 0.21, 0.42]) beam(g, [x, y - 0.005, 0.97], [x, y + 0.23, 0.97], 0.016, iron);
  }
  box(g, 0, 0.47, 0.65, 0.62, 0.67, 0.12, wood);
  box(g, 0, 0.54, 0.73, 0.04, 0.53, 0.035, bronze);
  box(g, 0, 3.30, -0.06, 2.20, 0.14, 1.49, iron);
  polygon(g, [[-1.08, 0], [1.08, 0], [0.88, 0.47], [-0.88, 0.47]], 1.42, dark, [0, 3.31, -0.10]);
  for (const x of [-0.7, -0.35, 0, 0.35, 0.7]) box(g, x, 3.55, 0.62, 0.025, 0.43, 0.025, bronze, [0, 0, x * 0.15]);
  box(g, -0.89, 3.79, -0.39, 0.19, 0.47, 0.25, stone);
}

function batllo(g) {
  // Gaudí's scaled dragon back, ceramic colors, bone-like lower gallery and mask balconies.
  base(g, 2.82, 1.97);
  box(g, 0, 1.69, -0.09, 2.42, 3.12, 1.44, glass);
  box(g, 0, 0.75, 0.68, 2.46, 1.13, 0.19, ivory);
  for (const x of [-0.85, -0.42, 0, 0.42, 0.85]) {
    ball(g, x, 0.73, 0.80, 0.18, 0.43, 0.055, blueGlass);
    column(g, x + 0.20, 0.67, 0.87, 0.043, 0.93, white);
  }
  curve(g, [[-1.19, 1.20, 0.85], [-0.60, 1.33, 0.94], [0, 1.22, 0.96], [0.60, 1.33, 0.94], [1.19, 1.20, 0.85]], 0.068, white);
  for (let row = 0; row < 3; row++) {
    for (const x of [-0.78, 0, 0.78]) {
      const y = 1.54 + row * 0.54;
      ball(g, x, y + 0.12, 0.68, 0.22, 0.28, 0.055, blueGlass);
      oval(g, x, y + 0.10, 0.73, 0.23, 0.29, 0.10, ivory);
      ball(g, x, y - 0.075, 0.86, 0.29, 0.14, 0.18, white);
      ball(g, x - 0.105, y - 0.04, 1.015, 0.065, 0.057, 0.017, dark);
      ball(g, x + 0.105, y - 0.04, 1.015, 0.065, 0.057, 0.017, dark);
    }
  }
  for (let n = 0; n < 18; n++) {
    const x = -1.08 + (n % 6) * 0.43, y = 1.39 + Math.floor(n / 6) * 0.62;
    ball(g, x, y, 0.653, 0.065, 0.060, 0.028, [pink, lavender, yellow][n % 3]);
  }
  polygon(g, [[-1.25, 0], [1.25, 0], [1.11, 0.45], [0.67, 0.62], [0.1, 0.68], [-0.48, 0.52], [-1.14, 0.37]], 1.55, lavender, [0, 3.17, -0.09]);
  for (let n = 0; n < 10; n++) {
    const x = -1.1 + n * 0.24, y = 3.48 + 0.31 * Math.sin((n / 9) * Math.PI);
    ball(g, x, y, 0.45, 0.17, 0.14, 0.16, [pink, copper, lavender][n % 3]);
  }
  column(g, -0.97, 3.59, -0.27, 0.13, 0.65, ivory);
  beam(g, [-0.97, 3.82, -0.27], [-0.97, 4.06, -0.27], 0.045, white);
  beam(g, [-1.09, 3.96, -0.27], [-0.85, 3.96, -0.27], 0.045, white);
  box(g, 0, 0.39, 0.87, 0.24, 0.48, 0.035, dark);
}

function schroder(g) {
  // De Stijl: independent white/gray planes and red, yellow and blue line accents.
  base(g, 3.75, 3.0);
  box(g, 0, 1.27, -0.08, 2.55, 2.28, 2.03, white);
  box(g, 0.20, 0.69, 1.00, 2.7, 0.68, 0.05, dark);
  box(g, 0.13, 1.83, 1.00, 2.72, 0.63, 0.06, dark);
  box(g, 1.30, 1.80, -0.14, 0.06, 0.69, 1.99, blueGlass);
  box(g, -0.98, 1.81, 1.045, 0.055, 0.63, 0.07, white);
  box(g, 0.52, 1.81, 1.045, 0.055, 0.63, 0.07, white);
  box(g, 0.10, 1.26, 0.16, 3.29, 0.16, 2.68, white);
  box(g, 0.1, 2.45, -0.02, 3.33, 0.15, 2.65, white);
  box(g, -0.35, 1.90, 1.105, 0.63, 1.06, 0.15, silver);
  box(g, -1.39, 1.8, -0.47, 0.12, 1.15, 1.6, silver);
  box(g, 0.56, 1.39, 1.38, 1.97, 0.24, 0.14, white);
  for (const x of [-1.18, 1.24]) box(g, x, 0.70, 1.20, 0.065, 1.14, 0.065, dark);
  box(g, -1.14, 1.30, 1.19, 0.055, 2.37, 0.055, red);
  box(g, 1.03, 0.84, 1.15, 0.055, 1.37, 0.055, yellow);
  box(g, 0.78, 0.18, 1.25, 0.6, 0.10, 0.37, blue);
  box(g, -0.95, 2.58, -0.75, 0.65, 0.17, 0.60, white);
  box(g, 0.38, 2.20, 1.10, 2.46, 0.055, 0.07, dark);
  for (const z of [-0.80, 0.02, 0.74]) box(g, 1.33, 1.81, z, 0.08, 0.69, 0.055, dark);
}

function farnsworth(g) {
  // Two hovering white horizontal planes, eight external columns and the offset terrace.
  base(g, 4.20, 3.25, grass);
  box(g, 0, 0.69, -0.44, 3.78, 0.15, 1.76, ivory);
  box(g, 0, 1.99, -0.44, 3.78, 0.16, 1.76, white);
  box(g, 0, 0.33, 0.99, 3.35, 0.13, 1.03, ivory);
  for (const x of [-1.55, -0.52, 0.52, 1.55]) {
    for (const z of [-1.28, 0.40]) box(g, x, 1.08, z, 0.075, 1.91, 0.08, white);
  }
  box(g, 0, 1.33, -1.20, 3.39, 1.18, 0.045, glass);
  box(g, -1.69, 1.33, -0.43, 0.045, 1.18, 1.58, glass);
  box(g, 1.69, 1.33, -0.43, 0.045, 1.18, 1.58, glass);
  box(g, 0.15, 1.30, -0.73, 1.04, 1.10, 0.59, wood);
  box(g, -1.08, 1.32, 0.36, 1.06, 1.15, 0.035, glass);
  box(g, 1.20, 1.32, 0.36, 0.84, 1.15, 0.035, glass);
  for (const x of [-1.07, -0.53, 0.53, 1.05]) box(g, x, 1.33, 0.39, 0.035, 1.18, 0.035, white);
  for (const x of [-1.27, 1.27]) box(g, x, 0.22, 0.94, 0.09, 0.18, 0.09, white);
  for (let n = 0; n < 3; n++) box(g, 0.25, 0.19 + n * 0.16, 1.51 - n * 0.21, 0.92, 0.095, 0.23, white);
  box(g, -0.75, 0.90, -0.17, 0.58, 0.18, 0.39, white);
}

function savoye(g) {
  // Pilotis, wraparound ribbon window, recessed green ground floor and curved solarium.
  base(g, 3.9, 3.45, grass);
  for (const x of [-1.39, 0, 1.39]) for (const z of [-1.10, 1.10]) column(g, x, 0.68, z, 0.062, 1.1, white);
  box(g, 0, 1.16, 0, 3.23, 0.17, 2.73, white);
  box(g, 0, 1.83, 0, 3.23, 0.16, 2.73, white);
  box(g, 0, 1.47, 0, 3.01, 0.48, 2.51, glass);
  for (const z of [-1.37, 1.37]) {
    box(g, 0, 1.27, z, 3.25, 0.16, 0.10, white);
    box(g, 0, 1.75, z, 3.25, 0.17, 0.10, white);
    for (const x of [-1.44, -0.73, 0, 0.73, 1.44]) box(g, x, 1.49, z, 0.04, 0.35, 0.045, white);
  }
  for (const x of [-1.62, 1.62]) {
    box(g, x, 1.27, 0, 0.10, 0.16, 2.75, white); box(g, x, 1.75, 0, 0.10, 0.17, 2.75, white);
  }
  box(g, -0.3, 0.65, -0.18, 1.85, 0.88, 1.32, iron);
  arcWall(g, 0.11, 0.16, 0.45, 0.86, 0.93, 0, Math.PI, glass, 0.13);
  box(g, 0.15, 1.97, -0.10, 2.35, 0.14, 1.98, white);
  arcWall(g, -0.21, 2.02, -0.21, 0.92, 0.73, -0.1, Math.PI * 1.17, white, 0.14);
  box(g, 0.87, 2.34, -0.56, 0.14, 0.76, 1.06, white);
  box(g, 0.87, 2.32, 0.40, 0.14, 0.71, 0.38, white);
  box(g, 0.88, 2.68, 0.10, 0.16, 0.16, 0.50, white);
  box(g, 0.51, 2.20, 0.14, 0.58, 0.075, 1.55, ivory, [0.20, 0, 0]);
}

function unity(g) {
  // Heavy concrete sanctuary cube, upper clerestory, corner piers and broad eaves.
  base(g, 4.15, 3.22, ivory);
  box(g, -0.73, 1.21, 0.12, 2.15, 2.13, 2.30, stone);
  box(g, 1.35, 0.89, -0.20, 1.10, 1.47, 1.98, stone);
  box(g, 0.55, 0.58, -0.21, 0.66, 0.85, 1.01, dark);
  box(g, -0.73, 2.12, 0.12, 2.50, 0.19, 2.61, ivory);
  box(g, 1.30, 1.68, -0.20, 1.48, 0.17, 2.27, ivory);
  for (const x of [-1.49, -0.98, -0.47, 0.04]) {
    box(g, x, 1.81, 1.285, 0.32, 0.34, 0.04, bronze);
    box(g, x + 0.205, 1.79, 1.32, 0.10, 0.48, 0.12, ivory);
  }
  for (const z of [-0.66, -0.15, 0.36, 0.87]) {
    box(g, -1.824, 1.81, z, 0.04, 0.34, 0.32, bronze);
    box(g, -1.865, 1.79, z + 0.205, 0.12, 0.48, 0.10, ivory);
  }
  for (const x of [-1.63, 0.15]) box(g, x, 1.10, 1.31, 0.12, 1.67, 0.13, ivory);
  box(g, -0.73, 2.38, 0.12, 1.52, 0.36, 1.57, ivory);
  box(g, -0.73, 2.57, 0.12, 1.17, 0.04, 1.22, bronze);
  for (const x of [-1.02, -0.44]) box(g, x, 2.60, 0.12, 0.035, 0.035, 1.23, wood);
  box(g, -0.73, 2.60, 0.12, 1.17, 0.035, 0.035, wood);
  box(g, 1.38, 0.91, 0.81, 0.56, 0.40, 0.04, bronze);
  box(g, 1.54, 1.97, -0.64, 0.22, 0.63, 0.25, stone);
  steps(g, 0.60, 1.24, 0.75, 4, 0.12, 0.18, ivory);
}

function saynatsalo(g) {
  // Brick courtyard on a raised platform, grass steps, and the tall council chamber.
  base(g, 4.05, 3.80, grass);
  box(g, 0, 0.35, -0.08, 3.30, 0.42, 3.12, brick);
  box(g, -0.15, 0.59, -0.10, 1.87, 0.075, 1.68, grass);
  box(g, -1.38, 0.98, -0.20, 0.58, 0.92, 2.86, brickLight);
  box(g, 0, 1.01, -1.38, 3.35, 0.98, 0.58, brickLight);
  box(g, 0.19, 0.86, 1.29, 2.96, 1.41, 0.62, brickLight);
  box(g, 1.27, 1.65, -0.48, 0.99, 2.18, 1.60, brick);
  box(g, -1.38, 1.48, -0.20, 0.71, 0.10, 2.99, copper);
  box(g, 0, 1.54, -1.38, 3.53, 0.12, 0.77, copper);
  box(g, 0.19, 1.60, 1.29, 3.12, 0.12, 0.82, copper);
  polygon(g, [[-0.57, 0], [0.57, 0], [0.57, 0.34], [-0.57, 0.10]], 1.82, copper, [1.27, 2.71, -0.48]);
  for (let n = 0; n < 7; n++) box(g, -1.05 + n * 0.39, 0.73, 1.612, 0.23, 0.86, 0.035, glass);
  for (let n = 0; n < 5; n++) box(g, -1.072, 1.10, -0.95 + n * 0.46, 0.04, 0.47, 0.26, dark);
  box(g, 1.26, 1.78, 0.335, 0.56, 0.15, 0.035, dark);
  steps(g, -1.52, 1.69, 0.70, 5, 0.115, 0.19, grass);
  steps(g, 0.72, 0.90, 0.53, 5, 0.115, 0.14, brick);
  box(g, -0.37, 0.77, -0.31, 0.15, 0.30, 0.15, stone);
}

function luce(g) {
  // Four separated warped shells; pale edge ribs, warm tile surfaces and glazed gables.
  base(g, 3.65, 3.35, ivory);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const positions = [], indices = [], rows = 12, cols = 6;
    for (let a = 0; a <= rows; a++) {
      const u = a / rows;
      for (let b = 0; b <= cols; b++) {
        const v = b / cols;
        const x = sx * (0.08 + 1.40 * Math.pow(1 - u, 1.57));
        const y = 0.15 + (sz > 0 ? 3.16 : 3.34) * u + 0.08 * u * v;
        const z = sz * (0.055 + v * (1.29 - 0.12 * u));
        positions.push(x, y, z);
      }
    }
    for (let a = 0; a < rows; a++) for (let b = 0; b < cols; b++) {
      const i = a * (cols + 1) + b;
      indices.push(i, i + 1, i + cols + 1, i + 1, i + cols + 2, i + cols + 1);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geo.setIndex(indices); geo.computeVertexNormals();
    mesh(g, geo, roofGold);
    for (const v of [0, 1]) {
      const pts = [];
      for (let a = 0; a <= 8; a++) {
        const u = a / 8; pts.push([sx * (0.08 + 1.4 * Math.pow(1 - u, 1.57)), 0.16 + (sz > 0 ? 3.16 : 3.34) * u + 0.08 * u * v, sz * (0.055 + v * (1.29 - 0.12 * u))]);
      }
      curve(g, pts, 0.035, white);
    }
  }
  const gable = [[-1.38, 0.16], [1.38, 0.16]];
  for (let a = 1; a <= 10; a++) { const u = a / 10; gable.push([0.07 + 1.31 * Math.pow(1 - u, 1.57), 0.16 + 3.14 * u]); }
  for (let a = 10; a >= 1; a--) { const u = a / 10; gable.push([-0.07 - 1.31 * Math.pow(1 - u, 1.57), 0.16 + 3.14 * u]); }
  polygon(g, gable, 0.055, blueGlass, [0, 0, 1.18]);
  beam(g, [0, 0.20, 1.23], [0, 3.29, 1.23], 0.026, ivory);
  for (const y of [0.77, 1.39, 2.01, 2.63]) {
    const u = (y - 0.16) / 3.14, w = 0.07 + 1.31 * Math.pow(1 - u, 1.57);
    beam(g, [-w, y, 1.23], [w, y, 1.23], 0.022, ivory);
  }
  box(g, 0, 0.44, 1.24, 0.41, 0.57, 0.045, wood);
  beam(g, [0, 3.49, -0.98], [0, 3.88, -0.98], 0.024, dark);
  beam(g, [-0.13, 3.76, -0.98], [0.13, 3.76, -0.98], 0.024, dark);
}

function douglas(g) {
  // Tall white frame descending the slope, stacked terraces, rooftop bridge and curved skylight.
  base(g, 3.27, 3.49, ivory);
  box(g, -0.10, 1.75, -0.19, 2.20, 3.20, 1.84, white);
  box(g, 0.04, 1.80, 0.748, 1.92, 2.82, 0.065, blueGlass);
  for (let n = 0; n < 4; n++) {
    const y = 0.48 + n * 0.76;
    box(g, 0.19, y, 0.42, 2.62, 0.12, 2.35, white);
    for (const x of [-1.10, -0.42, 0.25, 0.92]) box(g, x, y + 0.32, 1.11, 0.045, 0.65, 0.045, white);
    beam(g, [-1.15, y + 0.56, 1.11], [1.35, y + 0.56, 1.11], 0.025, white);
    beam(g, [-1.15, y + 0.40, 1.11], [1.35, y + 0.40, 1.11], 0.018, white);
  }
  for (const x of [-0.88, -0.30, 0.29, 0.87]) box(g, x, 1.80, 0.80, 0.043, 2.86, 0.04, white);
  box(g, -1.22, 1.72, -0.32, 0.26, 3.10, 0.31, white);
  box(g, 0.97, 3.26, -0.41, 0.36, 0.54, 0.78, white);
  box(g, 0.37, 3.33, -1.17, 0.56, 0.10, 1.36, white);
  for (const x of [0.11, 0.63]) beam(g, [x, 3.63, -1.81], [x, 3.63, -0.68], 0.022, white);
  // Barrel skylight is a half-cylinder across the roof, not a generic pitched roof.
  mesh(g, new THREE.CylinderGeometry(0.36, 0.36, 1.25, 14, 1, false, 0, Math.PI), blueGlass, [-0.30, 3.35, -0.05], [1, 1, 1], [0, 0, Math.PI / 2]);
  for (const x of [-0.86, -0.58, -0.30, -0.02, 0.26]) curve(g, [[x, 3.34, -0.41], [x, 3.62, -0.29], [x, 3.71, -0.05], [x, 3.62, 0.20], [x, 3.34, 0.31]], 0.022, white);
}

function menil(g) {
  // Low gray timber galleries and a rhythmic, leaf-shaped daylight-control roof.
  base(g, 4.23, 3.15, grass);
  box(g, 0, 0.27, 0, 4.06, 0.18, 2.74, ivory);
  box(g, 0, 0.83, -0.16, 3.72, 1.00, 2.13, silver);
  box(g, 0, 0.83, 0.925, 3.66, 0.71, 0.04, blueGlass);
  box(g, 0, 1.36, -0.06, 4.05, 0.10, 2.74, white);
  for (let n = 0; n < 9; n++) column(g, -1.84 + n * 0.46, 0.85, 1.26, 0.035, 1.03, white);
  for (let n = 0; n < 10; n++) box(g, -1.83 + n * 0.405, 0.83, 0.96, 0.028, 0.76, 0.03, white);
  // Each lightweight 'leaf' has a tapered, slightly upturned cross section.
  for (let n = 0; n < 12; n++) {
    const x = -1.82 + n * 0.33;
    polygon(g, [[-0.17, 0], [0.13, 0.02], [0.18, 0.12], [0.14, 0.17], [0.07, 0.08], [-0.17, 0.055]], 2.59, white, [x, 1.43, -0.07]);
  }
  box(g, 0, 1.73, -0.77, 3.80, 0.36, 0.45, ivory);
  box(g, 0, 1.94, -0.77, 3.95, 0.075, 0.61, white);
  for (let n = 0; n < 5; n++) box(g, -1.55 + n * 0.77, 1.74, -0.527, 0.45, 0.13, 0.035, glass);
  for (const y of [0.53, 0.71, 0.89, 1.07, 1.25]) box(g, -1.872, y, -0.16, 0.022, 0.018, 2.12, dark);
}

function gunma(g) {
  // Isozaki's silver modular cube grid, low galleries and a square reflecting pool.
  base(g, 4.24, 3.63, ivory);
  box(g, -0.78, 0.155, 0.80, 2.59, 0.05, 1.88, water);
  box(g, 0.18, 0.24, -0.60, 3.89, 0.16, 1.91, stone);
  box(g, -0.02, 0.91, -0.60, 3.54, 1.20, 1.62, silver);
  box(g, -0.43, 0.86, 0.23, 2.72, 0.66, 0.045, blueGlass);
  box(g, 0.85, 1.17, -0.04, 0.94, 1.74, 1.28, silver);
  box(g, -1.19, 0.95, 0.76, 0.82, 1.60, 0.82, silver);
  box(g, -1.19, 1.80, 0.76, 0.92, 0.11, 0.92, white);
  box(g, 0.85, 2.09, -0.04, 1.07, 0.12, 1.40, white);
  box(g, -0.02, 1.56, -0.60, 3.76, 0.12, 1.78, white);
  for (const cx of [-1.19, 0.85]) {
    const z = cx < 0 ? 1.178 : 0.61, low = cx < 0 ? 0.2 : 0.34, high = cx < 0 ? 1.73 : 2.02;
    for (let n = 1; n <= 4; n++) box(g, cx - 0.43 + n * 0.175, (low + high) / 2, z, 0.017, high - low, 0.017, white);
    for (let n = 1; n <= 6; n++) box(g, cx, low + n * (high - low) / 7, z, 0.84, 0.017, 0.017, white);
  }
  for (let n = 0; n < 9; n++) box(g, -1.66 + n * 0.30, 0.86, 0.27, 0.036, 0.66, 0.035, white);
  box(g, 1.61, 0.27, 0.82, 0.70, 0.14, 1.49, white);
  box(g, -1.19, 0.83, 1.196, 0.25, 0.39, 0.025, dark);
}

function retti(g) {
  // Aluminum portal with capsule-shaped upper opening, narrow stem and paired display cases.
  // Reference: Austrian Federal Monuments Authority, Retti restoration, December 2022.
  base(g, 3.18, 2.21, stone);
  box(g, 0, 1.73, -0.32, 2.87, 3.17, 1.43, ivory);
  box(g, 0, 1.73, 0.45, 2.54, 3.17, 0.19, silver);
  box(g, -1.34, 1.72, 0.55, 0.10, 3.17, 0.18, white);
  box(g, 1.34, 1.72, 0.55, 0.10, 3.17, 0.18, white);
  box(g, 0, 1.18, 0.572, 0.43, 2.05, 0.045, dark);
  box(g, -0.12, 1.15, 0.61, 0.12, 1.97, 0.045, blueGlass);
  box(g, 0.12, 1.15, 0.61, 0.12, 1.97, 0.045, blueGlass);
  // Rounded capsule above the door reads as a metallic keyhole rather than a plain storefront.
  ball(g, 0, 2.42, 0.59, 0.81, 0.34, 0.16, dark);
  ball(g, 0, 2.43, 0.69, 0.75, 0.29, 0.10, silver);
  box(g, 0, 2.40, 0.79, 1.10, 0.20, 0.03, ivory);
  for (const x of [-0.83, 0.83]) {
    box(g, x, 1.00, 0.68, 0.47, 0.60, 0.28, white);
    box(g, x, 1.01, 0.835, 0.32, 0.46, 0.03, blueGlass);
    for (const dx of [-0.09, 0.09]) column(g, x + dx, 0.98, 0.864, 0.035, 0.30, ivory);
    box(g, x, 1.01, 0.886, 0.026, 0.51, 0.026, silver);
  }
  box(g, 0, 1.18, 0.67, 0.032, 2.01, 0.035, silver);
  box(g, 0, 0.21, 0.82, 0.64, 0.10, 0.49, silver);
}

function aerospace(g) {
  // Gehry's faceted, cantilevered metal volume meets an upright stucco block and a climbing F-104.
  // Reference: LA Conservancy, Air and Space Gallery, California Science Center.
  base(g, 4.28, 3.28, ivory);
  box(g, -1.14, 0.74, -0.12, 1.27, 1.12, 1.71, silver);
  const pts = [[-0.85, -0.58], [-0.22, -0.91], [0.69, -0.71], [0.96, -0.12], [0.73, 0.72], [-0.13, 0.88], [-0.92, 0.39]];
  const positions = [], indices = [];
  for (const [x, z] of pts) positions.push(-1.03 + x * 0.77, 0.78, z * 0.79);
  for (const [x, z] of pts) positions.push(-1.03 + x, 2.60 + x * 0.10, z);
  for (let n = 0; n < 7; n++) { const j = (n + 1) % 7; indices.push(n, j, j + 7, n, j + 7, n + 7); }
  for (let n = 1; n < 6; n++) indices.push(7, 7 + n, 8 + n, 0, n + 1, n);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geo.setIndex(indices); geo.computeVertexNormals();
  const faceted = geo.toNonIndexed(); faceted.computeVertexNormals(); geo.dispose();
  mesh(g, faceted, silver);
  box(g, 1.08, 1.44, -0.31, 1.62, 2.59, 1.95, ivory);
  box(g, 1.10, 0.88, 0.69, 0.61, 1.47, 0.045, dark);
  box(g, 0.08, 1.34, 0.81, 0.75, 2.14, 0.06, glass);
  for (let n = 0; n <= 5; n++) box(g, -0.27 + n * 0.14, 1.34, 0.85, 0.022, 2.14, 0.022, white);
  for (let n = 0; n <= 9; n++) box(g, 0.08, 0.30 + n * 0.23, 0.85, 0.75, 0.022, 0.022, white);
  box(g, 0.15, 2.54, -0.24, 0.95, 1.05, 0.89, dark, [-0.16, 0.09, -0.16]);
  box(g, 0.16, 2.60, 0.257, 0.63, 0.74, 0.035, blueGlass, [-0.16, 0.09, -0.16]);
  box(g, 1.41, 2.90, -0.79, 0.54, 0.44, 0.62, silver);
  beam(g, [1.32, 1.38, 0.75], [1.22, 2.83, 1.15], 0.052, white);
  beam(g, [0.77, 2.22, 0.76], [1.22, 2.83, 1.15], 0.052, white);
  // Miniature slender Starfighter, pitched upward, with narrow wings and a blue tail.
  const jet = new THREE.Group(); g.add(jet); jet.position.set(1.18, 2.83, 1.17); jet.rotation.set(0.80, 0.16, -0.37);
  column(jet, 0, 0, 0, 0.092, 1.23, white);
  mesh(jet, new THREE.ConeGeometry(0.093, 0.38, 10), white, [0, 0.79, 0]);
  ball(jet, 0, 0.28, 0.075, 0.073, 0.22, 0.065, blueGlass);
  polygon(jet, [[-0.56, -0.32], [0, 0.20], [0.56, -0.32]], 0.045, silver, [0, -0.07, 0]);
  polygon(jet, [[-0.27, -0.11], [0, 0.15], [0.27, -0.11]], 0.04, blue, [0, -0.53, 0]);
  polygon(jet, [[-0.10, -0.23], [0.23, -0.20], [-0.08, 0.21]], 0.045, blue, [0, -0.49, 0.09], [0, Math.PI / 2, 0]);
}

export const MINIATURE_INFO_A = {
  1: { motif: '新藝術石牆、綠色凸窗與曲線鐵欄' },
  2: { motif: '龍背彩瓦、骨骼柱與面具陽台' },
  3: { motif: '白灰浮動平面與紅黃藍線條' },
  4: { motif: '漂浮白色樓板、八柱與玻璃盒' },
  5: { motif: '架空圓柱、水平帶窗與曲面日光浴場' },
  6: { motif: '厚重混凝土方盒、高側窗與大屋簷' },
  7: { motif: '紅磚高庭院、草階與議事廳高塔' },
  8: { motif: '四片金色曲面薄殼、玻璃山牆與十字架' },
  9: { motif: '白色垂直框架、層疊露台與屋頂入口橋' },
  10: { motif: '低矮灰木展廳、白色葉片採光屋頂' },
  11: { motif: '銀色模矩方盒、網格外牆與水池' },
  12: { motif: '鋁製鑰匙孔門面與成對燭品櫥窗' },
  13: { motif: '傾斜金屬多面體與爬升的 F-104 飛機' }
};
const BUILDERS = { 1: tassel, 2: batllo, 3: schroder, 4: farnsworth, 5: savoye, 6: unity, 7: saynatsalo, 8: luce, 9: douglas, 10: menil, 11: gunma, 12: retti, 13: aerospace };
export function createMiniatureA(item) {
  const id = Number(item?.id ?? item), build = BUILDERS[id];
  if (!build) return null;
  const g = new THREE.Group(); build(g); return finish(g, id);
}

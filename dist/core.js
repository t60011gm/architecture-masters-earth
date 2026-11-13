import {mapPoint} from './world-map.js';
export const SAVE_KEY = 'architecture-islands-v1';
export const PLAYABLE = Array.from({length: 25}, (_, i) => i + 1);
export const ISLAND_RADIUS = 24;
const WALK_RADIUS = 22.4;

export function mapPosition(id) {return mapPoint(id);}
export function freshProgress() {
  return {version: 1, visited: [], quests: {}, met: [], settings: {quality: 'auto', timeOfDay: 'day'}};
}
export function sanitizeProgress(data) {
  const p = freshProgress();
  if (!data || data.version !== 1) return p;
  p.visited = [...new Set((Array.isArray(data.visited) ? data.visited : []).filter(x => PLAYABLE.includes(x)))];
  p.met = [...new Set((Array.isArray(data.met) ? data.met : []).filter(x => PLAYABLE.includes(x)))];
  for (const id of PLAYABLE) p.quests[id] = [...new Set((Array.isArray(data.quests?.[id]) ? data.quests[id] : []).filter(x => Number.isInteger(x) && x >= 0 && x < 3))];
  if (['auto', 'low', 'high'].includes(data.settings?.quality)) p.settings.quality = data.settings.quality;
  if (['day', 'golden', 'night'].includes(data.settings?.timeOfDay)) p.settings.timeOfDay = data.settings.timeOfDay;
  return p;
}
export function completeQuest(progress, id, index) {
  if (!PLAYABLE.includes(id) || !Number.isInteger(index) || index < 0 || index > 2) return false;
  progress.quests[id] ??= [];
  if (progress.quests[id].includes(index)) return false;
  progress.quests[id].push(index);
  return true;
}
export function stamps(progress) {
  return PLAYABLE.filter(id => progress.met.includes(id) && progress.quests[id]?.length === 3);
}
export function buildingLayout(cfg) {
  const b = cfg.bounds, s = Math.min(19 / Math.max(b.max[0] - b.min[0], b.max[2] - b.min[2]), cfg.maxModelHeight ? cfg.maxModelHeight / Math.max(1, b.max[1] - b.min[1]) : Infinity);
  const hw = (b.max[0] - b.min[0]) * s / 2, hz = (b.max[2] - b.min[2]) * s / 2;
  const center=[(b.max[0] + b.min[0]) / 2, 0, (b.max[2] + b.min[2]) / 2];
  const entries=cfg.observationEntries?.map(([x,z])=>({x:(x-center[0])*s,z:(z-center[2])*s}));
  return {scale: s, center, modelY:.42-(cfg.modelGroundSourceY||0)*s, rect: {minX: -hw - .65, maxX: hw + .65, minZ: -hz - .65, maxZ: hz + .65}, quests: entries || [{x: -hw - 3, z: hz * .7}, {x: hw + 3, z: hz * .5}, {x: 0, z: -hz - 3.4}], npc: {x: 0, z: hz + 4.5}, spawn: {x: 0, z: 19.7}};
}
export function canWalk(x, z, rect, r = WALK_RADIUS) {
  return Number.isFinite(x) && Number.isFinite(z) && x * x + z * z < r * r && !(x > rect.minX && x < rect.maxX && z > rect.minZ && z < rect.maxZ);
}
export function nearestWalkable(point, rect) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.z)) return null;
  if (canWalk(point.x, point.z, rect)) return {x: point.x, z: point.z};
  let best = null, dist = Infinity;
  for (let x = -22; x <= 22; x += .7) for (let z = -22; z <= 22; z += .7) {
    if (!canWalk(x, z, rect)) continue;
    const d = Math.hypot(point.x - x, point.z - z);
    if (d < dist) {dist = d; best = {x, z};}
  }
  return best;
}
export function lineWalkable(a, b, rect) {
  if (!a || !b || !canWalk(a.x, a.z, rect) || !canWalk(b.x, b.z, rect)) return false;
  // The island disk is convex: valid endpoints keep the whole segment inside it.
  // Intersect the segment with the building's open rectangle exactly. Sampling
  // misses short corner crossings, especially on diagonal paths.
  let enter = 0, leave = 1;
  for (const [axis, min, max] of [['x', rect.minX, rect.maxX], ['z', rect.minZ, rect.maxZ]]) {
    const delta = b[axis] - a[axis];
    if (Math.abs(delta) < 1e-12) {
      if (a[axis] <= min || a[axis] >= max) return true;
      continue;
    }
    const t1 = (min - a[axis]) / delta, t2 = (max - a[axis]) / delta;
    enter = Math.max(enter, Math.min(t1, t2));
    leave = Math.min(leave, Math.max(t1, t2));
    if (enter >= leave) return true;
  }
  return enter >= leave;
}
function gridConnector(point, rect) {
  let best = null, distance = Infinity;
  // Choose a real walkable integer node joined to the original endpoint.
  // Rounding a nearby non-grid walkable point can land inside the obstacle.
  for (let x = -22; x <= 22; x++) for (let z = -22; z <= 22; z++) {
    const d = (point.x - x) ** 2 + (point.z - z) ** 2;
    if (d >= distance) continue;
    const node = {x, z};
    if (lineWalkable(point, node, rect)) {best = node; distance = d;}
  }
  return best;
}
export function findPath(start, end, rect) {
  if (!start || !canWalk(start.x, start.z, rect)) return [];
  end = nearestWalkable(end, rect);
  if (!end) return [];
  if (lineWalkable(start, end, rect)) return [end];
  const a = gridConnector(start, rect), b = gridConnector(end, rect);
  if (!a || !b) return [];
  const key = p => `${p.x},${p.z}`;
  const open = [{...a, g: 0, f: Math.hypot(a.x - b.x, a.z - b.z)}];
  const cost = new Map([[key(a), 0]]), parent = new Map(), seen = new Set();
  let found = null;
  while (open.length) {
    open.sort((a, b) => a.f - b.f);
    const cur = open.shift(), ck = key(cur);
    if (seen.has(ck)) continue;
    seen.add(ck);
    if (cur.x === b.x && cur.z === b.z) {found = cur; break;}
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const n = {x: cur.x + dx, z: cur.z + dz};
      if (Math.abs(n.x) > 22 || Math.abs(n.z) > 22 || !lineWalkable(cur, n, rect)) continue;
      const k = key(n), g = cur.g + Math.hypot(dx, dz);
      if (g >= (cost.get(k) ?? Infinity)) continue;
      cost.set(k, g);
      parent.set(k, cur);
      open.push({...n, g, f: g + Math.hypot(n.x - b.x, n.z - b.z)});
    }
  }
  if (!found) return [];
  const graph = [];
  let cur = found;
  while (true) {
    graph.unshift({x: cur.x, z: cur.z});
    if (cur.x === a.x && cur.z === a.z) break;
    cur = parent.get(key(cur));
    if (!cur) return [];
  }
  const path = [start, ...graph, end], simple = [];
  let i = 0;
  while (i < path.length - 1) {
    let j = path.length - 1;
    while (j > i + 1 && !lineWalkable(path[i], path[j], rect)) j--;
    // Every retained leg must be safe, including both endpoint connectors.
    if (!lineWalkable(path[i], path[j], rect)) return [];
    if (Math.hypot(path[j].x - path[i].x, path[j].z - path[i].z) > 1e-9) simple.push(path[j]);
    i = j;
  }
  return simple.length ? simple : [end];
}

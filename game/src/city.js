// City layout: street grid, blocks, beach, parks, garage, pickups.
import { WORLD_W, WORLD_H, ROAD_W, BLOCK, COLORS } from './config.js';

export function roadCenters() {
  const xs = [], ys = [];
  for (let x = 150; x < WORLD_W; x += BLOCK) xs.push(x);
  for (let y = 150; y < WORLD_H; y += BLOCK) ys.push(y);
  return { xs, ys };
}

export function isOnRoad(x, y, margin) {
  const m = margin || 0;
  const { xs, ys } = roadCenters();
  for (const cx of xs) if (Math.abs(x - cx) <= ROAD_W / 2 + m) return true;
  for (const cy of ys) if (Math.abs(y - cy) <= ROAD_W / 2 + m) return true;
  return false;
}

export function nearestRoadPoint(x, y) {
  const { xs, ys } = roadCenters();
  let bestX = xs[0], bestY = ys[0], bd = 1e18;
  for (const cx of xs) { const d = Math.abs(cx - x); if (d < bd) { bd = d; bestX = cx; } }
  bd = 1e18;
  for (const cy of ys) { const d = Math.abs(cy - y); if (d < bd) { bd = d; bestY = cy; } }
  // Snap to whichever road axis is closer so the point sits on asphalt.
  if (Math.abs(bestX - x) <= Math.abs(bestY - y)) return { x: bestX, y };
  return { x, y: bestY };
}

export function buildCity(rng) {
  const { xs, ys } = roadCenters();
  const buildings = [], parks = [], lights = [], neonSigns = [];
  const beachY = WORLD_H - 260;
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const bx = xs[i] + ROAD_W / 2 + 14, by = ys[j] + ROAD_W / 2 + 14;
      const bw = BLOCK - ROAD_W - 28, bh = BLOCK - ROAD_W - 28;
      if (by + bh > beachY - 30) continue;
      if (rng.chance(0.14)) { parks.push({ x: bx, y: by, w: bw, h: bh }); continue; }
      const cols = 2, rows = 2;
      for (let a = 0; a < cols; a++) for (let b = 0; b < rows; b++) {
        if (rng.chance(0.12)) continue;
        const w = bw / cols - 10, h = bh / rows - 10;
        const x = bx + a * (bw / cols) + 5, y = by + b * (bh / rows) + 5;
        buildings.push({ x, y, w, h, color: rng.pick(COLORS.building), floors: rng.int(2, 6) });
        if (rng.chance(0.5)) neonSigns.push({ x: x + w / 2, y: y + 8, color: rng.pick(COLORS.neon), text: rng.pick(['HOTEL', 'BAR', '24H', 'PIZZA', 'CLUB', 'CAFE']) });
      }
    }
  }
  for (const cx of xs) for (const cy of ys) lights.push({ x: cx, y: cy, phase: rng.next() * 6.28 });
  const garage = { x: xs[1], y: ys[1], r: 46 };
  const spawn = { x: xs[2] + 30, y: ys[2] + 30 };
  const pistol = { x: xs[0] + 20, y: ys[0] - 20, kind: 'pistol' };
  const health = { x: xs[xs.length - 1] - 20, y: ys[0] + 20, kind: 'health' };
  return { xs, ys, buildings, parks, lights, neonSigns, beachY, garage, spawn, pickups: [pistol, health] };
}

export function collideBuildings(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

export function pushOutOfBuildings(city, ent, r) {
  const b = collideBuildings(city, ent.x, ent.y, r);
  if (!b) return false;
  const left = ent.x + r - b.x, right = b.x + b.w - (ent.x - r);
  const top = ent.y + r - b.y, bottom = b.y + b.h - (ent.y - r);
  const m = Math.min(left, right, top, bottom);
  if (m === left) ent.x = b.x - r;
  else if (m === right) ent.x = b.x + b.w + r;
  else if (m === top) ent.y = b.y - r;
  else ent.y = b.y + b.h + r;
  return true;
}

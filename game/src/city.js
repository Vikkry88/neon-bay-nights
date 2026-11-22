// Neon Bay city generation: road grid, city blocks with buildings and parks,
// beach + sea on the east, neon signs, traffic lights and street spawn points.
// Everything is derived from the seed so staged screenshots are deterministic.

import { WORLD, SEA_X, BEACH_X } from './config.js';
import { makeRng, rngRange, rngPick } from './random.js';

const SIGN_WORDS = ['NEON', 'BAY', 'PALM', 'HOTEL', 'DINER', 'CLUB', 'PIER', '24H', 'CAFE', 'MOTEL', 'BAR', 'SURF'];
const SIGN_COLORS = ['#ff2e88', '#00f5d4', '#fee440', '#00bbf9', '#9b5de5', '#f15bb5'];
const BUILDING_COLORS = ['#2b3a67', '#3d5a80', '#495867', '#577590', '#6d597a', '#355070', '#4361ee', '#3a506b'];

export function roadCenterLines() {
  const lines = [];
  for (let v = WORLD.road / 2; v < WORLD.width; v += WORLD.block) lines.push(v);
  return lines;
}

export function isRoad(x, y) {
  const m = WORLD.block;
  const r = WORLD.road;
  const lx = ((x % m) + m) % m;
  const ly = ((y % m) + m) % m;
  return lx < r || ly < r;
}

export function nearestRoadPoint(x, y) {
  const m = WORLD.block;
  const r = WORLD.road;
  const gx = Math.floor(x / m) * m + r / 2;
  const gy = Math.floor(y / m) * m + r / 2;
  const candidates = [
    { x: gx, y },
    { x: gx + m, y },
    { x, y: gy },
    { x, y: gy + m },
  ];
  let best = candidates[0];
  let bestD = Infinity;
  for (const c of candidates) {
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return {
    x: Math.min(Math.max(best.x, 30), BEACH_X - 60),
    y: Math.min(Math.max(best.y, 30), WORLD.height - 30),
  };
}

export function buildCity(seed) {
  const rng = makeRng(seed * 7919 + 13);
  const buildings = [];
  const parks = [];
  const signs = [];
  const lights = [];
  const palms = [];
  const m = WORLD.block;
  const r = WORLD.road;

  for (let bx = 0; bx < WORLD.width; bx += m) {
    for (let by = 0; by < WORLD.height; by += m) {
      const innerX = bx + r;
      const innerY = by + r;
      const innerW = m - r;
      const innerH = m - r;
      if (innerX + innerW > BEACH_X) continue; // keep the beach clear
      const roll = rng();
      if (roll < 0.16) {
        parks.push({ x: innerX, y: innerY, w: innerW, h: innerH });
        for (let i = 0; i < 5; i += 1) {
          palms.push({ x: innerX + rngRange(rng, 20, innerW - 20), y: innerY + rngRange(rng, 20, innerH - 20) });
        }
      } else {
        const cols = 2;
        const rows = 2;
        const bw = innerW / cols;
        const bh = innerH / rows;
        for (let cx = 0; cx < cols; cx += 1) {
          for (let cy = 0; cy < rows; cy += 1) {
            const pad = 10;
            const b = {
              x: innerX + cx * bw + pad,
              y: innerY + cy * bh + pad,
              w: bw - pad * 2,
              h: bh - pad * 2,
              color: rngPick(rng, BUILDING_COLORS),
              roof: rngRange(rng, 0.25, 0.5),
            };
            buildings.push(b);
            if (rng() < 0.4) {
              signs.push({
                x: b.x + b.w / 2,
                y: b.y + 14,
                text: rngPick(rng, SIGN_WORDS),
                color: rngPick(rng, SIGN_COLORS),
                vertical: rng() < 0.35,
              });
            }
          }
        }
      }
    }
  }

  // Beach palms along the sand.
  for (let y = 120; y < WORLD.height; y += 170) {
    palms.push({ x: BEACH_X + rngRange(rng, 30, 120), y: y + rngRange(rng, -30, 30) });
  }

  // Traffic lights at every intersection.
  for (let lx = r / 2; lx < BEACH_X; lx += m) {
    for (let ly = r / 2; ly < WORLD.height; ly += m) {
      lights.push({ x: lx + r / 2 + 6, y: ly + r / 2 + 6, phase: rngRange(rng, 0, 8) });
    }
  }

  // Street points: intersections used for missions, pickups and spawns.
  const streetPoints = [];
  for (let lx = r / 2; lx < BEACH_X; lx += m) {
    for (let ly = r / 2; ly < WORLD.height; ly += m) {
      streetPoints.push({ x: lx, y: ly });
    }
  }

  return { buildings, parks, signs, lights, palms, streetPoints, seaX: SEA_X, beachX: BEACH_X };
}

export function collidesBuilding(city, x, y, radius) {
  for (const b of city.buildings) {
    if (x + radius > b.x && x - radius < b.x + b.w && y + radius > b.y && y - radius < b.y + b.h) {
      return b;
    }
  }
  return null;
}

export function pushOutOfBuildings(city, entity, radius) {
  const b = collidesBuilding(city, entity.x, entity.y, radius);
  if (!b) return false;
  const left = entity.x + radius - b.x;
  const right = b.x + b.w - (entity.x - radius);
  const top = entity.y + radius - b.y;
  const bottom = b.y + b.h - (entity.y - radius);
  const min = Math.min(left, right, top, bottom);
  if (min === left) entity.x = b.x - radius;
  else if (min === right) entity.x = b.x + b.w + radius;
  else if (min === top) entity.y = b.y - radius;
  else entity.y = b.y + b.h + radius;
  return true;
}

export function clampToWorld(entity, radius) {
  entity.x = Math.min(Math.max(entity.x, radius), SEA_X - radius - 4);
  entity.y = Math.min(Math.max(entity.y, radius), WORLD.height - radius);
}

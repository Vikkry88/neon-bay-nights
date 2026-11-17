// The city of Neon Bay: a street grid, building blocks, two parks, a beach and the sea,
// traffic lights at every intersection, and the collision helpers the world uses.
// Buildings are placed once from the seeded random, so the same seed always builds the
// same city. Nothing here draws or steps the game; it only describes the map.

import { BEACH, PALETTE, ROAD_HALF, ROAD_SPACING, ROAD_X, ROAD_Y, SPAWN, WORLD } from './config.js';

/** The two park blocks (grass, palms, paths), kept free of buildings. */
export const PARKS = [
  { x: ROAD_X[3] + ROAD_HALF, y: ROAD_Y[2] + ROAD_HALF, w: ROAD_SPACING - ROAD_HALF * 2, h: ROAD_SPACING - ROAD_HALF * 2 },
  { x: ROAD_X[6] + ROAD_HALF, y: ROAD_Y[1] + ROAD_HALF, w: ROAD_SPACING - ROAD_HALF * 2, h: ROAD_SPACING - ROAD_HALF * 2 },
];

/** The plaza around the spawn point, also kept clear of buildings. */
const SPAWN_CLEAR = { x: SPAWN.x - 90, y: SPAWN.y - 90, w: 180, h: 180 };

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function createCity(random) {
  const buildings = [];
  const palms = [];
  // One or two buildings per block, placed inside the block with a margin from the roads.
  for (let col = 0; col < ROAD_X.length - 1; col += 1) {
    for (let row = 0; row < ROAD_Y.length - 1; row += 1) {
      const bx = ROAD_X[col] + ROAD_HALF + 14;
      const by = ROAD_Y[row] + ROAD_HALF + 14;
      const bw = ROAD_SPACING - ROAD_HALF * 2 - 28;
      const bh = ROAD_SPACING - ROAD_HALF * 2 - 28;
      const block = { x: bx, y: by, w: bw, h: bh };
      if (PARKS.some((park) => rectsOverlap(block, park))) continue;
      if (rectsOverlap(block, SPAWN_CLEAR)) continue;
      const count = random() < 0.55 ? 2 : 1;
      const colorIndex = Math.floor(random() * PALETTE.building.length);
      if (count === 1) {
        const w = bw * (0.55 + random() * 0.3);
        const h = bh * (0.55 + random() * 0.3);
        buildings.push({
          x: bx + (bw - w) / 2, y: by + (bh - h) / 2, w, h,
          color: PALETTE.building[colorIndex], roof: PALETTE.buildingRoof[colorIndex],
        });
      } else {
        // Two buildings side by side, split along the longer axis.
        const horizontal = bw >= bh;
        const split = 0.42 + random() * 0.16;
        const gap = 26;
        if (horizontal) {
          const w1 = (bw - gap) * split;
          const w2 = bw - gap - w1;
          buildings.push({ x: bx, y: by + 8, w: w1, h: bh - 16, color: PALETTE.building[colorIndex], roof: PALETTE.buildingRoof[colorIndex] });
          const c2 = Math.floor(random() * PALETTE.building.length);
          buildings.push({ x: bx + w1 + gap, y: by + 8, w: w2, h: bh - 16, color: PALETTE.building[c2], roof: PALETTE.buildingRoof[c2] });
        } else {
          const h1 = (bh - gap) * split;
          const h2 = bh - gap - h1;
          buildings.push({ x: bx + 8, y: by, w: bw - 16, h: h1, color: PALETTE.building[colorIndex], roof: PALETTE.buildingRoof[colorIndex] });
          const c2 = Math.floor(random() * PALETTE.building.length);
          buildings.push({ x: bx + 8, y: by + h1 + gap, w: bw - 16, h: h2, color: PALETTE.building[c2], roof: PALETTE.buildingRoof[c2] });
        }
      }
    }
  }
  // Palms: scattered in the parks and along the beach promenade.
  for (const park of PARKS) {
    for (let i = 0; i < 7; i += 1) {
      palms.push({ x: park.x + 24 + random() * (park.w - 48), y: park.y + 24 + random() * (park.h - 48) });
    }
  }
  for (let i = 0; i < 22; i += 1) {
    palms.push({ x: 40 + random() * (WORLD.width - 80), y: BEACH.sandTop + 16 + random() * 110 });
  }
  // Traffic lights at every intersection, cycling on a shared clock.
  const lights = [];
  for (const x of ROAD_X) {
    for (const y of ROAD_Y) lights.push({ x, y, phase: ((x + y) / ROAD_SPACING) % 2 });
  }
  return { buildings, palms, lights, parks: PARKS };
}

/** True when the point is on a road (within the road half-width of a grid line). */
export function onRoad(x, y) {
  for (const rx of ROAD_X) if (Math.abs(x - rx) <= ROAD_HALF) return true;
  for (const ry of ROAD_Y) if (Math.abs(y - ry) <= ROAD_HALF) return true;
  return false;
}

/** The nearest road line (vertical or horizontal) to the point, and its axis. */
export function nearestRoad(x, y) {
  let best = null;
  for (const rx of ROAD_X) {
    const d = Math.abs(x - rx);
    if (!best || d < best.d) best = { axis: 'v', line: rx, d };
  }
  for (const ry of ROAD_Y) {
    const d = Math.abs(y - ry);
    if (!best || d < best.d) best = { axis: 'h', line: ry, d };
  }
  return best;
}

/** True when a circle of radius r at (x, y) touches any building. */
export function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

/**
 * Push a circle out of any building it overlaps, and clamp it inside the world (the sea
 * blocks the south edge, the map edge blocks the rest). Returns the building hit, if any.
 */
export function resolveBuildingCollision(city, body, r) {
  let hit = null;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(body.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(body.y, b.y + b.h));
    const dx = body.x - cx;
    const dy = body.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    hit = b;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      body.x = cx + (dx / d) * r;
      body.y = cy + (dy / d) * r;
    } else {
      // Centre inside the building: push out along the smallest overlap.
      const left = body.x - b.x + r;
      const right = b.x + b.w - body.x + r;
      const top = body.y - b.y + r;
      const bottom = b.y + b.h - body.y + r;
      const min = Math.min(left, right, top, bottom);
      if (min === left) body.x = b.x - r;
      else if (min === right) body.x = b.x + b.w + r;
      else if (min === top) body.y = b.y - r;
      else body.y = b.y + b.h + r;
    }
  }
  body.x = Math.max(r, Math.min(WORLD.width - r, body.x));
  body.y = Math.max(r, Math.min(BEACH.waterTop - r, body.y));
  return hit;
}

/** Traffic-light state at an intersection: 'green' lets north-south go, 'red' stops it. */
export function lightState(light, time) {
  const cycle = (time / 6 + light.phase) % 2;
  return cycle < 1 ? 'green' : 'red';
}

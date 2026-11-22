// Neon Bay Nights — city generation: blocks, roads, buildings, signs, pickups, parked cars.

import { WORLD, COLORS, mulberry } from './config.js';

const SIGN_WORDS = ['NEON', 'BAY', 'HOTEL', 'CAFE', 'PIER', 'CLUB', 'MOTEL', 'ARCADE',
  'MARINA', 'DINER', 'TATTOO', 'RADIO', 'SURF', 'BAR', 'GYM', 'LOANS'];

export function buildCity(seed = 1) {
  const rnd = mulberry(seed * 7919 + 13);
  const buildings = [];
  const signs = [];
  const trees = [];
  const pickups = [];
  const parked = [];
  const { w, h, block, road } = WORLD;

  for (let bx = 0; bx < w / block; bx++) {
    for (let by = 0; by < h / block; by++) {
      const x0 = bx * block + road / 2 + 6;
      const y0 = by * block + road / 2 + 6;
      const bw = block - road - 12;
      const bh = block - road - 12;
      const roll = rnd();
      if (y0 > 1950) continue; // beachfront strip stays open sand
      if (roll < 0.12) {
        // park block: trees only
        for (let i = 0; i < 5; i++) {
          trees.push({ x: x0 + rnd() * bw, y: y0 + rnd() * bh, r: 10 + rnd() * 8 });
        }
        continue;
      }
      const cols = 2 + Math.floor(rnd() * 2);
      const rows = 2 + Math.floor(rnd() * 2);
      for (let cx = 0; cx < cols; cx++) {
        for (let cy = 0; cy < rows; cy++) {
          if (rnd() < 0.15) continue;
          const bwid = bw / cols - 8;
          const bhei = bh / rows - 8;
          const b = {
            x: x0 + cx * (bw / cols) + 4,
            y: y0 + cy * (bh / rows) + 4,
            w: bwid, h: bhei,
            color: COLORS.building[Math.floor(rnd() * COLORS.building.length)],
            floors: 2 + Math.floor(rnd() * 6),
          };
          buildings.push(b);
          if (rnd() < 0.4) {
            signs.push({
              x: b.x + b.w / 2, y: b.y + 14,
              text: SIGN_WORDS[Math.floor(rnd() * SIGN_WORDS.length)],
              color: COLORS.neon[Math.floor(rnd() * COLORS.neon.length)],
            });
          }
        }
      }
    }
  }

  // Weapon pickups on street corners.
  const spots = [[500, 500], [1900, 600], [2750, 1400], [700, 2100], [2300, 700],
    [600, 400], [1600, 2050], [2900, 1800], [400, 800], [2100, 400]];
  const kinds = ['pistol', 'smg', 'shotgun'];
  spots.forEach(([x, y], i) => {
    pickups.push({ x, y, kind: kinds[i % 3], ammo: kinds[i % 3] === 'smg' ? 120 : kinds[i % 3] === 'shotgun' ? 24 : 48, taken: false });
  });
  for (let i = 0; i < 6; i++) {
    pickups.push({ x: 300 + rnd() * (w - 600), y: 300 + rnd() * (h - 700), kind: 'health', ammo: 40, taken: false });
  }

  // Parked cars along kerbs.
  for (let i = 0; i < 26; i++) {
    const vertical = rnd() < 0.5;
    const lane = Math.floor(rnd() * (vertical ? w / block : h / block)) * block;
    const along = 120 + rnd() * ((vertical ? h : w) - 240);
    parked.push({
      x: vertical ? lane + 14 : along,
      y: vertical ? along : lane + 14,
      angle: vertical ? Math.PI / 2 : 0,
      color: COLORS.neon[Math.floor(rnd() * COLORS.neon.length)],
    });
  }

  return { buildings, signs, trees, pickups, parked };
}

export function isRoad(x, y) {
  const { block, road, h } = WORLD;
  if (y > h - 180) return false; // sea
  const mx = ((x % block) + block) % block;
  const my = ((y % block) + block) % block;
  return mx < road / 2 + 14 || mx > block - road / 2 - 14 || my < road / 2 + 14 || my > block - road / 2 - 14;
}

export function nearestStreetPoint(x, y) {
  const { block } = WORLD;
  const gx = Math.round(x / block) * block;
  const gy = Math.round(y / block) * block;
  const cands = [[gx, y], [x, gy], [gx, gy]];
  cands.sort((a, b) => Math.hypot(a[0] - x, a[1] - y) - Math.hypot(b[0] - x, b[1] - y));
  return { x: cands[0][0], y: cands[0][1] };
}

export function collidesBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

export function trafficLightPhase(t) {
  const cycle = (t % 12);
  return cycle < 5 ? 'ns' : cycle < 6 ? 'warn' : 'ew';
}

// Neon Bay Nights — city generation: street grid, buildings, street helpers.
import { CFG } from './config.js';

export function buildCity(rng) {
  const size = CFG.worldSize;
  const block = CFG.block;
  const street = CFG.street;
  const buildings = [];
  const parks = [];
  const signs = [];
  const names = ['NOODLE', 'HOTEL', 'BAR', 'PAWN', 'DINER', 'GYM', 'CLUB', 'MART', 'TAXI', 'RADIO', 'PIZZA', 'MOTEL'];
  for (let by = 0; by < size / block; by++) {
    for (let bx = 0; bx < size / block; bx++) {
      const ox = bx * block + street / 2;
      const oy = by * block + street / 2;
      const inner = block - street;
      if (rng.chance(0.1)) {
        parks.push({ x: ox, y: oy, w: inner, h: inner });
        continue;
      }
      const cols = rng.int(1, 2);
      const rows = rng.int(1, 2);
      const cw = inner / cols;
      const ch = inner / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const pad = 10;
          const b = {
            x: ox + c * cw + pad,
            y: oy + r * ch + pad,
            w: cw - pad * 2,
            h: ch - pad * 2,
            hue: rng.int(0, 5),
            tall: rng.range(0.3, 1),
          };
          buildings.push(b);
          if (rng.chance(0.55)) {
            signs.push({
              x: b.x + b.w / 2,
              y: b.y + 14,
              text: rng.pick(names),
              color: rng.pick(CFG.colors.neon),
            });
          }
        }
      }
    }
  }
  // Garage sits on a street intersection near the south-west, always car-reachable.
  const garage = { x: block * 2, y: size - block * 2 };
  CFG.garage.x = garage.x;
  CFG.garage.y = garage.y;
  return { size, block, street, buildings, parks, signs, garage };
}

export function isStreet(city, x, y) {
  const m = city.block;
  const s = city.street;
  const mx = ((x % m) + m) % m;
  const my = ((y % m) + m) % m;
  const onV = mx < s / 2 || mx > m - s / 2;
  const onH = my < s / 2 || my > m - s / 2;
  return onV || onH;
}

// Snap any point to the nearest street centerline (mission targets live on streets).
export function snapToStreet(city, x, y) {
  const m = city.block;
  const cx = Math.round(x / m) * m;
  const cy = Math.round(y / m) * m;
  const dx = Math.abs(x - cx);
  const dy = Math.abs(y - cy);
  let sx = x;
  let sy = y;
  if (dx < dy) sx = cx; else sy = cy;
  sx = Math.max(40, Math.min(city.size - 40, sx));
  sy = Math.max(40, Math.min(city.size - 40, sy));
  // Nudge off building interiors just in case.
  for (const b of city.buildings) {
    if (sx > b.x - 20 && sx < b.x + b.w + 20 && sy > b.y - 20 && sy < b.y + b.h + 20) {
      sx = b.x - 30;
    }
  }
  return { x: sx, y: sy };
}

export function randomStreetPoint(city, rng, near, minD, maxD) {
  for (let i = 0; i < 40; i++) {
    const gx = rng.int(0, city.size / city.block) * city.block;
    const gy = rng.int(0, city.size / city.block) * city.block;
    const p = rng.chance(0.5)
      ? { x: gx, y: rng.range(60, city.size - 60) }
      : { x: rng.range(60, city.size - 60), y: gy };
    if (!near) return p;
    const d = Math.hypot(p.x - near.x, p.y - near.y);
    if (d >= (minD || 0) && d <= (maxD || 1e9)) return p;
  }
  return snapToStreet(city, rng.range(100, city.size - 100), rng.range(100, city.size - 100));
}

export function streetDirectionAt(city, x, y) {
  const m = city.block;
  const s = city.street;
  const mx = ((x % m) + m) % m;
  const my = ((y % m) + m) % m;
  const onV = mx < s / 2 || mx > m - s / 2;
  const onH = my < s / 2 || my > m - s / 2;
  if (onV && onH) return 'cross';
  if (onV) return 'v';
  if (onH) return 'h';
  return 'block';
}

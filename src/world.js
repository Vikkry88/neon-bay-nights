// World entities: traffic, pedestrians, parked cars, particles.
import { WORLD_W, WORLD_H, ROAD_W, TRAFFIC_COLORS } from './config.js';

let nextId = 1;
export function makeCar(x, y, angle, color, opts) {
  const o = opts || {};
  return {
    id: nextId++, x, y, angle: angle || 0, speed: 0,
    color: color || '#94a3b8', police: !!o.police, traffic: !!o.traffic,
    parked: !!o.parked, dead: false, hp: o.police ? 120 : 80,
    stuckTime: 0, backoffUntil: 0, ramReadyAt: 0, lane: o.lane || 0,
    dirX: o.dirX || 1, dirY: o.dirY || 0, sirenPhase: Math.random() * 6.28,
  };
}

export function spawnTraffic(city, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const horiz = rng.chance(0.5);
    let x, y, angle, dirX = 0, dirY = 0, lane = rng.chance(0.5) ? -26 : 26;
    if (horiz) {
      const cy = rng.pick(city.ys);
      x = rng.range(80, WORLD_W - 80); y = cy + lane;
      dirX = lane < 0 ? 1 : -1; angle = dirX > 0 ? 0 : Math.PI;
    } else {
      const cx = rng.pick(city.xs);
      y = rng.range(80, WORLD_H - 340); x = cx + lane;
      dirY = lane < 0 ? 1 : -1; angle = dirY > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    const c = makeCar(x, y, angle, rng.pick(TRAFFIC_COLORS), { traffic: true, lane, dirX, dirY });
    c.speed = rng.range(60, 110);
    cars.push(c);
  }
  return cars;
}

export function spawnParked(city, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const horiz = rng.chance(0.5);
    let x, y, angle;
    if (horiz) { const cy = rng.pick(city.ys); x = rng.range(120, WORLD_W - 120); y = cy + (rng.chance(0.5) ? -42 : 42); angle = rng.chance(0.5) ? 0 : Math.PI; }
    else { const cx = rng.pick(city.xs); y = rng.range(120, WORLD_H - 380); x = cx + (rng.chance(0.5) ? -42 : 42); angle = rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2; }
    cars.push(makeCar(x, y, angle, rng.pick(TRAFFIC_COLORS), { parked: true }));
  }
  return cars;
}

export function spawnPeds(city, rng, count) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const cx = rng.pick(city.xs), cy = rng.pick(city.ys);
    peds.push({
      id: nextId++, x: cx + rng.range(-70, 70), y: cy + rng.range(-70, 70),
      angle: rng.range(0, 6.28), speed: rng.range(28, 52), hp: 30, dead: false,
      color: rng.pick(['#fbbf24', '#38bdf8', '#f472b6', '#a3e635', '#f8fafc']),
      wanderAt: 0, panic: 0,
    });
  }
  return peds;
}

export function addParticles(list, x, y, n, color, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.28, s = (speed || 120) * (0.3 + Math.random() * 0.7);
    list.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.5, max: 1, color });
  }
}

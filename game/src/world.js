// Living world entities: traffic cars that drive the grid (jam-proof via a
// stuck timer that teleports them ahead), pedestrians on sidewalks, parked
// cars to steal, and weapon/health pickups with beacons.

import { WORLD, BEACH_X, TUNING } from './config.js';
import { makeRng, rngRange, rngPick } from './random.js';
import { nearestRoadPoint } from './city.js';

const CAR_COLORS = ['#e63946', '#f1fa8c', '#2a9d8f', '#e9c46a', '#f4a261', '#a8dadc', '#ffffff', '#ff70a6', '#70d6ff', '#ffd670'];
const PED_COLORS = ['#ffd6a5', '#caffbf', '#9bf6ff', '#ffc6ff', '#fdffb6', '#bdb2ff'];

export function makeCar(x, y, angle, color, kind) {
  return {
    x, y, angle,
    vx: 0, vy: 0,
    speed: 0,
    color,
    kind,               // 'traffic' | 'parked' | 'police' | 'player'
    health: 100,
    stuckTime: 0,
    lane: 1,            // traffic lane offset sign
    dirX: Math.cos(angle),
    dirY: Math.sin(angle),
    turnCooldown: 0,
    ramCooldown: 0,
    backoff: 0,
    sirenPhase: 0,
    w: 44, h: 22,
  };
}

export function spawnTraffic(city, seed) {
  const rng = makeRng(seed * 31 + 7);
  const cars = [];
  const points = city.streetPoints;
  for (let i = 0; i < TUNING.trafficCount; i += 1) {
    const p = rngPick(rng, points);
    const horizontal = rng() < 0.5;
    const angle = horizontal ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    const laneOff = 22;
    const x = p.x + Math.cos(angle + Math.PI / 2) * laneOff * (angle === 0 || angle === Math.PI / 2 ? 1 : -1);
    const y = p.y + Math.sin(angle + Math.PI / 2) * laneOff * (angle === 0 || angle === Math.PI / 2 ? 1 : -1);
    const car = makeCar(x, y, angle, rngPick(rng, CAR_COLORS), 'traffic');
    car.speed = rngRange(rng, 90, 150);
    car.cruise = car.speed;
    cars.push(car);
  }
  return cars;
}

export function spawnParked(city, seed) {
  const rng = makeRng(seed * 57 + 3);
  const cars = [];
  const points = city.streetPoints;
  for (let i = 0; i < TUNING.parkedCount; i += 1) {
    const p = rngPick(rng, points);
    const horizontal = rng() < 0.5;
    const angle = horizontal ? 0 : Math.PI / 2;
    const x = p.x + rngRange(rng, -30, 30);
    const y = p.y + (horizontal ? 34 : rngRange(rng, -30, 30));
    cars.push(makeCar(x, y, angle, rngPick(rng, CAR_COLORS), 'parked'));
  }
  return cars;
}

export function spawnPeds(city, seed) {
  const rng = makeRng(seed * 91 + 5);
  const peds = [];
  const points = city.streetPoints;
  for (let i = 0; i < TUNING.pedCount; i += 1) {
    const p = rngPick(rng, points);
    peds.push({
      x: p.x + rngRange(rng, -46, 46),
      y: p.y + rngRange(rng, -46, 46),
      angle: rngRange(rng, 0, Math.PI * 2),
      speed: rngRange(rng, 28, 52),
      color: rngPick(rng, PED_COLORS),
      walkPhase: rngRange(rng, 0, 6),
      panic: 0,
      health: 30,
    });
  }
  return peds;
}

export function spawnPickups(city, seed) {
  const rng = makeRng(seed * 17 + 11);
  const points = city.streetPoints;
  const pickups = [];
  const kinds = ['pistol', 'smg', 'shotgun', 'health', 'armor', 'pistol', 'smg', 'health'];
  for (let i = 0; i < kinds.length; i += 1) {
    const p = points[(i * 7 + 3) % points.length];
    pickups.push({
      x: p.x + rngRange(rng, -20, 20),
      y: p.y + rngRange(rng, -20, 20),
      kind: kinds[i],
      taken: false,
      respawn: 0,
      bob: rngRange(rng, 0, 6),
    });
  }
  return pickups;
}

// Traffic AI: follow the current road direction, turn at intersections, and if
// a car is stuck for >2.5s (jam, crash, blocked), teleport it ahead along its
// road so traffic can never gridlock.
export function updateTrafficCar(car, dt, city, others, playerPos) {
  const m = WORLD.block;
  const r = WORLD.road;
  car.turnCooldown = Math.max(0, car.turnCooldown - dt);

  const lx = ((car.x % m) + m) % m;
  const ly = ((car.y % m) + m) % m;
  const inIntersection = lx < r && ly < r;
  if (inIntersection && car.turnCooldown <= 0) {
    car.turnCooldown = 1.2;
    // Choose a new heading along a road axis.
    const choices = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
    const current = Math.round(car.angle / (Math.PI / 2)) * (Math.PI / 2);
    const next = choices[Math.floor(Math.random() * choices.length)];
    if (Math.abs(((next - current) % (Math.PI * 2))) > 0.1) car.angle = next;
  }

  // Slow down if another car or the player is right ahead.
  const aheadX = car.x + Math.cos(car.angle) * 54;
  const aheadY = car.y + Math.sin(car.angle) * 54;
  let blocked = false;
  for (const other of others) {
    if (other === car) continue;
    if (Math.hypot(other.x - aheadX, other.y - aheadY) < 34) { blocked = true; break; }
  }
  if (!blocked && playerPos && Math.hypot(playerPos.x - aheadX, playerPos.y - aheadY) < 30) blocked = true;

  const target = blocked ? 0 : (car.cruise || 120);
  car.speed += (target - car.speed) * Math.min(1, dt * 2.2);
  const prevX = car.x;
  const prevY = car.y;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;

  // Keep traffic on roads: if it drifted off, snap back to the nearest road point.
  const moved = Math.hypot(car.x - prevX, car.y - prevY);
  if (car.speed > 20 && moved < car.speed * dt * 0.4) car.stuckTime += dt;
  else if (blocked) car.stuckTime += dt * 0.6;
  else car.stuckTime = Math.max(0, car.stuckTime - dt);

  if (car.stuckTime > 2.5) {
    const ahead = nearestRoadPoint(car.x + Math.cos(car.angle) * 260, car.y + Math.sin(car.angle) * 260);
    car.x = ahead.x;
    car.y = ahead.y;
    car.stuckTime = 0;
    car.speed = car.cruise || 120;
  }

  // Wrap around the city edges (never into the sea).
  if (car.x < 20) car.x = BEACH_X - 80;
  if (car.x > BEACH_X - 40) car.x = 60;
  if (car.y < 20) car.y = WORLD.height - 60;
  if (car.y > WORLD.height - 20) car.y = 60;
}

export function updatePed(ped, dt, playerPos, gunfire) {
  ped.walkPhase += dt * 6;
  ped.panic = Math.max(0, ped.panic - dt);
  if (gunfire && Math.hypot(ped.x - playerPos.x, ped.y - playerPos.y) < 240) ped.panic = 2;
  if (ped.panic > 0) {
    ped.angle = Math.atan2(ped.y - playerPos.y, ped.x - playerPos.x);
  } else if (Math.random() < dt * 0.25) {
    ped.angle += (Math.random() - 0.5) * 1.6;
  }
  const speed = ped.panic > 0 ? ped.speed * 2.4 : ped.speed;
  ped.x += Math.cos(ped.angle) * speed * dt;
  ped.y += Math.sin(ped.angle) * speed * dt;
  if (ped.x < 16 || ped.x > BEACH_X - 20) ped.angle = Math.PI - ped.angle;
  if (ped.y < 16 || ped.y > WORLD.height - 16) ped.angle = -ped.angle;
  ped.x = Math.min(Math.max(ped.x, 14), BEACH_X - 14);
  ped.y = Math.min(Math.max(ped.y, 14), WORLD.height - 14);
}

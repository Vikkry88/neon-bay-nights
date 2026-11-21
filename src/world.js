// Neon Bay Nights — world entities: cars, traffic, pedestrians, police, pickups.
// Key safety rules baked in here:
//  - Police keep a 72px minimum standoff and never pin the player.
//  - Traffic never jams forever: stuck cars despawn and respawn elsewhere.
//  - The player always spawns on a clear street, away from traffic and police.
import { CFG } from './config.js';
import { randomStreetPoint, snapToStreet } from './city.js';

let nextId = 1;

function makeCar(rng, x, y, angle, opts) {
  const o = opts || {};
  return {
    id: nextId++,
    x, y, angle,
    speed: 0,
    hp: 100,
    dead: false,
    police: !!o.police,
    traffic: !!o.traffic,
    driver: null,
    color: o.police ? '#101018' : rng.pick(CFG.colors.car),
    targetSpeed: o.traffic ? CFG.trafficSpeed * rng.range(0.7, 1.15) : 0,
    stuckT: 0,
    lastX: x, lastY: y,
    turnCooldown: 0,
    backoffT: 0,
  };
}

export function createWorld(city, rng, state) {
  const cars = [];
  // Parked cars along streets (stealable).
  for (let i = 0; i < 26; i++) {
    const p = randomStreetPoint(city, rng);
    const vertical = Math.abs(p.x % city.block) < 2;
    cars.push(makeCar(rng, p.x + rng.range(-18, 18), p.y + rng.range(-18, 18), vertical ? Math.PI / 2 : 0, {}));
  }
  // Moving traffic.
  for (let i = 0; i < 18; i++) {
    const p = randomStreetPoint(city, rng);
    const vertical = Math.abs(p.x % city.block) < 2;
    const c = makeCar(rng, p.x, p.y, vertical ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI), { traffic: true });
    c.speed = c.targetSpeed;
    cars.push(c);
  }
  const peds = [];
  for (let i = 0; i < 30; i++) {
    const p = randomStreetPoint(city, rng);
    peds.push({
      id: nextId++, x: p.x + rng.range(-30, 30), y: p.y + rng.range(-30, 30),
      angle: rng.range(0, Math.PI * 2), speed: rng.range(45, 85),
      alive: true, downT: 0, color: rng.pick(['#ffd54f', '#4fc3f7', '#aed581', '#f48fb1', '#b39ddb', '#ffab91']),
      wanderT: rng.range(1, 4), fleeT: 0,
    });
  }
  const pickups = [];
  const pistolSpot = randomStreetPoint(city, rng, city.garage, 260, 700);
  pickups.push({ kind: 'pistol', x: pistolSpot.x, y: pistolSpot.y, taken: false, pulse: 0 });
  for (let i = 0; i < 8; i++) {
    const p = randomStreetPoint(city, rng);
    pickups.push({ kind: 'cash', x: p.x, y: p.y, taken: false, pulse: rng.range(0, 6) });
  }
  for (let i = 0; i < 4; i++) {
    const p = randomStreetPoint(city, rng);
    pickups.push({ kind: 'health', x: p.x, y: p.y, taken: false, pulse: rng.range(0, 6) });
  }
  return { cars, peds, pickups, policeTimer: 0 };
}

export function spawnSafe(state, city, rng) {
  // Safe spawn: garage street, shifted until clear of cars/police by 180px.
  let spot = { x: city.garage.x, y: city.garage.y };
  for (let i = 0; i < 24; i++) {
    const blocked = state.world.cars.some((c) => Math.hypot(c.x - spot.x, c.y - spot.y) < 180);
    if (!blocked) break;
    spot = { x: spot.x + 90, y: spot.y };
    if (spot.x > city.size - 80) spot = { x: 120, y: Math.max(120, spot.y - 320) };
    spot = snapToStreet(city, spot.x, spot.y);
  }
  state.player.x = spot.x;
  state.player.y = spot.y;
  state.player.angle = 0;
  state.player.speed = 0;
  return spot;
}

function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, t);
}

export function updateTraffic(state, city, rng, dt) {
  const m = city.block;
  for (const car of state.world.cars) {
    if (!car.traffic || car.dead || car.driver) continue;
    car.turnCooldown -= dt;
    // Drive along current heading; at intersections sometimes turn.
    const nearCrossX = Math.abs(car.x - Math.round(car.x / m) * m) < 26;
    const nearCrossY = Math.abs(car.y - Math.round(car.y / m) * m) < 26;
    if (nearCrossX && nearCrossY && car.turnCooldown <= 0) {
      car.turnCooldown = 1.2;
      if (rng.chance(0.45)) {
        const options = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
        car.angle = rng.pick(options);
      }
    }
    // Keep lane: drift toward street centerline.
    const vertical = Math.abs(Math.sin(car.angle)) > 0.7;
    if (vertical) {
      const cx = Math.round(car.x / m) * m;
      car.x += (cx - car.x) * Math.min(1, dt * 1.4);
    } else {
      const cy = Math.round(car.y / m) * m;
      car.y += (cy - car.y) * Math.min(1, dt * 1.4);
    }
    // Slow for cars ahead.
    let blocked = false;
    for (const other of state.world.cars) {
      if (other === car) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const side = Math.abs(dx * -Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (ahead > 0 && ahead < 58 && side < 20) { blocked = true; break; }
    }
    const pp = state.player.inCar || state.player;
    const pdx = pp.x - car.x;
    const pdy = pp.y - car.y;
    const pAhead = pdx * Math.cos(car.angle) + pdy * Math.sin(car.angle);
    if (pAhead > 0 && pAhead < 58 && Math.abs(pdx * -Math.sin(car.angle) + pdy * Math.cos(car.angle)) < 20) blocked = true;
    const want = blocked ? 0 : car.targetSpeed;
    car.speed += (want - car.speed) * Math.min(1, dt * 2.2);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // World edge: turn around.
    if (car.x < 50 || car.x > city.size - 50 || car.y < 50 || car.y > city.size - 50) {
      car.angle += Math.PI;
      car.x = Math.max(50, Math.min(city.size - 50, car.x));
      car.y = Math.max(50, Math.min(city.size - 50, car.y));
    }
    // Jam-proof: if barely moved for 3.5s, respawn on a far street.
    const moved = Math.hypot(car.x - car.lastX, car.y - car.lastY);
    if (moved < 6) car.stuckT += dt; else { car.stuckT = 0; car.lastX = car.x; car.lastY = car.y; }
    if (car.stuckT > 3.5) {
      const p = randomStreetPoint(city, rng, pp, 600, 2400);
      car.x = p.x; car.y = p.y;
      car.stuckT = 0; car.lastX = p.x; car.lastY = p.y;
      car.speed = car.targetSpeed;
    }
  }
}

export function updatePeds(state, city, rng, dt) {
  const pp = state.player.inCar || state.player;
  const gunfire = state.tracers.length > 0;
  for (const ped of state.world.peds) {
    if (!ped.alive) {
      ped.downT -= dt;
      if (ped.downT <= 0) {
        const p = randomStreetPoint(city, rng, pp, 500, 2000);
        ped.x = p.x; ped.y = p.y; ped.alive = true;
      }
      continue;
    }
    const d = Math.hypot(ped.x - pp.x, ped.y - pp.y);
    if ((gunfire && d < 300) || (state.player.inCar && d < 90 && Math.abs(state.player.inCar.speed) > 120)) ped.fleeT = 2.5;
    ped.wanderT -= dt;
    if (ped.fleeT > 0) {
      ped.fleeT -= dt;
      ped.angle = Math.atan2(ped.y - pp.y, ped.x - pp.x);
      ped.x += Math.cos(ped.angle) * ped.speed * 2.1 * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * 2.1 * dt;
    } else {
      if (ped.wanderT <= 0) { ped.wanderT = rng.range(1.5, 4.5); ped.angle = rng.range(0, Math.PI * 2); }
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
    }
    // Stay out of buildings (simple push to street edge).
    for (const b of city.buildings) {
      if (ped.x > b.x - 8 && ped.x < b.x + b.w + 8 && ped.y > b.y - 8 && ped.y < b.y + b.h + 8) {
        ped.x = b.x - 10;
        ped.angle += Math.PI / 2;
      }
    }
    ped.x = Math.max(16, Math.min(city.size - 16, ped.x));
    ped.y = Math.max(16, Math.min(city.size - 16, ped.y));
  }
}

export function updatePolice(state, city, rng, dt) {
  const pp = state.player.inCar || state.player;
  const wanted = state.wanted;
  const police = state.world.cars.filter((c) => c.police && !c.dead);
  // Spawn / despawn to match wanted level.
  state.world.policeTimer -= dt;
  if (wanted > 0 && police.length < wanted + 1 && state.world.policeTimer <= 0) {
    state.world.policeTimer = 2.5;
    const p = randomStreetPoint(city, rng, pp, 420, 700);
    const c = makeCar(rng, p.x, p.y, Math.atan2(pp.y - p.y, pp.x - p.x), { police: true });
    c.speed = 200;
    state.world.cars.push(c);
  }
  if (wanted === 0) {
    for (const c of police) c.dead = true;
    state.world.cars = state.world.cars.filter((c) => !c.police || !c.dead);
    return;
  }
  const playerSpeed = state.player.inCar ? Math.abs(state.player.inCar.speed) : 0;
  for (const car of police) {
    const dx = pp.x - car.x;
    const dy = pp.y - car.y;
    const dist = Math.hypot(dx, dy) || 1;
    // Corner-pocket escape: if the player is slow and boxed near a building,
    // police back off for a while so the player can always drive away.
    const nearBuilding = city.buildings.some((b) => pp.x > b.x - 70 && pp.x < b.x + b.w + 70 && pp.y > b.y - 70 && pp.y < b.y + b.h + 70);
    if (playerSpeed < 55 && dist < 150 && nearBuilding && car.backoffT <= 0) car.backoffT = 2.4;
    if (car.backoffT > 0) car.backoffT -= dt;

    let wantAngle;
    let wantSpeed;
    if (car.backoffT > 0) {
      // Back away to at least 160px.
      wantAngle = Math.atan2(-dy, -dx);
      wantSpeed = dist < 160 ? 190 : 0;
      car.angle = angleLerp(car.angle, wantAngle, dt * 2.4);
      car.speed += (wantSpeed - car.speed) * Math.min(1, dt * 3);
    } else if (dist < CFG.policeStandoff) {
      // 72px minimum standoff: push straight out, never pin.
      car.x -= (dx / dist) * (CFG.policeStandoff - dist + 2);
      car.y -= (dy / dist) * (CFG.policeStandoff - dist + 2);
      car.speed = Math.min(car.speed, 0);
      wantAngle = Math.atan2(dy, dx);
      car.angle = angleLerp(car.angle, wantAngle, dt * 2.2);
    } else {
      wantAngle = Math.atan2(dy, dx);
      car.angle = angleLerp(car.angle, wantAngle, dt * (dist < 200 ? 2.6 : 1.8));
      // Brake as they close in so they shadow, not ram.
      if (dist < CFG.policeBrakeDist) wantSpeed = Math.max(0, playerSpeed * 0.85);
      else wantSpeed = CFG.policeSpeed * (0.75 + wanted * 0.07);
      car.speed += (wantSpeed - car.speed) * Math.min(1, dt * 2.4);
    }
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.x = Math.max(24, Math.min(city.size - 24, car.x));
    car.y = Math.max(24, Math.min(city.size - 24, car.y));
    // Hard guarantee after movement: never closer than the standoff.
    const ndx = pp.x - car.x;
    const ndy = pp.y - car.y;
    const nd = Math.hypot(ndx, ndy) || 1;
    if (nd < CFG.policeStandoff) {
      car.x -= (ndx / nd) * (CFG.policeStandoff - nd);
      car.y -= (ndy / nd) * (CFG.policeStandoff - nd);
    }
    // Busted pressure: only on foot, slow, and close — never while driving away.
    if (!state.player.inCar && dist < 90 && wanted > 0) {
      state.health -= dt * 7;
    }
  }
  // Remove far, dead police to keep the list small.
  state.world.cars = state.world.cars.filter((c) => !(c.police && c.dead && Math.hypot(c.x - pp.x, c.y - pp.y) > 900));
}

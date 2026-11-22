// vehicles.js — car models, living traffic, parked cars and arcade driving.
// Driving works at crawl speed: steering always answers, even at 2 km/h.
import * as THREE from 'three';
import { WORLD, collideCircle } from './world.js';

export const CAR_SPECS = [
  { name: 'Sunset Sedan', color: 0xe85a5a, top: 36, accel: 16 },
  { name: 'Bay Cruiser', color: 0x4f8fe8, top: 38, accel: 17 },
  { name: 'Palm GT', color: 0xf5c542, top: 46, accel: 22 },
  { name: 'Marina Hatch', color: 0x7ac74f, top: 34, accel: 15 },
  { name: 'Neon Coupe', color: 0xc95ae8, top: 44, accel: 21 },
  { name: 'Beach Buggy', color: 0xff9a3d, top: 32, accel: 15 },
  { name: 'Old Town Pickup', color: 0x9a7a5a, top: 33, accel: 14 },
  { name: 'Sol Convertible', color: 0xf2f2f2, top: 42, accel: 20 },
];

const glassMat = new THREE.MeshPhongMaterial({ color: 0x9fd4ff, shininess: 120, specular: 0xffffff });
const tyreMat = new THREE.MeshLambertMaterial({ color: 0x1c1c1c });
const hubMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });
const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
const tailMat = new THREE.MeshBasicMaterial({ color: 0xff4f4f });

export function makeCarMesh(spec, police) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: police ? 0xf4f6f8 : spec.color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.62, 4.2), bodyMat);
  body.position.y = 0.55; body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.55, 2.1), police ? bodyMat : glassMat);
  cabin.position.set(0, 1.08, -0.15); cabin.castShadow = true;
  group.add(cabin);
  if (police) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.3, 4.24),
      new THREE.MeshLambertMaterial({ color: 0x24406e }));
    stripe.position.y = 0.5;
    group.add(stripe);
    const bar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xff3333 }));
    red.position.x = -0.32;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 0.4),
      new THREE.MeshBasicMaterial({ color: 0x3366ff }));
    blue.position.x = 0.32;
    bar.add(red); bar.add(blue);
    bar.position.set(0, 1.48, -0.15);
    group.add(bar);
    group.userData.lightBar = { red, blue };
  }
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 10);
  group.userData.wheels = [];
  for (const [wx, wz] of [[-0.85, 1.35], [0.85, 1.35], [-0.85, -1.35], [0.85, -1.35]]) {
    const wheel = new THREE.Mesh(wheelGeo, tyreMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.34, wz);
    group.add(wheel);
    group.userData.wheels.push(wheel);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.26, 8), hubMat);
    hub.rotation.z = Math.PI / 2;
    hub.position.set(wx, 0.34, wz);
    group.add(hub);
  }
  for (const sx of [-0.6, 0.6]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.06), lightMat);
    head.position.set(sx, 0.62, 2.12);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.06), tailMat);
    tail.position.set(sx, 0.66, -2.12);
    group.add(tail);
  }
  return group;
}

function newCar(G, spec, x, z, heading, kind) {
  const mesh = makeCarMesh(spec, kind === 'police');
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  G.scene.add(mesh);
  const car = {
    id: G.nextCarId++, spec, kind, mesh,
    pos: new THREE.Vector3(x, 0, z), heading, speed: 0,
    condition: 100, hp: 100, driver: kind === 'traffic' ? 'ai' : null,
    axis: 'x', dir: 1, lane: 3.4, cruise: 11 + G.rng() * 5, stuck: 0,
    smoke: null, dead: false, tactic: '', flashT: G.rng() * 10,
  };
  G.cars.push(car);
  return car;
}

export function spawnTraffic(G, count) {
  for (let i = 0; i < count; i++) {
    const spec = CAR_SPECS[Math.floor(G.rng() * CAR_SPECS.length)];
    const vertical = G.rng() < 0.5;
    const car = newCar(G, spec, 0, 0, 0, 'traffic');
    placeOnRoad(G, car, vertical);
  }
}

export function placeOnRoad(G, car, vertical) {
  const dir = G.rng() < 0.5 ? 1 : -1;
  car.dir = dir;
  car.axis = vertical ? 'z' : 'x';
  const lane = dir > 0 ? 3.4 : -3.4;
  car.lane = lane;
  if (vertical) {
    const ax = WORLD.avenues[Math.floor(G.rng() * WORLD.avenues.length)];
    car.pos.set(ax + lane, 0, -225 + G.rng() * 450);
    car.heading = dir > 0 ? 0 : Math.PI;
  } else {
    const sz = WORLD.streets[Math.floor(G.rng() * WORLD.streets.length)];
    car.pos.set(-225 + G.rng() * 450, 0, sz - lane);
    car.heading = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  }
  car.speed = car.cruise;
  syncCarMesh(car);
}

export function spawnParked(G, count) {
  for (let i = 0; i < count; i++) {
    const spec = CAR_SPECS[Math.floor(G.rng() * CAR_SPECS.length)];
    const vertical = G.rng() < 0.5;
    let x, z, heading;
    if (vertical) {
      const ax = WORLD.avenues[Math.floor(G.rng() * WORLD.avenues.length)];
      x = ax + (G.rng() < 0.5 ? -6.2 : 6.2);
      z = -220 + G.rng() * 440;
      heading = G.rng() < 0.5 ? 0 : Math.PI;
    } else {
      const sz = WORLD.streets[Math.floor(G.rng() * WORLD.streets.length)];
      z = sz + (G.rng() < 0.5 ? -6.2 : 6.2);
      x = -220 + G.rng() * 440;
      heading = G.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    }
    if (Math.abs(x) > 200) x = 200;
    newCar(G, spec, x, z, heading, 'parked');
  }
}

export function spawnCarAt(G, specIndex, x, z, heading, kind) {
  return newCar(G, CAR_SPECS[specIndex % CAR_SPECS.length], x, z, heading, kind || 'parked');
}

export function syncCarMesh(car) {
  car.mesh.position.copy(car.pos);
  car.mesh.rotation.y = car.heading;
  for (const w of car.mesh.userData.wheels) w.rotation.x += car.speed * 0.12;
}

function trafficStep(G, car, dt) {
  // Slow for anything close ahead; teleport ahead if stuck too long.
  let blocked = false;
  for (const other of G.cars) {
    if (other === car) continue;
    const dx = other.pos.x - car.pos.x, dz = other.pos.z - car.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 9) {
      const fwdX = Math.sin(car.heading), fwdZ = Math.cos(car.heading);
      if (dx * fwdX + dz * fwdZ > 2) blocked = true;
    }
  }
  const p = G.player.pos;
  if (Math.hypot(p.x - car.pos.x, p.z - car.pos.z) < 7 && !G.player.car) blocked = true;
  const target = blocked ? 0 : car.cruise;
  car.speed += (target - car.speed) * Math.min(1, dt * 2.2);
  if (blocked && Math.abs(car.speed) < 0.4) {
    car.stuck += dt;
    if (car.stuck > 4) { placeOnRoad(G, car, G.rng() < 0.5); car.stuck = 0; return; }
  } else car.stuck = 0;

  const step = car.speed * dt * car.dir;
  if (car.axis === 'z') car.pos.z += step; else car.pos.x += step;

  // At intersections, sometimes turn onto the crossing road.
  const nearAvenue = WORLD.avenues.some((a) => Math.abs(a - car.pos.x) < 2.2);
  const nearStreet = WORLD.streets.some((s) => Math.abs(s - car.pos.z) < 2.2);
  if (nearAvenue && nearStreet && G.rng() < dt * 0.7) {
    const ax = WORLD.avenues.reduce((b, a) => (Math.abs(a - car.pos.x) < Math.abs(b - car.pos.x) ? a : b), WORLD.avenues[0]);
    const sz = WORLD.streets.reduce((b, s) => (Math.abs(s - car.pos.z) < Math.abs(b - car.pos.z) ? s : b), WORLD.streets[0]);
    if (car.axis === 'z') {
      car.axis = 'x'; car.dir = G.rng() < 0.5 ? 1 : -1;
      car.lane = car.dir > 0 ? 3.4 : -3.4;
      car.pos.z = sz - car.lane;
      car.heading = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      car.axis = 'z'; car.dir = G.rng() < 0.5 ? 1 : -1;
      car.lane = car.dir > 0 ? 3.4 : -3.4;
      car.pos.x = ax + car.lane;
      car.heading = car.dir > 0 ? 0 : Math.PI;
    }
  }
  if (Math.abs(car.pos.x) > 232 || Math.abs(car.pos.z) > 232) placeOnRoad(G, car, G.rng() < 0.5);
  syncCarMesh(car);
}

// Arcade driving for the player's car. Returns impact strength (0..1).
export function drivePlayerCar(G, car, dt, input) {
  const spec = car.spec;
  const topSpeed = spec.top * (car.condition < 25 ? 0.55 : 1);
  if (input.forward) car.speed += spec.accel * dt;
  if (input.back) car.speed -= (car.speed > 0.5 ? 26 : 9) * dt;
  if (!input.forward && !input.back) car.speed -= car.speed * 0.55 * dt;
  if (input.handbrake) car.speed -= car.speed * 2.4 * dt;
  car.speed = Math.max(-11, Math.min(topSpeed, car.speed));
  if (Math.abs(car.speed) < 0.12 && !input.forward && !input.back) car.speed = 0;

  const steerInput = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const speedFactor = Math.min(1, Math.abs(car.speed) / 9);
  const turnRate = (0.55 + speedFactor * 1.35) * (input.handbrake ? 1.5 : 1);
  const dirSign = car.speed < -0.2 ? -1 : 1;
  car.heading += steerInput * turnRate * dt * dirSign * (Math.abs(car.speed) > 0.05 ? 1 : 0);

  const before = car.pos.clone();
  car.pos.x += Math.sin(car.heading) * car.speed * dt;
  car.pos.z += Math.cos(car.heading) * car.speed * dt;
  const hitWall = collideCircle(G, car.pos, 2.1);
  let impact = 0;
  if (hitWall && Math.abs(car.speed) > 3) {
    impact = Math.min(1, Math.abs(car.speed) / 30);
    damageCar(G, car, Math.abs(car.speed) * 0.55);
    car.speed *= 0.35;
    G.audio.crash(impact > 0.4);
  }
  if (car.pos.distanceTo(before) < Math.abs(car.speed) * dt * 0.25 && Math.abs(car.speed) > 4) {
    car.speed *= 0.5;
  }
  // Car-to-car push-out: neither car can trap the other.
  for (const other of G.cars) {
    if (other === car) continue;
    const dx = car.pos.x - other.pos.x, dz = car.pos.z - other.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.01 && dist < 4.1) {
      const push = (4.1 - dist) / 2;
      const nx = dx / dist, nz = dz / dist;
      car.pos.x += nx * push; car.pos.z += nz * push;
      other.pos.x -= nx * push; other.pos.z -= nz * push;
      if (Math.abs(car.speed) > 5) {
        damageCar(G, car, 3); damageCar(G, other, 4);
        G.audio.crash(false);
        car.speed *= 0.8;
      }
      syncCarMesh(other);
    }
  }
  car.mesh.rotation.z = -steerInput * speedFactor * 0.06;
  syncCarMesh(car);
  return impact;
}

export function damageCar(G, car, amount) {
  car.condition = Math.max(0, car.condition - amount);
  car.hp = Math.max(0, car.hp - amount);
  if (car.condition < 45 && !car.smoke) {
    const mat = new THREE.SpriteMaterial({ color: 0x555555, transparent: true, opacity: 0.5, depthWrite: false });
    car.smoke = new THREE.Sprite(mat);
    car.smoke.scale.set(1.6, 1.6, 1);
    car.smoke.position.set(0, 1.2, 1.8);
    car.mesh.add(car.smoke);
  }
}

export function updateVehicles(G, dt) {
  for (const car of G.cars) {
    if (car.kind === 'traffic' && car !== G.player.car) trafficStep(G, car, dt);
    else if (car.kind === 'parked' && car !== G.player.car) syncCarMesh(car);
    if (car.smoke) {
      const s = 1.4 + Math.sin(G.time * 5 + car.id) * 0.35;
      car.smoke.scale.set(s, s, 1);
      car.smoke.material.opacity = car.condition < 15 ? 0.75 : 0.45;
      car.smoke.material.color.setHex(car.condition < 15 ? 0x333333 : 0x777777);
    }
  }
}

export function nearestCar(G, pos, maxDist) {
  let best = null, bestD = maxDist;
  for (const car of G.cars) {
    if (car.kind === 'police') continue;
    const d = Math.hypot(car.pos.x - pos.x, car.pos.z - pos.z);
    if (d < bestD) { best = car; bestD = d; }
  }
  return best;
}

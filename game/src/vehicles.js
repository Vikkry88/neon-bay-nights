// vehicles.js — car models, parked cars, lane traffic AI and driving.
// Cars are simple box models with cabin, wheels and lights. Traffic
// follows the road grid and teleports ahead if stuck, so streets never jam.
import * as THREE from 'three';
import { WORLD_SIZE, ROAD_STEP, ROAD_HALF, roadCoords } from './world.js';

export const CAR_MODELS = [
  { name: 'Sunset Sedan', color: 0xd94f4f, topSpeed: 46, accel: 15 },
  { name: 'Bay Cruiser', color: 0x3f7fd9, topSpeed: 50, accel: 16 },
  { name: 'Palm GT', color: 0xf2b134, topSpeed: 58, accel: 19 },
  { name: 'Marina Hatch', color: 0x54b06a, topSpeed: 42, accel: 14 },
  { name: 'Neon Coupe', color: 0x9b59d0, topSpeed: 56, accel: 18 },
  { name: 'Beach Buggy', color: 0x4dc4c4, topSpeed: 40, accel: 13 },
  { name: 'Old Town Pickup', color: 0x8a8f98, topSpeed: 44, accel: 14 },
  { name: 'Sol Convertible', color: 0xf27bb5, topSpeed: 54, accel: 17 },
];

const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 10);
const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.9 });
const glassMat = new THREE.MeshStandardMaterial({ color: 0x9fd4e8, roughness: 0.15, metalness: 0.4 });
const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
const tailMat = new THREE.MeshBasicMaterial({ color: 0xff3b30 });

export function makeCar(model, police = false) {
  const g = new THREE.Group();
  const bodyColor = police ? 0xf2f2f2 : model.color;
  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.35, metalness: 0.25 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.62, 4.3), bodyMat);
  body.position.y = 0.58;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.1), glassMat);
  cabin.position.set(0, 1.12, -0.15);
  cabin.castShadow = true;
  g.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.1, 1.9), bodyMat);
  roof.position.set(0, 1.43, -0.15);
  g.add(roof);
  if (police) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(1.94, 0.3, 4.32),
      new THREE.MeshStandardMaterial({ color: 0x1c3f8f, roughness: 0.4 }),
    );
    stripe.position.y = 0.52;
    g.add(stripe);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.4), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    bar.position.set(0, 1.58, -0.15);
    g.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.36), new THREE.MeshBasicMaterial({ color: 0xff2244 }));
    red.position.set(-0.3, 1.6, -0.15);
    red.name = 'lightbar-red';
    g.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.36), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    blue.position.set(0.3, 1.6, -0.15);
    blue.name = 'lightbar-blue';
    g.add(blue);
  }
  const wheels = [];
  for (const [wx, wz] of [[-0.85, 1.35], [0.85, 1.35], [-0.85, -1.35], [0.85, -1.35]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    wheel.castShadow = true;
    g.add(wheel);
    wheels.push(wheel);
  }
  for (const hx of [-0.6, 0.6]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.06), headMat);
    head.position.set(hx, 0.62, 2.16);
    g.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.06), tailMat);
    tail.position.set(hx, 0.64, -2.16);
    g.add(tail);
  }
  const bumper = new THREE.Mesh(
    new THREE.BoxGeometry(1.95, 0.22, 0.18),
    new THREE.MeshStandardMaterial({ color: 0x33373d, roughness: 0.5, metalness: 0.5 }),
  );
  bumper.position.set(0, 0.38, 2.2);
  g.add(bumper);
  const bumper2 = bumper.clone();
  bumper2.position.z = -2.2;
  g.add(bumper2);
  return { group: g, wheels, model, police, speed: 0, heading: 0, health: 100, stuckTime: 0, lastPos: new THREE.Vector3(), driver: null };
}

export function spawnTraffic(scene, count, rand) {
  const roads = roadCoords();
  const cars = [];
  for (let i = 0; i < count; i++) {
    const model = CAR_MODELS[Math.floor(rand() * CAR_MODELS.length)];
    const car = makeCar(model, false);
    const vertical = rand() > 0.5;
    const road = roads[Math.floor(rand() * roads.length)];
    const along = (rand() - 0.5) * (WORLD_SIZE - 60);
    const lane = (rand() > 0.5 ? 1 : -1) * (ROAD_HALF * 0.45);
    if (vertical) {
      car.group.position.set(road + lane, 0, along);
      car.heading = lane > 0 ? 0 : Math.PI;
      car.axis = 'z';
      car.road = road;
      car.lane = lane;
    } else {
      car.group.position.set(along, 0, road + lane);
      car.heading = lane > 0 ? Math.PI / 2 : -Math.PI / 2;
      car.axis = 'x';
      car.road = road;
      car.lane = lane;
    }
    car.group.rotation.y = car.heading;
    car.cruise = 9 + rand() * 6;
    car.lastPos.copy(car.group.position);
    scene.add(car.group);
    cars.push(car);
  }
  return cars;
}

export function spawnParked(scene, count, rand) {
  const roads = roadCoords();
  const cars = [];
  for (let i = 0; i < count; i++) {
    const model = CAR_MODELS[Math.floor(rand() * CAR_MODELS.length)];
    const car = makeCar(model, false);
    const vertical = rand() > 0.5;
    const road = roads[Math.floor(rand() * roads.length)];
    const along = (rand() - 0.5) * (WORLD_SIZE - 80);
    const side = (rand() > 0.5 ? 1 : -1) * (ROAD_HALF + 2.2);
    if (vertical) {
      car.group.position.set(road + side, 0, along);
      car.heading = side > 0 ? 0 : Math.PI;
    } else {
      car.group.position.set(along, 0, road + side);
      car.heading = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    car.group.rotation.y = car.heading;
    car.parked = true;
    car.lastPos.copy(car.group.position);
    scene.add(car.group);
    cars.push(car);
  }
  return cars;
}

// Traffic AI: drive along the current road, turn at intersections,
// teleport ahead when stuck so a jam can never lock the city.
export function updateTraffic(car, dt, rand, obstacles) {
  if (car.parked || car.playerDriven) return;
  const pos = car.group.position;
  const speed = car.cruise || 11;
  // slow for a car or player directly ahead
  let targetSpeed = speed;
  for (const o of obstacles) {
    const dx = o.x - pos.x;
    const dz = o.z - pos.z;
    const ahead = dx * Math.sin(car.heading) + dz * Math.cos(car.heading);
    const side = Math.abs(dx * Math.cos(car.heading) - dz * Math.sin(car.heading));
    if (ahead > 0 && ahead < 9 && side < 2.2) targetSpeed = Math.min(targetSpeed, 2.5);
  }
  car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 2.2);
  const step = car.speed * dt;
  if (car.axis === 'z') {
    pos.z += Math.cos(car.heading) * step;
    pos.x += (car.road + car.lane - pos.x) * Math.min(1, dt * 3);
    // turn at intersections sometimes
    const roads = roadCoords();
    for (const r of roads) {
      if (Math.abs(pos.z - r) < 1.2 && rand() < 0.012) {
        car.axis = 'x';
        car.road = r;
        car.heading = rand() > 0.5 ? Math.PI / 2 : -Math.PI / 2;
        car.lane = (car.heading > 0 ? 1 : -1) * ROAD_HALF * 0.45;
        break;
      }
    }
    if (Math.abs(pos.z) > WORLD_SIZE / 2 - 16) car.heading += Math.PI;
  } else {
    pos.x += Math.sin(car.heading) * step;
    pos.z += (car.road + car.lane - pos.z) * Math.min(1, dt * 3);
    const roads = roadCoords();
    for (const r of roads) {
      if (Math.abs(pos.x - r) < 1.2 && rand() < 0.012) {
        car.axis = 'z';
        car.road = r;
        car.heading = rand() > 0.5 ? 0 : Math.PI;
        car.lane = (car.heading === 0 ? 1 : -1) * ROAD_HALF * 0.45;
        break;
      }
    }
    if (Math.abs(pos.x) > WORLD_SIZE / 2 - 16) car.heading += Math.PI;
  }
  car.group.rotation.y = car.heading;
  spinWheels(car, dt);
  // stuck detection -> teleport ahead along the road
  if (pos.distanceTo(car.lastPos) < 0.4) car.stuckTime += dt;
  else car.stuckTime = 0;
  car.lastPos.copy(pos);
  if (car.stuckTime > 3.2) {
    car.stuckTime = 0;
    if (car.axis === 'z') pos.z += Math.cos(car.heading) * 26;
    else pos.x += Math.sin(car.heading) * 26;
    car.speed = speed;
  }
}

export function spinWheels(car, dt) {
  const spin = (car.speed * dt) / 0.36;
  for (const w of car.wheels) w.rotation.x += spin;
}

// Arcade driving for the player's car. Works at crawl speed too.
export function drivePlayerCar(car, input, dt) {
  const top = car.model.topSpeed;
  const accel = car.model.accel;
  if (input.forward) car.speed += accel * dt * (car.speed < 0 ? 2.2 : 1);
  else if (input.backward) car.speed -= accel * 0.75 * dt * (car.speed > 0 ? 2.4 : 1);
  else car.speed -= car.speed * dt * 0.55;
  car.speed = THREE.MathUtils.clamp(car.speed, -11, top);
  const steerPower = THREE.MathUtils.clamp(Math.abs(car.speed) / 14, 0.25, 1.6);
  if (input.left) car.heading += 1.85 * steerPower * dt * Math.sign(car.speed || 1);
  if (input.right) car.heading -= 1.85 * steerPower * dt * Math.sign(car.speed || 1);
  if (input.handbrake) car.speed -= car.speed * dt * 2.4;
  const pos = car.group.position;
  pos.x += Math.sin(car.heading) * car.speed * dt;
  pos.z += Math.cos(car.heading) * car.speed * dt;
  car.group.rotation.y = car.heading;
  // body roll for feel
  car.group.rotation.z = THREE.MathUtils.lerp(car.group.rotation.z, (input.left ? 0.04 : input.right ? -0.04 : 0) * Math.min(1, Math.abs(car.speed) / 30), dt * 6);
  spinWheels(car, dt);
  return Math.abs(car.speed) * 3.6; // km/h
}

export function nearestCar(cars, pos, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of cars) {
    const d = car.group.position.distanceTo(pos);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

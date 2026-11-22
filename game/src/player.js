// player.js — the on-foot character, sidewalk pedestrians and chase camera.
import * as THREE from 'three';
import { WORLD, collideCircle } from './world.js';

const SKIN = [0xf2c49b, 0xc98a5e, 0x8a5a3b, 0xf7d7b5];
const SHIRTS = [0xe84f4f, 0x4f8fe8, 0xf5c542, 0x7ac74f, 0xf2f2f2, 0xc95ae8, 0xff9a3d];
const PANTS = [0x2c3e5a, 0x4a4a4a, 0x7a5a3a, 0x2e5a3e];

export function makePersonMesh(rng, hero) {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: SKIN[Math.floor(rng() * SKIN.length)] });
  const shirt = new THREE.MeshLambertMaterial({ color: hero ? 0xffd94d : SHIRTS[Math.floor(rng() * SHIRTS.length)] });
  const pants = new THREE.MeshLambertMaterial({ color: PANTS[Math.floor(rng() * PANTS.length)] });
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.38, 0.34), skin);
  head.position.y = 1.62; head.castShadow = true;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.66, 0.28), shirt);
  torso.position.y = 1.08; torso.castShadow = true;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.72, 0.2), pants);
  legL.position.set(-0.13, 0.38, 0);
  const legR = legL.clone(); legR.position.x = 0.13;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.6, 0.16), shirt);
  armL.position.set(-0.34, 1.1, 0);
  const armR = armL.clone(); armR.position.x = 0.34;
  group.add(head); group.add(torso); group.add(legL); group.add(legR); group.add(armL); group.add(armR);
  group.userData.parts = { legL, legR, armL, armR, head };
  // Weapon prop in the right hand (shown when a gun is drawn).
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x22262e }));
  gun.position.set(0.34, 0.85, 0.3);
  gun.visible = false;
  group.add(gun);
  group.userData.gun = gun;
  return group;
}

export function animateWalk(mesh, phase, amount) {
  const p = mesh.userData.parts;
  if (!p) return;
  const swing = Math.sin(phase) * 0.55 * amount;
  p.legL.rotation.x = swing;
  p.legR.rotation.x = -swing;
  p.armL.rotation.x = -swing * 0.8;
  p.armR.rotation.x = swing * 0.8;
}

export function spawnPlayer(G) {
  const mesh = makePersonMesh(G.rng, true);
  G.scene.add(mesh);
  G.player = {
    mesh,
    pos: new THREE.Vector3(6, 0, 14),
    heading: Math.PI,
    speed: 0,
    walkPhase: 0,
    hp: 100, armor: 25,
    car: null,
    weapon: 'fists',
    fireCooldown: 0,
    protectUntil: 0,
    dead: false,
  };
  syncPlayerMesh(G);
  return G.player;
}

export function syncPlayerMesh(G) {
  const p = G.player;
  if (p.car) { p.mesh.visible = false; return; }
  p.mesh.visible = true;
  p.mesh.position.copy(p.pos);
  p.mesh.rotation.y = p.heading;
  p.mesh.userData.gun.visible = p.weapon !== 'fists';
}

export function updatePlayerOnFoot(G, dt, input) {
  const p = G.player;
  const turn = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  p.heading += turn * 2.6 * dt;
  const sprint = input.sprint ? 1.65 : 1;
  let move = 0;
  if (input.forward) move = 1;
  if (input.back) move = -0.6;
  const speed = 6.2 * sprint * move;
  p.speed = speed;
  p.pos.x += Math.sin(p.heading) * speed * dt;
  p.pos.z += Math.cos(p.heading) * speed * dt;
  collideCircle(G, p.pos, 0.55);
  // Cars are solid for a pedestrian too.
  for (const car of G.cars) {
    const dx = p.pos.x - car.pos.x, dz = p.pos.z - car.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.01 && d < 2.2) {
      p.pos.x = car.pos.x + (dx / d) * 2.2;
      p.pos.z = car.pos.z + (dz / d) * 2.2;
    }
  }
  p.walkPhase += Math.abs(speed) * dt * 1.9;
  animateWalk(p.mesh, p.walkPhase, Math.abs(move));
  syncPlayerMesh(G);
}

export function spawnPeds(G, count) {
  G.peds = [];
  for (let i = 0; i < count; i++) {
    const mesh = makePersonMesh(G.rng, false);
    G.scene.add(mesh);
    const ped = {
      mesh, pos: new THREE.Vector3(), heading: 0, speed: 1.4 + G.rng() * 1.1,
      axis: 'z', dir: 1, phase: G.rng() * 10, flee: 0, hp: 30, down: 0,
    };
    placePed(G, ped);
    G.peds.push(ped);
  }
}

export function placePed(G, ped) {
  ped.axis = G.rng() < 0.5 ? 'z' : 'x';
  ped.dir = G.rng() < 0.5 ? 1 : -1;
  const side = G.rng() < 0.5 ? -10.6 : 10.6;
  if (ped.axis === 'z') {
    const ax = WORLD.avenues[Math.floor(G.rng() * WORLD.avenues.length)];
    ped.pos.set(ax + side, 0, -220 + G.rng() * 440);
    ped.heading = ped.dir > 0 ? 0 : Math.PI;
  } else {
    const sz = WORLD.streets[Math.floor(G.rng() * WORLD.streets.length)];
    ped.pos.set(-220 + G.rng() * 440, 0, sz + side);
    ped.heading = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  }
  ped.mesh.position.copy(ped.pos);
  ped.mesh.rotation.y = ped.heading;
}

export function updatePeds(G, dt) {
  const pp = G.player.pos;
  for (const ped of G.peds) {
    if (ped.down > 0) {
      ped.down -= dt;
      ped.mesh.rotation.x = -Math.PI / 2;
      ped.mesh.position.y = 0.25;
      if (ped.down <= 0) { ped.mesh.rotation.x = 0; ped.mesh.position.y = 0; ped.hp = 30; placePed(G, ped); }
      continue;
    }
    let speed = ped.speed;
    if (ped.flee > 0) {
      ped.flee -= dt;
      speed = 5.2;
      ped.heading = Math.atan2(ped.pos.x - pp.x, ped.pos.z - pp.z);
    }
    ped.pos.x += Math.sin(ped.heading) * speed * dt;
    ped.pos.z += Math.cos(ped.heading) * speed * dt;
    if (Math.abs(ped.pos.x) > 234 || Math.abs(ped.pos.z) > 234 || ped.pos.x > 212) placePed(G, ped);
    ped.phase += speed * dt * 2.2;
    animateWalk(ped.mesh, ped.phase, 1);
    ped.mesh.position.copy(ped.pos);
    ped.mesh.rotation.y = ped.heading;
  }
}

export function scarePeds(G, x, z, radius) {
  for (const ped of G.peds) {
    if (Math.hypot(ped.pos.x - x, ped.pos.z - z) < radius) ped.flee = 3.5;
  }
}

export function updateCamera(G, dt) {
  const p = G.player;
  const cam = G.camera;
  let targetPos, lookAt, stiffness = 4.5;
  if (p.car) {
    const car = p.car;
    const back = 9.5 + Math.abs(car.speed) * 0.12;
    targetPos = new THREE.Vector3(
      car.pos.x - Math.sin(car.heading) * back,
      4.2 + Math.abs(car.speed) * 0.03,
      car.pos.z - Math.cos(car.heading) * back,
    );
    lookAt = new THREE.Vector3(
      car.pos.x + Math.sin(car.heading) * 7, 1.2,
      car.pos.z + Math.cos(car.heading) * 7,
    );
    stiffness = 3.2;
  } else {
    targetPos = new THREE.Vector3(
      p.pos.x - Math.sin(p.heading) * 7.5, 3.4,
      p.pos.z - Math.cos(p.heading) * 7.5,
    );
    lookAt = new THREE.Vector3(
      p.pos.x + Math.sin(p.heading) * 5, 1.4,
      p.pos.z + Math.cos(p.heading) * 5,
    );
  }
  const k = Math.min(1, dt * stiffness);
  cam.position.lerp(targetPos, k);
  if (cam.position.y < 1.2) cam.position.y = 1.2;
  cam.lookAt(lookAt);
  G.camLookAt = lookAt;
}

export function snapCamera(G) {
  const p = G.player;
  if (p.car) {
    G.camera.position.set(
      p.car.pos.x - Math.sin(p.car.heading) * 10, 4.4,
      p.car.pos.z - Math.cos(p.car.heading) * 10,
    );
  } else {
    G.camera.position.set(p.pos.x - Math.sin(p.heading) * 7.5, 3.4, p.pos.z - Math.cos(p.heading) * 7.5);
  }
  updateCamera(G, 10);
}

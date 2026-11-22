// police.js — wanted stars, named dispatch tiers, pursuit that never pins,
// roadblocks and helicopter air support with a tracking spotlight.
import * as THREE from 'three';
import { WORLD, collideCircle, nearestRoadPoint } from './world.js';
import { makeCarMesh, syncCarMesh, damageCar } from './vehicles.js';

export const TIERS = [
  { name: '—', units: 0 },
  { name: 'TIER 1 · PATROL', units: 1 },
  { name: 'TIER 2 · INTERCEPTOR', units: 2 },
  { name: 'TIER 3 · ROADBLOCK', units: 3 },
  { name: 'TIER 4 · AIR SUPPORT', units: 4 },
  { name: 'TIER 5 · MAXIMUM RESPONSE', units: 6 },
];
const CALLSIGNS = ['UNIT 12', 'UNIT 7', 'UNIT 21', 'UNIT 4', 'UNIT 16', 'UNIT 9'];
const TACTICS = ['RAMMING', 'FLANKING', 'FLANKING', 'RAMMING', 'FLANKING', 'RAMMING'];

export function initPolice(G) {
  G.police = {
    heat: 0, stars: 0, units: [], heli: null, roadblocks: [],
    lastCrimeAt: -99, lastTier: 0, roadblockTimer: 0, shotTimer: 0,
  };
  return G.police;
}

export function addHeat(G, amount) {
  const P = G.police;
  P.heat = Math.max(0, Math.min(5.99, P.heat + amount));
  P.lastCrimeAt = G.time;
}

export function clearWanted(G) {
  G.police.heat = 0;
}

function spawnUnit(G, index) {
  const p = G.player.pos;
  const angle = G.rng() * Math.PI * 2;
  const dist = 75 + G.rng() * 35;
  const raw = { x: p.x + Math.cos(angle) * dist, z: p.z + Math.sin(angle) * dist };
  const road = nearestRoadPoint(
    Math.max(-225, Math.min(200, raw.x)), Math.max(-225, Math.min(225, raw.z)));
  const mesh = makeCarMesh({ name: 'Bay PD Interceptor', color: 0xf4f6f8, top: 48, accel: 24 }, true);
  mesh.position.set(road.x, 0, road.z);
  G.scene.add(mesh);
  const unit = {
    id: G.nextCarId++, kind: 'police', spec: { name: 'Bay PD Interceptor', top: 48, accel: 24 },
    mesh, pos: new THREE.Vector3(road.x, 0, road.z),
    heading: Math.atan2(p.x - road.x, p.z - road.z), speed: 0,
    condition: 100, hp: 120, driver: 'police', dead: false,
    callsign: CALLSIGNS[index % CALLSIGNS.length],
    tactic: TACTICS[index % TACTICS.length],
    flankSide: index % 2 === 0 ? 1 : -1, backoff: 0, flashT: G.rng() * 10,
  };
  G.cars.push(unit);
  G.police.units.push(unit);
  return unit;
}

function removeUnit(G, unit) {
  G.scene.remove(unit.mesh);
  G.cars = G.cars.filter((c) => c !== unit);
  G.police.units = G.police.units.filter((u) => u !== unit);
}

function makeHeli(G) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x24406e });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.8, 5.2), bodyMat);
  body.castShadow = true;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 3.6), bodyMat);
  tail.position.set(0, 0.3, -4.2);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.08, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x22262e }));
  rotor.position.y = 1.25;
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.6, 0.3),
    new THREE.MeshLambertMaterial({ color: 0x22262e }));
  tailRotor.position.set(0.35, 0.3, -5.9);
  const skidMat = new THREE.MeshLambertMaterial({ color: 0x3a4150 });
  for (const sx of [-0.9, 0.9]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 3.4), skidMat);
    skid.position.set(sx, -1.25, 0);
    group.add(skid);
  }
  group.add(body); group.add(tail); group.add(rotor); group.add(tailRotor);
  const spot = new THREE.SpotLight(0xfff2c0, 900, 160, 0.34, 0.5, 1.2);
  group.add(spot); group.add(spot.target);
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(9, 30, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.24, side: THREE.DoubleSide, depthWrite: false }),
  );
  cone.position.y = -15;
  group.add(cone);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(7.5, 22),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.3, depthWrite: false }));
  pool.rotation.x = -Math.PI / 2;
  G.scene.add(pool);
  G.scene.add(group);
  return { group, rotor, tailRotor, spot, cone, pool, angle: 0, pos: new THREE.Vector3(0, 30, 0) };
}

function removeHeli(G) {
  if (!G.police.heli) return;
  G.scene.remove(G.police.heli.group);
  G.scene.remove(G.police.heli.pool);
  G.police.heli = null;
}

function placeRoadblock(G) {
  const P = G.police;
  for (const rb of P.roadblocks) { G.scene.remove(rb.mesh); G.cars = G.cars.filter((c) => c !== rb); }
  P.roadblocks = [];
  const p = G.player;
  const heading = p.car ? p.car.heading : p.heading;
  const ahead = { x: p.pos.x + Math.sin(heading) * 55, z: p.pos.z + Math.cos(heading) * 55 };
  const road = nearestRoadPoint(Math.max(-225, Math.min(200, ahead.x)), Math.max(-225, Math.min(225, ahead.z)));
  const cross = Math.abs(Math.sin(heading)) > Math.abs(Math.cos(heading));
  for (const off of [-4.2, 4.2]) {
    const mesh = makeCarMesh({ name: 'Bay PD Interceptor', color: 0xf4f6f8, top: 48, accel: 24 }, true);
    const x = cross ? road.x : road.x + off;
    const z = cross ? road.z + off : road.z;
    mesh.position.set(x, 0, z);
    G.scene.add(mesh);
    const rb = {
      id: G.nextCarId++, kind: 'police', spec: { name: 'Bay PD Interceptor', top: 48, accel: 24 },
      mesh, pos: new THREE.Vector3(x, 0, z),
      heading: cross ? Math.PI / 2 : 0, speed: 0, condition: 100, hp: 120,
      driver: 'roadblock', dead: false, callsign: 'ROADBLOCK', tactic: 'ROADBLOCK', flashT: G.rng() * 10,
    };
    mesh.rotation.y = rb.heading;
    G.cars.push(rb);
    P.roadblocks.push(rb);
  }
}

function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, t);
}

export function updatePolice(G, dt) {
  const P = G.police;
  const player = G.player;
  P.stars = Math.max(0, Math.min(5, Math.floor(P.heat + 0.001)));
  if (P.stars !== P.lastTier) {
    P.lastTier = P.stars;
    if (P.stars > 0 && G.hud) G.hud.showTier(TIERS[P.stars].name);
  }

  // Decay: cool down when no unit is close and no fresh crime.
  const nearest = P.units.reduce((m, u) => Math.min(m, u.pos.distanceTo(player.pos)), 9999);
  if (P.stars > 0 && nearest > 55 && G.time - P.lastCrimeAt > 8) {
    P.heat = Math.max(0, P.heat - dt / 16);
  }

  const wantUnits = TIERS[P.stars].units;
  while (P.units.length < wantUnits) spawnUnit(G, P.units.length);
  while (P.units.length > wantUnits) removeUnit(G, P.units[P.units.length - 1]);

  if (P.stars >= 3 && !P.heli) P.heli = makeHeli(G);
  if (P.stars < 3 && P.heli) removeHeli(G);

  P.roadblockTimer -= dt;
  if (P.stars >= 3 && P.roadblockTimer <= 0) { placeRoadblock(G); P.roadblockTimer = 26; }
  if (P.stars < 3 && P.roadblocks.length) {
    for (const rb of P.roadblocks) { G.scene.remove(rb.mesh); G.cars = G.cars.filter((c) => c !== rb); }
    P.roadblocks = [];
  }

  const playerSpeed = player.car ? Math.abs(player.car.speed) : Math.abs(player.speed || 0);
  const playerHeading = player.car ? player.car.heading : player.heading;

  for (const unit of P.units) {
    const toPlayer = new THREE.Vector3().subVectors(player.pos, unit.pos);
    const dist = Math.hypot(toPlayer.x, toPlayer.z);
    // Tactic target: flankers aim beside the player, rammers aim at the player.
    let tx = player.pos.x, tz = player.pos.z;
    if (unit.tactic === 'FLANKING' && dist > 14) {
      tx += Math.cos(playerHeading) * 7 * unit.flankSide;
      tz += -Math.sin(playerHeading) * 7 * unit.flankSide;
    }
    const desired = Math.atan2(tx - unit.pos.x, tz - unit.pos.z);
    unit.heading = angleLerp(unit.heading, desired, dt * 2.6);

    // ANTI-PIN RULE: police keep a standoff. Inside 8 m they may not go
    // faster than the player, and a hard push-out moves the POLICE car
    // (never the player) so the player can always crawl forward.
    let targetSpeed;
    if (unit.backoff > 0) { unit.backoff -= dt; targetSpeed = 2; }
    else if (dist > 40) targetSpeed = 44;
    else if (dist > 16) targetSpeed = Math.max(playerSpeed + 6, 16);
    else if (dist > 8) targetSpeed = Math.max(playerSpeed + 2, 7);
    else targetSpeed = Math.min(playerSpeed * 0.92, 6);
    if (!player.car && dist < 4.5) targetSpeed = 0;
    unit.speed += (targetSpeed - unit.speed) * Math.min(1, dt * 2.4);
    unit.pos.x += Math.sin(unit.heading) * unit.speed * dt;
    unit.pos.z += Math.cos(unit.heading) * unit.speed * dt;
    collideCircle(G, unit.pos, 2.1);

    // Hard separation from the player: move only the police car.
    const dx = unit.pos.x - player.pos.x, dz = unit.pos.z - player.pos.z;
    const sep = Math.hypot(dx, dz);
    const minSep = player.car ? 4.4 : 3.4;
    if (sep > 0.01 && sep < minSep) {
      unit.pos.x = player.pos.x + (dx / sep) * minSep;
      unit.pos.z = player.pos.z + (dz / sep) * minSep;
      if (unit.speed > 6) unit.backoff = 0.8;
    }
    // Gentle ram damage only at real closing speed.
    if (player.car && sep < 5.2 && unit.speed > 9 && playerSpeed < unit.speed - 4) {
      damageCar(G, player.car, 2.2);
      G.damagePlayer(1.2, 'ram');
      unit.backoff = 1.1;
    }
    // Separation from other cars.
    for (const other of G.cars) {
      if (other === unit) continue;
      const ox = unit.pos.x - other.pos.x, oz = unit.pos.z - other.pos.z;
      const od = Math.hypot(ox, oz);
      if (od > 0.01 && od < 4.1) {
        unit.pos.x += (ox / od) * (4.1 - od) * 0.6;
        unit.pos.z += (oz / od) * (4.1 - od) * 0.6;
      }
    }
    if (dist > 240) { // Lost far behind: rejoin from a nearby road.
      const road = nearestRoadPoint(player.pos.x + (G.rng() - 0.5) * 120, player.pos.z + (G.rng() - 0.5) * 120);
      unit.pos.set(road.x, 0, road.z);
    }
    unit.flashT += dt * 7;
    const bar = unit.mesh.userData.lightBar;
    if (bar) {
      const on = Math.sin(unit.flashT) > 0;
      bar.red.material.color.setHex(on ? 0xff3333 : 0x661111);
      bar.blue.material.color.setHex(on ? 0x112266 : 0x3366ff);
    }
    syncCarMesh(unit);
  }

  for (const rb of P.roadblocks) {
    rb.flashT += dt * 7;
    const bar = rb.mesh.userData.lightBar;
    if (bar) {
      const on = Math.sin(rb.flashT) > 0;
      bar.red.material.color.setHex(on ? 0xff3333 : 0x661111);
      bar.blue.material.color.setHex(on ? 0x112266 : 0x3366ff);
    }
    syncCarMesh(rb);
  }

  // Police fire: at 2+ stars, units within 26 m land occasional shots.
  P.shotTimer -= dt;
  if (P.stars >= 2 && P.shotTimer <= 0 && nearest < 26 && !player.dead) {
    P.shotTimer = 1.4 + G.rng() * 1.2;
    if (G.time > player.protectUntil) G.damagePlayer(player.car ? 2.5 : 4, 'shot');
    G.audio.shot('pistol');
  }

  // Helicopter orbit + spotlight tracking.
  if (P.heli) {
    const H = P.heli;
    H.angle += dt * 0.45;
    const hx = player.pos.x + Math.cos(H.angle) * 24;
    const hz = player.pos.z + Math.sin(H.angle) * 24;
    H.pos.set(hx, 30, hz);
    H.group.position.copy(H.pos);
    H.group.rotation.y = Math.atan2(player.pos.x - hx, player.pos.z - hz);
    H.group.rotation.z = 0.18;
    H.rotor.rotation.y += dt * 28;
    H.tailRotor.rotation.x += dt * 22;
    H.spot.target.position.set(player.pos.x - hx, -30, player.pos.z - hz);
    const tilt = Math.atan2(24, 30);
    H.cone.rotation.z = tilt * Math.cos(H.angle);
    H.cone.rotation.x = -tilt * Math.sin(H.angle);
    H.pool.position.set(player.pos.x, 0.12, player.pos.z);
    H.pool.material.opacity = 0.34 + Math.sin(G.time * 6) * 0.06;
  }
}

export function dispatchInfo(G) {
  const P = G.police;
  const lines = P.units.map((u) => ({
    callsign: u.callsign,
    dist: Math.round(u.pos.distanceTo(G.player.pos)),
    tactic: u.tactic,
  }));
  if (P.heli) lines.push({ callsign: 'AIR 1', dist: Math.round(P.heli.pos.distanceTo(G.player.pos)), tactic: 'SPOTLIGHT' });
  for (const rb of P.roadblocks) {
    lines.push({ callsign: rb.callsign, dist: Math.round(rb.pos.distanceTo(G.player.pos)), tactic: 'ROADBLOCK' });
  }
  return { tier: TIERS[P.stars].name, lines };
}

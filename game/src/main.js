// main.js — boot, game loop, input, combat, death/respawn, shot staging.
// Neon Bay Nights: a true-3D open-world crime game (Three.js, offline).
import * as THREE from 'three';
import { buildWorld, updateWorld, makeRng, LANDMARKS } from './world.js';
import { buildCity, updateCity } from './city.js';
import {
  spawnTraffic, spawnParked, spawnCarAt, drivePlayerCar, updateVehicles,
  nearestCar, damageCar, syncCarMesh,
} from './vehicles.js';
import {
  spawnPlayer, updatePlayerOnFoot, spawnPeds, updatePeds, scarePeds,
  updateCamera, snapCamera, syncPlayerMesh,
} from './player.js';
import { initPolice, updatePolice, addHeat, clearWanted } from './police.js';
import { initMissions, updateMissions, currentStage, JOBS } from './missions.js';
import { buildHud, updateHud, WEAPON_SLOTS } from './hud.js';
import { initAudio } from './audio.js';
import { loadSave, writeSave } from './save.js';

const WEAPONS = {
  fists: { damage: 9, rate: 0.34, range: 2.4, pellets: 1 },
  pistol: { damage: 15, rate: 0.3, range: 62, pellets: 1 },
  smg: { damage: 9, rate: 0.09, range: 56, pellets: 1 },
  shotgun: { damage: 11, rate: 0.85, range: 27, pellets: 5 },
};

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') || 1);
const shotMode = params.get('shot');

const G = {
  time: 0, clockMinutes: 17 * 60 + 42, rng: makeRng(seed * 7919 + 13),
  cars: [], nextCarId: 1, peds: [], started: false, paused: false,
  wasted: false, wastedTimer: 0, autopilot: null, shotMode,
  tracers: [], pickups: [], keys: {}, mouseDown: false,
};
G.save = loadSave();
if (shotMode) { // Screenshots always stage from a rich mid-game state.
  G.save.money = 4850;
  G.save.weapons.smg.owned = true; G.save.weapons.smg.ammo = 180;
  G.save.weapons.shotgun.owned = true; G.save.weapons.shotgun.ammo = 32;
  G.save.weapons.pistol.ammo = 96;
  G.save.respect = { Downtown: 3, Beachfront: 2, 'Old Town': 1, Marina: 2 };
  G.save.radio = 1;
}
G.saveGame = function () { if (!shotMode) writeSave(G.save); };

buildWorld(G);
buildCity(G);
initPolice(G);
spawnPlayer(G);
spawnTraffic(G, 26);
spawnParked(G, 22);
spawnPeds(G, 34);
initAudio(G);
buildHud(G);
initMissions(G);
spawnPickups(G);
G.player.protectUntil = 4;

G.damagePlayer = function (amount, source) {
  const p = G.player;
  if (p.dead || G.time < p.protectUntil) return;
  let left = amount;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, left * 0.6);
    p.armor -= absorbed;
    left -= absorbed;
  }
  p.hp -= left;
  if (p.hp <= 0) die();
};

function die() {
  const p = G.player;
  p.dead = true;
  G.wasted = true;
  G.wastedTimer = 2.4;
  G.hud.wastedScreen.style.display = 'flex';
  G.audio.crash(true);
}

function respawn() {
  const p = G.player;
  if (p.car) exitCar(true);
  p.pos.set(LANDMARKS.hospital.x, 0, LANDMARKS.hospital.z + 18);
  p.heading = 0;
  p.hp = 100; p.armor = 25; p.dead = false;
  p.protectUntil = G.time + 4;
  clearWanted(G);
  G.wasted = false;
  G.hud.wastedScreen.style.display = 'none';
  syncPlayerMesh(G);
  snapCamera(G);
  G.hud.showDialogue('MARLOWE', 'Marlowe: "Hospital patched you up. Try not to die on my time."', 5);
}

function spawnPickups(G) {
  const defs = [
    { kind: 'smg', x: -160, z: 150, color: 0xffd94d },
    { kind: 'shotgun', x: 150, z: 160, color: 0xff8c5a },
    { kind: 'armor', x: 0, z: -150, color: 0x4fa3e8 },
    { kind: 'health', x: -150, z: 0, color: 0xe84f4f },
    { kind: 'health', x: 160, z: -150, color: 0xe84f4f },
    { kind: 'armor', x: 80, z: 150, color: 0x4fa3e8 },
  ];
  for (const def of defs) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9),
      new THREE.MeshBasicMaterial({ color: def.color }));
    mesh.position.set(def.x, 1, def.z);
    G.scene.add(mesh);
    G.pickups.push({ ...def, mesh, taken: false });
  }
}

function updatePickups(dt) {
  const p = G.player;
  for (const pk of G.pickups) {
    if (pk.taken) continue;
    pk.mesh.rotation.y += dt * 2.4;
    pk.mesh.position.y = 1 + Math.sin(G.time * 2.6 + pk.x) * 0.18;
    if (!p.car && Math.hypot(pk.x - p.pos.x, pk.z - p.pos.z) < 1.8) {
      pk.taken = true;
      pk.mesh.visible = false;
      G.audio.pickup();
      if (pk.kind === 'smg') {
        G.save.weapons.smg.owned = true; G.save.weapons.smg.ammo += 90;
        G.hud.showBanner('SMG PICKED UP — press 3', 2.5);
      } else if (pk.kind === 'shotgun') {
        G.save.weapons.shotgun.owned = true; G.save.weapons.shotgun.ammo += 16;
        G.hud.showBanner('SHOTGUN PICKED UP — press 4', 2.5);
      } else if (pk.kind === 'armor') {
        p.armor = Math.min(100, p.armor + 50);
        G.hud.showBanner('ARMOR +50', 2);
      } else if (pk.kind === 'health') {
        p.hp = Math.min(100, p.hp + 40);
        G.hud.showBanner('HEALTH +40', 2);
      }
      G.saveGame();
    }
  }
}

function enterCar(car) {
  const p = G.player;
  p.car = car;
  car.driver = 'player';
  p.pos.copy(car.pos);
  p.heading = car.heading;
  G.audio.door();
  if (car.kind === 'traffic' || car.kind === 'parked') addHeat(G, 0.55);
  syncPlayerMesh(G);
  G.hud.setHint('');
}

function exitCar(silent) {
  const p = G.player;
  if (!p.car) return;
  const car = p.car;
  car.driver = null;
  car.speed = 0;
  p.pos.set(car.pos.x + Math.cos(car.heading) * 2.6, 0, car.pos.z - Math.sin(car.heading) * 2.6);
  p.heading = car.heading;
  p.car = null;
  if (!silent) G.audio.door();
  syncPlayerMesh(G);
}

function tryEnterOrExit() {
  const p = G.player;
  if (p.car) { exitCar(false); return; }
  const car = nearestCar(G, p.pos, 4.6);
  if (car) enterCar(car);
}

function fireWeapon() {
  const p = G.player;
  const w = WEAPONS[p.weapon];
  const saved = G.save.weapons[p.weapon];
  if (p.weapon !== 'fists') {
    if (!saved.owned || saved.ammo <= 0) { G.hud.showBanner('NO AMMO', 1.2); return; }
    saved.ammo -= 1;
  }
  p.fireCooldown = w.rate;
  const origin = new THREE.Vector3(p.pos.x, 1.35, p.pos.z);
  const dir = new THREE.Vector3(Math.sin(p.heading), 0, Math.cos(p.heading));
  if (p.weapon === 'fists') {
    G.audio.punch();
    for (const ped of G.peds) {
      if (ped.down > 0) continue;
      const d = ped.pos.distanceTo(p.pos);
      if (d < w.range) { hurtPed(ped, w.damage); addHeat(G, 0.5); }
    }
    scarePeds(G, p.pos.x, p.pos.z, 10);
    return;
  }
  G.audio.shot(p.weapon);
  scarePeds(G, p.pos.x, p.pos.z, 26);
  for (let pellet = 0; pellet < w.pellets; pellet++) {
    const spread = (G.rng() - 0.5) * (p.weapon === 'shotgun' ? 0.14 : 0.03);
    const d = dir.clone();
    const cos = Math.cos(spread), sin = Math.sin(spread);
    const rx = d.x * cos - d.z * sin, rz = d.x * sin + d.z * cos;
    d.x = rx; d.z = rz;
    shootRay(origin, d, w);
  }
  addHeat(G, 0.35);
}

function shootRay(origin, dir, w) {
  let bestDist = w.range, bestHit = null;
  function consider(pos, radius, hit) {
    const to = new THREE.Vector3().subVectors(pos, origin);
    const along = to.dot(dir);
    if (along < 0.5 || along > bestDist) return;
    const lateral = to.clone().sub(dir.clone().multiplyScalar(along)).length();
    if (lateral < radius) { bestDist = along; bestHit = hit; }
  }
  for (const ped of G.peds) {
    if (ped.down > 0) continue;
    consider(new THREE.Vector3(ped.pos.x, 1.1, ped.pos.z), 0.8, () => { hurtPed(ped, w.damage); addHeat(G, 0.7); });
  }
  for (const car of G.cars) {
    consider(new THREE.Vector3(car.pos.x, 0.8, car.pos.z), 2.1, () => {
      damageCar(G, car, w.damage * 0.8);
      addHeat(G, car.kind === 'police' ? 0.9 : 0.3);
    });
  }
  const end = origin.clone().add(dir.clone().multiplyScalar(bestDist));
  addTracer(origin, end);
  if (bestHit) bestHit();
}

function hurtPed(ped, damage) {
  ped.hp -= damage;
  ped.flee = 4;
  if (ped.hp <= 0) ped.down = 14;
}

function addTracer(from, to) {
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const mat = new THREE.LineBasicMaterial({ color: 0xffe9a3, transparent: true, opacity: 0.95 });
  const line = new THREE.Line(geo, mat);
  G.scene.add(line);
  G.tracers.push({ line, life: 0.07 });
}

function updateTracers(dt) {
  for (let i = G.tracers.length - 1; i >= 0; i--) {
    const t = G.tracers[i];
    t.life -= dt;
    t.line.material.opacity = Math.max(0, t.life / 0.07);
    if (t.life <= 0) {
      G.scene.remove(t.line);
      t.line.geometry.dispose(); t.line.material.dispose();
      G.tracers.splice(i, 1);
    }
  }
}

function garageCheck() {
  if (!G.garagePoint) return;
  const p = G.player;
  const d = Math.hypot(G.garagePoint.x - p.pos.x, G.garagePoint.z - p.pos.z);
  if (d < 6.5 && G.police.stars > 0) {
    clearWanted(G);
    if (G.save.money >= 50) G.save.money -= 50;
    G.hud.showBanner('BAY GARAGE — heat cleared (−$50)', 2.5);
    G.audio.cash();
    G.saveGame();
  }
}

// ---- input ---------------------------------------------------------------
function readInput() {
  const k = G.keys;
  const input = {
    forward: !!(k['KeyW'] || k['ArrowUp']),
    back: !!(k['KeyS'] || k['ArrowDown']),
    left: !!(k['KeyA'] || k['ArrowLeft']),
    right: !!(k['KeyD'] || k['ArrowRight']),
    sprint: !!(k['ShiftLeft'] || k['ShiftRight']),
    handbrake: !!k['Space'],
    attack: !!k['KeyF'] || G.mouseDown,
  };
  if (G.autopilot) Object.assign(input, G.autopilot);
  return input;
}

window.addEventListener('keydown', (e) => {
  G.keys[e.code] = true;
  if (e.code === 'Space') e.preventDefault();
  if (!G.started) return;
  if (e.code === 'KeyE') tryEnterOrExit();
  if (e.code === 'KeyR') {
    G.save.radio = (G.save.radio + 1) % 3;
    G.saveGame();
  }
  if (e.code === 'KeyH') G.audio.horn();
  if (e.code === 'KeyM') {
    G.save.muted = !G.save.muted;
    G.audio.setMuted(G.save.muted);
    G.saveGame();
  }
  if (e.code === 'KeyP') {
    G.paused = !G.paused;
    G.hud.pauseScreen.style.display = G.paused ? 'flex' : 'none';
  }
  const slotIdx = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
  if (slotIdx >= 0) {
    const slot = WEAPON_SLOTS[slotIdx];
    if (G.save.weapons[slot.key].owned) G.player.weapon = slot.key;
    else G.hud.showBanner(slot.label.toUpperCase() + ' LOCKED', 1.4);
  }
});
window.addEventListener('keyup', (e) => { G.keys[e.code] = false; });
window.addEventListener('mousedown', (e) => {
  if (!G.started) return;
  G.mouseDown = true;
  G.audio.ensure();
  if (document.pointerLockElement !== G.renderer.domElement && e.target === G.renderer.domElement) {
    G.renderer.domElement.requestPointerLock();
  }
});
window.addEventListener('mouseup', () => { G.mouseDown = false; });
window.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === G.renderer.domElement && !G.player.car) {
    G.player.heading -= e.movementX * 0.0028;
  }
});
window.addEventListener('resize', () => {
  G.camera.aspect = window.innerWidth / window.innerHeight;
  G.camera.updateProjectionMatrix();
  G.renderer.setSize(window.innerWidth, window.innerHeight);
});

function startGame() {
  if (G.started) return;
  G.started = true;
  G.hud.titleScreen.style.display = 'none';
  G.audio.ensure();
  G.player.protectUntil = G.time + 4;
  snapCamera(G);
  const job = JOBS[Math.min(G.mission.jobIndex, JOBS.length - 1)];
  if (job && !G.mission.allDone) G.hud.showDialogue('MARLOWE', job.brief, 7);
  else G.hud.showDialogue('MARLOWE', 'Marlowe: "Neon Bay is yours now. Cruise safe."', 6);
}
document.getElementById('start-btn').addEventListener('click', startGame);

// ---- main loop -----------------------------------------------------------
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
  G.time += dt;
  if (!G.started) {
    // Title backdrop: slow orbit over the city.
    const a = G.time * 0.06;
    G.camera.position.set(Math.cos(a) * 150, 55, Math.sin(a) * 150);
    G.camera.lookAt(0, 8, 0);
    updateWorld(G, dt);
    updateCity(G, dt);
    updateVehicles(G, dt);
    updatePeds(G, dt);
    G.renderer.render(G.scene, G.camera);
    return;
  }
  if (G.paused) { G.renderer.render(G.scene, G.camera); return; }

  G.clockMinutes += dt * 0.5;
  const p = G.player;
  const input = readInput();

  if (G.wasted) {
    G.wastedTimer -= dt;
    if (G.wastedTimer <= 0) respawn();
  } else if (p.car) {
    drivePlayerCar(G, p.car, dt, input);
    p.pos.copy(p.car.pos);
    p.heading = p.car.heading;
    if (input.attack && p.fireCooldown <= 0) { /* no drive-by shooting */ }
  } else {
    updatePlayerOnFoot(G, dt, input);
    if (input.attack && p.fireCooldown <= 0) fireWeapon();
  }
  if (p.fireCooldown > 0) p.fireCooldown -= dt;

  // Hint when a car is close enough to steal.
  if (!p.car && !G.wasted) {
    const near = nearestCar(G, p.pos, 4.6);
    G.hud.setHint(near ? 'Press E to steal the ' + near.spec.name : '');
  } else if (p.car) {
    G.hud.setHint('Press E to exit');
  }

  updateVehicles(G, dt);
  updatePeds(G, dt);
  updatePolice(G, dt);
  updateMissions(G, dt);
  updatePickups(dt);
  updateTracers(dt);
  updateWorld(G, dt);
  updateCity(G, dt);
  garageCheck();
  G.audio.update(dt);
  updateCamera(G, dt);
  updateHud(G);
  G.renderer.render(G.scene, G.camera);
}
frame();

// ---- screenshot staging (?shot=1..4) ------------------------------------
// After police spawn (first update tick), arrange units/heli for the camera.
function arrangeForShot(offsets) {
  setTimeout(() => {
    const p = G.player;
    const heading = p.car ? p.car.heading : p.heading;
    const fwdX = Math.sin(heading), fwdZ = Math.cos(heading);
    const sideX = Math.cos(heading), sideZ = -Math.sin(heading);
    G.police.units.forEach((unit, i) => {
      const o = offsets[i % offsets.length];
      unit.pos.set(
        p.pos.x + fwdX * o.f + sideX * o.s, 0,
        p.pos.z + fwdZ * o.f + sideZ * o.s,
      );
      unit.heading = heading;
      unit.speed = p.car ? Math.abs(p.car.speed) : 0;
      syncCarMesh(unit);
    });
    if (G.police.heli) G.police.heli.angle = 1.15;
    snapCamera(G);
  }, 500);
}

function stageShot(n) {
  startGame();
  const p = G.player;
  G.hud.dialogue.style.display = 'none';
  if (n === 1) {
    // Mid-chase: 120+ km/h on the boulevard, police + helicopter, dialogue.
    G.mission.jobIndex = 5; G.mission.stage = 1; G.mission.timerLeft = 80;
    const car = spawnCarAt(G, 2, 160, -40, 0, 'parked');
    enterCar(car);
    car.speed = 34;
    G.autopilot = { forward: true };
    addHeat(G, 4.2);
    p.weapon = 'smg';
    arrangeForShot([{ f: -16, s: -4 }, { f: -18, s: 4 }, { f: 9, s: -6 }, { f: 12, s: 5 }]);
    G.hud.showDialogue('MARLOWE', 'Marlowe: "Bay PD is on you — lose them and bring that Palm GT home!"', 30);
  } else if (n === 2) {
    // On foot with SMG drawn, wanted, police + helicopter nearby.
    G.mission.jobIndex = 3; G.mission.stage = 0;
    p.pos.set(160, 0, 40);
    p.heading = Math.PI;
    p.weapon = 'smg';
    addHeat(G, 3.2);
    const cop = spawnCarAt(G, 0, 160, 24, 0, 'parked');
    cop.kind = 'police';
    arrangeForShot([{ f: 13, s: -3 }, { f: 17, s: 3.5 }, { f: 21, s: 0 }]);
    G.hud.showDialogue('MARLOWE', 'Marlowe: "Heat is rising. Keep that SMG handy and move!"', 30);
    snapCamera(G);
  } else if (n === 3) {
    // Mid-mission stage 2/2 with timer on a busy boulevard.
    G.mission.jobIndex = 1; G.mission.stage = 1; G.mission.timerLeft = 74;
    const car = spawnCarAt(G, 1, 160, -120, 0, 'parked');
    enterCar(car);
    car.speed = 14;
    G.autopilot = { forward: true };
    G.hud.showDialogue('MARLOWE', 'Marlowe: "Package is in. Downtown drop, do not be late."', 30);
  } else if (n === 4) {
    // 5 stars, Tier 5, flanking units, roadblock ahead, escaping to garage.
    G.mission.jobIndex = 7; G.mission.stage = 1;
    const car = spawnCarAt(G, 4, 0, 60, 0, 'parked');
    enterCar(car);
    car.speed = 26;
    G.autopilot = { forward: true };
    addHeat(G, 5.2);
    arrangeForShot([
      { f: -8, s: -4.5 }, { f: -8, s: 4.5 }, { f: 6, s: -6 },
      { f: 6, s: 6 }, { f: -14, s: 0 }, { f: 14, s: -3 },
    ]);
    G.hud.showTier('TIER 5 · MAXIMUM RESPONSE');
    G.hud.showDialogue('MARLOWE', 'Marlowe: "Maximum response! Get to Bay Garage, NOW!"', 30);
  }
  // Refresh mission marker/HUD for the staged state.
  const stage = currentStage(G);
  if (stage) G.mission.marker.position.set(stage.x, 0, stage.z);
  snapCamera(G);
}
if (shotMode) {
  const n = Number(shotMode);
  if (n >= 1 && n <= 4) stageShot(n);
  else startGame();
}

// ---- debug / playtest hook ------------------------------------------------
window.__NBN__ = {
  G,
  start: startGame,
  state() {
    const p = G.player;
    return {
      started: G.started, inCar: !!p.car,
      speedKmh: Math.round(Math.abs(p.car ? p.car.speed : (p.speed || 0)) * 3.6),
      wanted: G.police.stars, money: G.save.money, hp: Math.round(p.hp),
      mission: G.mission.jobIndex + 1, stage: G.mission.stage + 1,
      x: Math.round(p.pos.x * 10) / 10, z: Math.round(p.pos.z * 10) / 10,
      weapon: p.weapon, policeUnits: G.police.units.length,
      heli: !!G.police.heli, roadblocks: G.police.roadblocks.length,
    };
  },
  teleport(x, z) {
    const p = G.player;
    p.pos.set(x, 0, z);
    if (p.car) { p.car.pos.set(x, 0, z); syncCarMesh(p.car); }
    snapCamera(G);
  },
  setWanted(stars) { G.police.heat = stars + 0.2; G.police.lastCrimeAt = G.time; },
  enterNearestCar() { tryEnterOrExit(); },
  exitCar() { exitCar(false); },
  setSpeed(v) { if (G.player.car) G.player.car.speed = v; },
  setAutopilot(obj) { G.autopilot = obj; },
  setHeading(h) { G.player.heading = h; if (G.player.car) G.player.car.heading = h; },
  gotoObjective() {
    const stage = currentStage(G);
    if (!stage) return;
    if (stage.kind === 'steal' && G.mission.markedCar) {
      G.player.pos.copy(G.mission.markedCar.pos);
      enterCar(G.mission.markedCar);
      return;
    }
    this.teleport(stage.x, stage.z);
  },
  damage(n) { G.player.protectUntil = 0; G.damagePlayer(n, 'debug'); },
  kill() { G.player.protectUntil = 0; G.player.hp = 1; G.damagePlayer(50, 'debug'); },
  giveWeapon(key) { G.save.weapons[key].owned = true; G.save.weapons[key].ammo = 200; G.player.weapon = key; },
};

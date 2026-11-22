// main.js — Neon Bay Nights v8: boot, game loop, input, combat, wanted logic.
// A true-3D open-world crime game: explore Neon Bay on foot or by car,
// run 10 story jobs for fixer Marlowe, outrun 5 police dispatch tiers
// with helicopter air support, and save progress on this device.
// Screenshots stage deterministically with ?shot=1..4&seed=1 (see stageShot).
import * as THREE from 'three';
import { createWorld, updateWorld, WORLD_SIZE, roadCoords } from './world.js';
import { buildCity, updateCity, collideBuildings, districtAt } from './city.js';
import { spawnTraffic, spawnParked, updateTraffic, drivePlayerCar, nearestCar } from './vehicles.js';
import { makeCharacter, animateWalk, spawnPedestrians, updatePedestrian, updateChaseCamera } from './player.js';
import { PoliceSystem } from './police.js';
import { MissionRunner, JOBS } from './missions.js';
import { buildHud, updateHud } from './hud.js';
import * as Audio from './audio.js';
import { loadSave, writeSave } from './save.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');
const SEED = Number(params.get('seed') || 1);
function seededRandom(seed) {
  let s = (seed * 2654435761) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const rand = seededRandom(SEED);

// ---------- world ----------
const world = createWorld();
const city = buildCity(world.scene, SEED);
const colliders = city.colliders;
const traffic = spawnTraffic(world.scene, 26, rand);
const parked = spawnParked(world.scene, 22, rand);
const allCars = [...traffic, ...parked];
const peds = spawnPedestrians(world.scene, 34, rand);
const police = new PoliceSystem(world.scene);
const missions = new MissionRunner(world.scene);
const hud = buildHud();

// ---------- save / state ----------
const save = loadSave();
const state = {
  started: !!SHOT,
  paused: false,
  wasted: false,
  wastedTimer: 0,
  money: save.money,
  health: 100,
  armor: save.armor,
  clockMinutes: save.clockMinutes,
  weaponSlot: 1,
  ammo: { 2: save.weapons.pistol.ammo, 3: save.weapons.smg.ammo, 4: save.weapons.shotgun.ammo },
  owned: { 2: save.weapons.pistol.owned, 3: save.weapons.smg.owned, 4: save.weapons.shotgun.owned },
  respect: save.respect,
  radio: save.radio || 'Neon FM',
  spawnProtect: 4,
  heatDecay: 0,
  banner: '',
  bannerTimer: 0,
  hint: '',
  shotStaged: false,
};
Audio.setMuted(!!save.muted);
Audio.setRadio(state.radio);

// ---------- player ----------
const hero = makeCharacter(0x2e6fd8, 0x2b2f38);
hero.group.position.copy(city.garagePos);
world.scene.add(hero.group);
let playerCar = null;
let playerHeading = Math.PI;
let walkSpeed = 0;
let punchTimer = 0;
let fireCooldown = 0;
let flashTimer = 0;
const tracers = [];
const pickups = [];
const input = { forward: false, backward: false, left: false, right: false, handbrake: false };
let mouseDown = false;
let camYaw = Math.PI;

// pickups: health, armor, ammo, weapon unlocks
function addPickup(x, z, kind, color) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.9, 0.9),
    new THREE.MeshBasicMaterial({ color }),
  );
  mesh.position.set(x, 1, z);
  world.scene.add(mesh);
  pickups.push({ mesh, kind, x, z, taken: false });
}
addPickup(96, 84, 'health', 0xff4f4f);
addPickup(-144, -166, 'armor', 0x4fa3e8);
addPickup(-114, -114, 'smg', 0xffd94d);
addPickup(146, -124, 'shotgun', 0xff9d2e);
addPickup(156, 146, 'ammo', 0x8be89b);
addPickup(-34, 190, 'health', 0xff4f4f);
addPickup(20, 20, 'ammo', 0x8be89b);
addPickup(-60, 232, 'armor', 0x4fa3e8);

function playerPos() {
  return playerCar ? playerCar.group.position : hero.group.position;
}
function playerSpeedKmh() {
  return playerCar ? Math.abs(playerCar.speed) * 3.6 : walkSpeed * 3.6;
}

function persist() {
  writeSave({
    money: state.money,
    missionIndex: missions.jobIndex,
    respect: state.respect,
    weapons: {
      pistol: { owned: state.owned[2], ammo: state.ammo[2] },
      smg: { owned: state.owned[3], ammo: state.ammo[3] },
      shotgun: { owned: state.owned[4], ammo: state.ammo[4] },
    },
    health: state.health,
    armor: state.armor,
    radio: state.radio,
    muted: Audio.isMuted(),
    clockMinutes: state.clockMinutes,
    jobsDone: Math.min(missions.jobIndex, JOBS.length),
  });
}

function showBanner(text, seconds = 2.6) {
  state.banner = text;
  state.bannerTimer = seconds;
}

function addHeat(amount) {
  if (state.spawnProtect > 0) return;
  const before = police.wanted;
  police.setWanted(Math.min(5, police.wanted + amount));
  state.heatDecay = 0;
  if (police.wanted > before) {
    const tier = police.tier();
    showBanner(`WANTED ${'★'.repeat(police.wanted)} — ${tier ? tier.name.toUpperCase() : ''}`);
  }
}

function damagePlayer(amount) {
  if (state.spawnProtect > 0 || state.wasted) return;
  let rest = amount;
  if (state.armor > 0) {
    const absorbed = Math.min(state.armor, rest * 0.6);
    state.armor -= absorbed;
    rest -= absorbed;
  }
  state.health -= rest;
  if (state.health <= 0) die();
}

function die() {
  state.wasted = true;
  state.wastedTimer = 2.4;
  hud.wastedScreen.style.display = 'flex';
  police.clear();
  Audio.setSiren(false);
  Audio.setEngine(0, false);
}

function respawn() {
  state.wasted = false;
  state.health = 100;
  state.armor = Math.max(state.armor, 10);
  state.spawnProtect = 4;
  if (playerCar) exitCar(true);
  hero.group.position.copy(city.hospitalPos);
  playerHeading = Math.PI;
  hud.wastedScreen.style.display = 'none';
  persist();
}

function enterCar(car) {
  playerCar = car;
  car.playerDriven = true;
  car.parked = false;
  hero.group.visible = false;
  playerHeading = car.heading;
  Audio.audioResume();
  if (car.police) addHeat(1);
  else if (traffic.includes(car)) addHeat(1);
}

function exitCar(silent = false) {
  if (!playerCar) return;
  const car = playerCar;
  car.playerDriven = false;
  car.speed = 0;
  const pos = car.group.position;
  hero.group.position.set(pos.x + Math.cos(car.heading) * 2.2, 0, pos.z - Math.sin(car.heading) * 2.2);
  hero.group.visible = true;
  playerHeading = car.heading;
  playerCar = null;
  if (!silent) Audio.playUi();
}

function fireWeapon() {
  if (playerCar || fireCooldown > 0) return;
  const slot = state.weaponSlot;
  hero.gun.visible = slot > 1;
  if (slot === 1) {
    fireCooldown = 0.38;
    punchTimer = 0.25;
    Audio.playPunch();
    const pos = hero.group.position;
    for (const ped of peds) {
      if (ped.group.position.distanceTo(pos) < 2.2) {
        ped.flee = 3;
        addHeat(1);
      }
    }
    return;
  }
  if (!state.owned[slot] || state.ammo[slot] <= 0) {
    Audio.playUi();
    return;
  }
  state.ammo[slot] -= 1;
  const kind = slot === 2 ? 'pistol' : slot === 3 ? 'smg' : 'shotgun';
  fireCooldown = slot === 2 ? 0.32 : slot === 3 ? 0.11 : 0.85;
  Audio.playShot(kind);
  flashTimer = 0.07;
  hero.flash.material.opacity = 0.95;
  hero.flash.rotation.z = rand() * Math.PI;
  // tracer from muzzle forward
  const origin = new THREE.Vector3();
  hero.muzzle.getWorldPosition(origin);
  const dir = new THREE.Vector3(Math.sin(playerHeading), 0.02, Math.cos(playerHeading));
  const pellets = slot === 4 ? 5 : 1;
  for (let i = 0; i < pellets; i++) {
    const spread = slot === 4 ? (rand() - 0.5) * 0.14 : (rand() - 0.5) * 0.02;
    const end = origin.clone().add(dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), spread).multiplyScalar(38));
    const geo = new THREE.BufferGeometry().setFromPoints([origin, end]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.9 }));
    world.scene.add(line);
    tracers.push({ line, life: 0.09 });
  }
  // hits: pedestrians flee, police cars take damage, heat rises
  const pos = hero.group.position;
  for (const ped of peds) {
    if (ped.group.position.distanceTo(pos) < 18) ped.flee = 3;
  }
  for (const car of [...allCars, ...police.units]) {
    const d = car.group.position.distanceTo(pos);
    if (d < 30) {
      const toCar = Math.atan2(car.group.position.x - pos.x, car.group.position.z - pos.z);
      let diff = Math.abs(toCar - playerHeading);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff < 0.22) {
        car.health = Math.max(0, car.health - (slot === 4 ? 26 : slot === 3 ? 7 : 11));
        if (car.health <= 40) addHeat(1);
      }
    }
  }
  addHeat(1);
  persist();
}

// ---------- input ----------
const keyMap = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'backward', ArrowDown: 'backward',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'handbrake',
};
window.addEventListener('keydown', (e) => {
  if (keyMap[e.code]) input[keyMap[e.code]] = true;
  if (!state.started) return;
  Audio.audioResume();
  if (e.code === 'KeyE') {
    if (playerCar) exitCar();
    else {
      const car = nearestCar([...allCars, ...police.units], hero.group.position, 4.2);
      if (car) enterCar(car);
    }
  }
  if (e.code === 'KeyF') fireWeapon();
  if (e.code === 'Digit1') state.weaponSlot = 1;
  if (e.code === 'Digit2') state.weaponSlot = 2;
  if (e.code === 'Digit3') state.weaponSlot = 3;
  if (e.code === 'Digit4') state.weaponSlot = 4;
  if (e.code === 'KeyR') {
    const order = ['Neon FM', 'Bay Talk', 'Off'];
    state.radio = order[(order.indexOf(state.radio) + 1) % order.length];
    Audio.setRadio(state.radio);
    showBanner(`RADIO: ${state.radio}`, 1.6);
    persist();
  }
  if (e.code === 'KeyH') Audio.playHorn();
  if (e.code === 'KeyM') {
    Audio.setMuted(!Audio.isMuted());
    showBanner(Audio.isMuted() ? 'SOUND OFF' : 'SOUND ON', 1.4);
    persist();
  }
  if (e.code === 'KeyP') {
    state.paused = !state.paused;
    hud.pauseScreen.style.display = state.paused ? 'flex' : 'none';
  }
});
window.addEventListener('keyup', (e) => {
  if (keyMap[e.code]) input[keyMap[e.code]] = false;
});
window.addEventListener('mousedown', () => { mouseDown = true; Audio.audioResume(); });
window.addEventListener('mouseup', () => { mouseDown = false; });
window.addEventListener('mousemove', (e) => {
  if (!playerCar && state.started) {
    camYaw -= e.movementX * 0.0022;
    playerHeading = camYaw;
  }
});
hud.startBtn.addEventListener('click', () => {
  state.started = true;
  hud.titleScreen.style.display = 'none';
  Audio.audioResume();
  Audio.playUi();
  missions.start(save.missionIndex || 0);
});

// ---------- shot staging (deterministic screenshots) ----------
function stageShot(n) {
  state.started = true;
  hud.titleScreen.style.display = 'none';
  missions.start(Math.min(save.missionIndex || 0, 3));
  const roads = roadCoords();
  if (n === '1') {
    // cover: mid-chase at speed, police close behind, heli overhead
    const car = parked[0] || traffic[0];
    car.group.position.set(-8, 0, 60);
    car.heading = 0;
    car.speed = 44;
    enterCar(car);
    state.spawnProtect = 0;
    police.setWanted(4);
    missions.start(0);
    missions.stageIndex = 1;
    missions.placeMarker();
    missions.dialogue = JOBS[0].brief;
    missions.dialogueTimer = 30;
    state.money = 2450;
    state.weaponSlot = 2;
  } else if (n === '2') {
    hero.group.position.set(4, 0, 96);
    playerHeading = 0.4;
    camYaw = 0.4;
    state.weaponSlot = 3;
    state.owned[3] = true;
    state.ammo[3] = 90;
    hero.gun.visible = true;
    state.spawnProtect = 0;
    police.setWanted(3);
    missions.start(1);
    missions.dialogue = JOBS[1].brief;
    missions.dialogueTimer = 30;
    state.money = 3800;
  } else if (n === '3') {
    const car = parked[1] || traffic[1];
    car.group.position.set(148, 0, 196);
    car.heading = Math.PI / 2;
    car.speed = 22;
    enterCar(car);
    missions.start(5);
    missions.stageIndex = 1;
    missions.placeMarker();
    missions.dialogue = JOBS[5].brief;
    missions.dialogueTimer = 30;
    state.money = 6400;
    state.respect = { Downtown: 12, Beachfront: 18, 'Old Town': 6, Marina: 9 };
  } else if (n === '4') {
    const car = parked[2] || traffic[2];
    car.group.position.set(60, 0, 96);
    car.heading = 0;
    car.speed = 38;
    enterCar(car);
    state.spawnProtect = 0;
    police.setWanted(5);
    missions.start(9);
    missions.stageIndex = 1;
    missions.placeMarker();
    missions.dialogue = JOBS[9].brief;
    missions.dialogueTimer = 30;
    showBanner('DISPATCH TIER 5: MAXIMUM RESPONSE', 30);
    state.money = 9200;
  }
  // seed police units around the player immediately
  police.ensureUnits(playerPos(), rand);
  police.units.forEach((u, i) => {
    const p = playerPos();
    const back = 12 + i * 3.5;
    const side = (i - 1.5) * 3.4;
    const h = playerCar ? playerCar.heading : playerHeading;
    u.group.position.set(p.x - Math.sin(h) * back + Math.cos(h) * side, 0, p.z - Math.cos(h) * back - Math.sin(h) * side);
    u.heading = h;
    u.group.rotation.y = h;
    u.speed = playerCar ? playerCar.speed : 8;
    u.distance = Math.round(back);
  });
  if (police.heli) {
    const p = playerPos();
    const h = playerCar ? playerCar.heading : playerHeading;
    // ahead and above, so the chase camera frames it with its light cone
    police.heli.group.position.set(p.x + Math.sin(h) * 20, 17, p.z + Math.cos(h) * 20);
    police.heli.orbit = h;
    police.heli.pool.position.set(p.x, 0.12, p.z);
  }
  // cluster traffic nearby so streets read busy
  traffic.slice(0, 10).forEach((car, i) => {
    const p = playerPos();
    car.group.position.set(p.x + (i - 5) * 7, 0, p.z + 26 + (i % 3) * 8);
    car.heading = Math.PI;
    car.group.rotation.y = Math.PI;
    car.axis = 'z';
    car.road = roads[5];
    car.lane = 3;
    car.speed = 10;
  });
  peds.slice(0, 10).forEach((ped, i) => {
    const p = playerPos();
    ped.group.position.set(p.x + (i - 5) * 4.5, 0, p.z + 12 + (i % 2) * 5);
    ped.heading = Math.PI + i * 0.3;
  });
  // camera snap behind the action
  const h = playerCar ? playerCar.heading : playerHeading;
  updateChaseCamera(world.camera, playerPos(), h, !!playerCar, 0, true);
  state.shotStaged = true;
  window.__neonReady = true;
}

// ---------- main loop ----------
let last = performance.now();
let saveTimer = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!state.started) {
    // title backdrop: slow orbit over the bay
    const t = now * 0.00008;
    world.camera.position.set(Math.sin(t) * 90, 34, 60 + Math.cos(t) * 90);
    world.camera.lookAt(0, 4, 60);
    updateWorld(world, dt, new THREE.Vector3(0, 0, 60));
    updateCity(city, now);
    world.renderer.render(world.scene, world.camera);
    return;
  }
  if (state.paused) {
    world.renderer.render(world.scene, world.camera);
    return;
  }
  if (SHOT && !state.shotStaged) stageShot(SHOT);

  state.spawnProtect = Math.max(0, state.spawnProtect - dt);
  state.clockMinutes += dt * 0.6;
  if (state.bannerTimer > 0) {
    state.bannerTimer -= dt;
    if (state.bannerTimer <= 0) state.banner = '';
  }
  fireCooldown = Math.max(0, fireCooldown - dt);
  punchTimer = Math.max(0, punchTimer - dt);
  if (flashTimer > 0) {
    flashTimer -= dt;
    if (flashTimer <= 0) hero.flash.material.opacity = 0;
  }
  if (mouseDown && !playerCar) fireWeapon();

  // ----- player movement -----
  const pos = playerPos();
  if (playerCar) {
    drivePlayerCar(playerCar, input, dt);
    collideBuildings(playerCar.group.position, 2.1, colliders);
    playerCar.group.position.x = THREE.MathUtils.clamp(playerCar.group.position.x, -236, 236);
    playerCar.group.position.z = THREE.MathUtils.clamp(playerCar.group.position.z, -236, 268);
    // collisions with traffic damage both cars gently
    for (const car of allCars) {
      if (car === playerCar) continue;
      const d = car.group.position.distanceTo(playerCar.group.position);
      if (d < 3.6) {
        const push = car.group.position.clone().sub(playerCar.group.position).normalize().multiplyScalar(0.12);
        car.group.position.add(push);
        playerCar.health = Math.max(0, playerCar.health - 0.4);
        car.health = Math.max(0, car.health - 0.4);
        if (Math.abs(playerCar.speed) > 12) {
          Audio.playCrash();
          addHeat(1);
          damagePlayer(2);
        }
      }
    }
    if (playerCar.health <= 0) {
      showBanner('CAR WRECKED — FIND ANOTHER (E)');
      exitCar(true);
    }
    playerHeading = playerCar.heading;
    state.hint = 'WASD drive · Space handbrake · E exit car · R radio';
  } else {
    const sprint = input.handbrake ? 1.7 : 1;
    walkSpeed = 0;
    const move = new THREE.Vector3();
    if (input.forward) move.z += 1;
    if (input.backward) move.z -= 1;
    if (input.left) move.x -= 1;
    if (input.right) move.x += 1;
    if (move.lengthSq() > 0) {
      move.normalize();
      const sin = Math.sin(playerHeading);
      const cos = Math.cos(playerHeading);
      const wx = move.x * cos + move.z * sin;
      const wz = -move.x * sin + move.z * cos;
      walkSpeed = 4.6 * sprint;
      hero.group.position.x += wx * walkSpeed * dt;
      hero.group.position.z += wz * walkSpeed * dt;
    }
    hero.group.position.x = THREE.MathUtils.clamp(hero.group.position.x, -236, 236);
    hero.group.position.z = THREE.MathUtils.clamp(hero.group.position.z, -236, 268);
    collideBuildings(hero.group.position, 0.6, colliders);
    hero.group.rotation.y = playerHeading;
    animateWalk(hero, walkSpeed, dt, state.weaponSlot > 1);
    hero.gun.visible = state.weaponSlot > 1;
    if (punchTimer > 0) hero.armR.rotation.x = -1.4;
    const near = nearestCar([...allCars, ...police.units], hero.group.position, 4.2);
    state.hint = near ? `Press E to steal the ${near.model.name}` : 'WASD walk · E steal car · Click/F attack · 1–4 weapons';
  }

  // ----- traffic + peds -----
  const obstacles = [pos, ...allCars.map((c) => c.group.position)];
  for (const car of traffic) updateTraffic(car, dt, rand, obstacles);
  for (const ped of peds) updatePedestrian(ped, dt, rand, police.wanted > 0 ? pos : null);

  // ----- police -----
  police.update(dt, pos, playerCar ? Math.abs(playerCar.speed) : walkSpeed, colliders, rand, () => {
    if (playerCar) damagePlayer(1.2);
    else damagePlayer(3);
  });
  // heat decay when unseen / at the garage
  const atGarage = pos.distanceTo(city.garagePos) < 9;
  if (police.wanted > 0 && !SHOT) {
    state.heatDecay += dt;
    const decayTime = atGarage ? 6 : 26;
    if (state.heatDecay > decayTime) {
      state.heatDecay = 0;
      police.setWanted(police.wanted - 1);
      if (police.wanted === 0) showBanner('YOU LOST THE POLICE');
    }
  }
  Audio.setSiren(police.wanted > 0, Math.min(1.4, 0.5 + police.wanted * 0.2));
  Audio.setEngine(playerSpeedKmh(), !!playerCar);

  // ----- missions -----
  const result = missions.update(dt, {
    playerPos: pos,
    inCar: !!playerCar,
    carModelName: playerCar ? playerCar.model.name : '',
    wanted: police.wanted,
  });
  if (result === 'job') {
    const job = missions.job();
    state.money += job.reward;
    state.respect[job.district] = (state.respect[job.district] || 0) + 4;
    Audio.playCash();
    showBanner(`JOB COMPLETE +$${job.reward}`);
    const hadNext = missions.nextJob();
    if (!hadNext) showBanner('ALL 10 JOBS COMPLETE — NEON BAY IS YOURS', 5);
    persist();
  } else if (result === 'stage') {
    Audio.playUi();
    persist();
  }

  // ----- pickups -----
  for (const p of pickups) {
    if (p.taken) continue;
    p.mesh.rotation.y += dt * 2;
    p.mesh.position.y = 1 + Math.sin(now * 0.003 + p.x) * 0.18;
    if (pos.distanceTo(new THREE.Vector3(p.x, 0, p.z)) < 2.4) {
      p.taken = true;
      p.mesh.visible = false;
      Audio.playPickup();
      if (p.kind === 'health') { state.health = Math.min(100, state.health + 50); showBanner('+50 HEALTH', 1.6); }
      if (p.kind === 'armor') { state.armor = Math.min(100, state.armor + 50); showBanner('+50 ARMOR', 1.6); }
      if (p.kind === 'ammo') { state.ammo[2] += 30; state.ammo[3] += 40; state.ammo[4] += 8; showBanner('AMMO RESTOCKED', 1.6); }
      if (p.kind === 'smg') { state.owned[3] = true; state.ammo[3] += 60; state.weaponSlot = 3; showBanner('SMG UNLOCKED (3)', 2.2); }
      if (p.kind === 'shotgun') { state.owned[4] = true; state.ammo[4] += 12; state.weaponSlot = 4; showBanner('SHOTGUN UNLOCKED (4)', 2.2); }
      persist();
    }
  }

  // ----- tracers -----
  for (let i = tracers.length - 1; i >= 0; i--) {
    tracers[i].life -= dt;
    if (tracers[i].life <= 0) {
      world.scene.remove(tracers[i].line);
      tracers.splice(i, 1);
    }
  }

  // ----- wasted / respawn -----
  if (state.wasted) {
    state.wastedTimer -= dt;
    if (state.wastedTimer <= 0) respawn();
  }

  // ----- camera + world -----
  updateChaseCamera(world.camera, pos, playerHeading, !!playerCar, dt, !!SHOT && state.shotStaged && !frame._camSnapped);
  if (SHOT) frame._camSnapped = true;
  updateWorld(world, dt, pos);
  updateCity(city, now);

  // ----- HUD -----
  const tier = police.tier();
  updateHud(hud, {
    money: state.money,
    clockMinutes: state.clockMinutes,
    wanted: police.wanted,
    job: missions.job(),
    jobIndex: missions.jobIndex,
    stageIndex: missions.stageIndex,
    stage: missions.stage(),
    missionTimer: missions.timer,
    tier,
    policeUnits: police.units,
    heli: !!police.heli,
    roadblocks: police.roadblocks.length > 0,
    district: districtAt(pos.x, pos.z),
    respect: state.respect,
    radio: state.radio,
    speedKmh: playerSpeedKmh(),
    vehicleName: playerCar ? playerCar.model.name : 'On foot',
    vehicleCondition: playerCar ? playerCar.health : 100,
    health: state.health,
    armor: state.armor,
    weaponSlot: state.weaponSlot,
    ammo: state.ammo,
    owned: state.owned,
    dialogue: missions.dialogue,
    dialogueTimer: missions.dialogueTimer,
    banner: state.banner,
    hint: state.hint,
    playerPos: pos,
    heading: playerHeading,
    policePositions: police.units.map((u) => u.group.position),
    heliPos: police.heli ? police.heli.group.position : null,
    targetPos: missions.targetPos(),
  });

  saveTimer += dt;
  if (saveTimer > 8) {
    saveTimer = 0;
    persist();
  }

  world.renderer.render(world.scene, world.camera);
  if (SHOT && state.shotStaged) window.__neonReady = true;
}
requestAnimationFrame(frame);
window.__neon = { state, missions, police, hero, allCars, traffic, parked, peds, get playerCar() { return playerCar; } };

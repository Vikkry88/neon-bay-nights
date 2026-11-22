// Neon Bay Nights — main game: loop, player + car physics, police AI with
// standoff/ram/back-off (never pins the player), helicopter, combat, the
// ten-job story, wanted system, garage, pickups, particles and camera.

import { WORLD, TUNING, WEAPONS, DISPATCH_TIERS, RADIO_STATIONS, districtAt } from './config.js';
import { clamp, dist, angleLerp } from './random.js';
import { createInput, clearPressed, axisX, axisY } from './input.js';
import { createAudio } from './audio.js';
import { buildCity, pushOutOfBuildings, clampToWorld, nearestRoadPoint } from './city.js';
import { spawnTraffic, spawnParked, spawnPeds, spawnPickups, makeCar, updateTrafficCar, updatePed } from './world.js';
import { JOBS, jobAt } from './missions.js';
import { loadSave, storeSave, wipeSave, freshSave } from './save.js';
import { drawWorld, drawCar, drawPed, drawPlayer, drawHelicopter, drawParticles, drawTracers } from './render.js';
import { drawHud, drawStartScreen, drawPauseScreen, drawDeathScreen } from './hud.js';
import { shotNameFromQuery, seedFromQuery, applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const input = createInput(canvas);
const audio = createAudio();

const seed = seedFromQuery();
const city = buildCity(seed);
const view = { w: 1280, h: 720 };

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  view.w = canvas.width;
  view.h = canvas.height;
}
window.addEventListener('resize', resize);
resize();

const save = loadSave();

const state = {
  mode: 'start',           // start | play | pause | dead
  time: 0,
  seed,
  save,
  player: {
    x: TUNING.safeSpawn.x, y: TUNING.safeSpawn.y,
    angle: 0, vx: 0, vy: 0, speed: 0,
    health: 100, armor: 0,
    inCar: false, car: null, carSpeedKmh: 0,
    protect: TUNING.spawnProtectSeconds,
    fireCooldown: 0, bustTimer: 0,
  },
  camera: { x: TUNING.safeSpawn.x, y: TUNING.safeSpawn.y, shake: 0 },
  wanted: 0,
  heat: 0,                 // fractional heat; stars = ceil
  lastSeen: 0,
  police: [],
  heli: { active: false, x: 0, y: 0, angle: 0, spotX: 0, spotY: 0 },
  traffic: spawnTraffic(city, seed),
  parked: spawnParked(city, seed),
  peds: spawnPeds(city, seed),
  pickups: spawnPickups(city, seed),
  particles: [],
  tracers: [],
  job: null,
  stageIndex: 0,
  stageLabel: '',
  missionMarker: null,
  missionTime: 0,
  storyDone: false,
  district: districtAt(TUNING.safeSpawn.x, TUNING.safeSpawn.y),
  weaponIndex: 0,
  wheelOpen: false,
  dialogue: '',
  dialogueTime: 0,
  bannerTime: 0,
  message: '',
  messageTime: 0,
  hintTime: 14,
  garageTimer: 0,
  shot: null,
  frozen: false,
  lastTier: 0,
  gunfire: false,
};

function say(text, seconds = 6) {
  state.dialogue = text;
  state.dialogueTime = seconds;
}

function flash(text, seconds = 2.5) {
  state.message = text;
  state.messageTime = seconds;
}

function burst(x, y, color, count, speed, life, size) {
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.3 + Math.random() * 0.7);
    state.particles.push({
      x, y,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      life: life * (0.5 + Math.random() * 0.5), maxLife: life,
      color, size: size * (0.6 + Math.random() * 0.8),
    });
  }
}

function addHeat(amount) {
  state.heat = clamp(state.heat + amount, 0, 5);
  state.lastSeen = state.time;
  const stars = Math.ceil(state.heat);
  if (stars > state.wanted) {
    state.wanted = stars;
    state.bannerTime = 3;
    audio.alarm();
    if (stars > save.bestWanted) save.bestWanted = stars;
  }
}

function startJob(index) {
  const job = jobAt(index);
  state.job = job;
  state.stageIndex = 0;
  state.storyDone = !job;
  if (!job) {
    state.missionMarker = null;
    state.stageLabel = '';
    return;
  }
  state.missionTime = job.time;
  setStage(0);
  say(job.brief, 9);
}

function setStage(index) {
  const job = state.job;
  state.stageIndex = index;
  const stage = job.stages[index];
  state.stageLabel = stage.label;
  const p = nearestRoadPoint(stage.at[0], stage.at[1]);
  state.missionMarker = { x: p.x, y: p.y };
}

function completeJob() {
  const job = state.job;
  save.money += job.reward;
  save.jobsDone += 1;
  save.missionIndex = Math.min(JOBS.length, save.missionIndex + 1);
  save.respect[job.district] = clamp((save.respect[job.district] || 0) + 12, 0, 100);
  audio.cash();
  burst(state.player.x, state.player.y, '#7bf1a8', 26, 160, 0.8, 4);
  flash(`Job complete: ${job.title}  +$${job.reward.toLocaleString('en-US')}`, 3.5);
  say(job.done, 7);
  storeSave(save);
  startJob(save.missionIndex);
}

function failJob() {
  say('Marlowe: "Too slow. The job is burned — run it again, faster."', 7);
  flash('Job failed — try again', 3);
  audio.alarm();
  startJob(save.missionIndex);
}

function nearestEnterableCar() {
  const p = state.player;
  let best = null;
  let bestD = 52;
  for (const car of [...state.parked, ...state.traffic, ...state.police]) {
    const d = dist(p.x, p.y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function enterCar(car) {
  const p = state.player;
  p.inCar = true;
  p.car = car;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  if (car.kind === 'traffic' || car.kind === 'police') {
    car.kind = 'player';
    addHeat(0.6); // stealing a car draws attention
    flash('Car stolen!', 1.6);
  } else {
    car.kind = 'player';
  }
  audio.door();
  burst(car.x, car.y, '#ffffff', 6, 60, 0.4, 3);
}

function exitCar() {
  const p = state.player;
  if (!p.car) return;
  const car = p.car;
  car.kind = 'parked';
  car.speed = 0;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
  p.inCar = false;
  p.car = null;
  p.carSpeedKmh = 0;
  audio.door();
}

function damagePlayer(amount) {
  const p = state.player;
  if (p.protect > 0 || state.mode !== 'play') return;
  let left = amount;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, left * 0.6);
    p.armor -= absorbed;
    left -= absorbed;
  }
  p.health -= left;
  state.camera.shake = Math.max(state.camera.shake, 5);
  audio.hit();
  if (p.health <= 0) {
    p.health = 0;
    state.mode = 'dead';
    audio.death();
    audio.setEngine(0, false);
    audio.setSiren(false);
  }
}

function respawn() {
  const p = state.player;
  p.x = TUNING.safeSpawn.x;
  p.y = TUNING.safeSpawn.y;
  p.health = 100;
  p.armor = 0;
  p.inCar = false;
  p.car = null;
  p.carSpeedKmh = 0;
  p.protect = TUNING.spawnProtectSeconds;
  p.bustTimer = 0;
  state.wanted = 0;
  state.heat = 0;
  state.police = [];
  state.heli.active = false;
  save.money = Math.max(0, save.money - 100);
  storeSave(save);
  state.mode = 'play';
  flash('Back on the street (−$100 hospital bill)', 3);
  if (state.job) startJob(save.missionIndex);
}

function fireWeapon() {
  const p = state.player;
  const weapon = WEAPONS[state.weaponIndex];
  if (p.fireCooldown > 0) return;
  if (weapon.id !== 'fists') {
    if ((save.ammo[weapon.id] || 0) <= 0) {
      p.fireCooldown = 0.3;
      flash(`No ${weapon.name} ammo — find a pickup`, 1.4);
      audio.blip();
      return;
    }
    save.ammo[weapon.id] -= 1;
  }
  p.fireCooldown = weapon.fireRate;
  state.gunfire = true;
  audio.shot(weapon.id);
  state.camera.shake = Math.max(state.camera.shake, weapon.id === 'shotgun' ? 5 : 2);
  const originX = p.x + Math.cos(p.angle) * 16;
  const originY = p.y + Math.sin(p.angle) * 16;
  burst(originX, originY, '#ffe66d', 3, 90, 0.15, 3);

  for (let pellet = 0; pellet < weapon.pellets; pellet += 1) {
    const spread = (Math.random() - 0.5) * 2 * weapon.spread;
    const angle = p.angle + spread;
    let endX = originX + Math.cos(angle) * weapon.range;
    let endY = originY + Math.sin(angle) * weapon.range;
    let bestT = 1;

    const targets = [];
    for (const ped of state.peds) targets.push({ obj: ped, r: 12, type: 'ped' });
    for (const car of [...state.traffic, ...state.parked, ...state.police]) targets.push({ obj: car, r: 26, type: 'car' });
    for (const t of targets) {
      const relX = t.obj.x - originX;
      const relY = t.obj.y - originY;
      const along = relX * Math.cos(angle) + relY * Math.sin(angle);
      if (along < 0 || along > weapon.range) continue;
      const perp = Math.abs(-relX * Math.sin(angle) + relY * Math.cos(angle));
      if (perp < t.r && along / weapon.range < bestT) {
        bestT = along / weapon.range;
        endX = originX + Math.cos(angle) * along;
        endY = originY + Math.sin(angle) * along;
        hitTarget(t, weapon.damage, angle);
      }
    }
    if (weapon.tracer) {
      state.tracers.push({ x1: originX, y1: originY, x2: endX, y2: endY, color: weapon.tracer, life: 0.09, maxLife: 0.09 });
    }
  }
}

function hitTarget(target, damage, angle) {
  const obj = target.obj;
  burst(obj.x, obj.y, target.type === 'ped' ? '#ff5d8f' : '#ffb703', 8, 120, 0.4, 3);
  if (target.type === 'ped') {
    obj.health -= damage;
    obj.panic = 3;
    addHeat(0.8);
    if (obj.health <= 0) {
      obj.health = 30;
      obj.x = TUNING.safeSpawn.x + (Math.random() - 0.5) * 800;
      obj.y = TUNING.safeSpawn.y + (Math.random() - 0.5) * 800;
      addHeat(0.7);
      flash('Pedestrian down — heat rising!', 1.8);
    }
  } else {
    obj.health -= damage;
    obj.x += Math.cos(angle) * 4;
    obj.y += Math.sin(angle) * 4;
    addHeat(obj.kind === 'police' ? 1.2 : 0.5);
    if (obj.health <= 0) {
      obj.health = 100;
      burst(obj.x, obj.y, '#ff8500', 30, 220, 0.9, 5);
      audio.crash();
      state.camera.shake = Math.max(state.camera.shake, 8);
      const p = nearestRoadPoint(obj.x + 400, obj.y + 400);
      obj.x = p.x;
      obj.y = p.y;
      obj.speed = 0;
    }
  }
}

function spawnPoliceUnit() {
  const p = state.player;
  const angle = Math.random() * Math.PI * 2;
  const distSpawn = 520 + Math.random() * 160;
  const spot = nearestRoadPoint(p.x + Math.cos(angle) * distSpawn, p.y + Math.sin(angle) * distSpawn);
  const car = makeCar(spot.x, spot.y, angle + Math.PI, '#f5f6fa', 'police');
  car.sirenPhase = Math.random() * 6;
  state.police.push(car);
}

function updatePolice(dt) {
  const p = state.player;
  const tier = DISPATCH_TIERS[state.wanted];
  const wantUnits = state.wanted > 0 ? tier.units : 0;
  while (state.police.length < wantUnits) spawnPoliceUnit();
  if (state.wanted === 0) state.police = state.police.filter((c) => dist(c.x, c.y, p.x, p.y) < 900);
  state.police = state.police.filter((c) => c.kind === 'police');

  const playerSpeed = p.inCar ? Math.abs(p.car.speed) : p.speed;
  const playerSlow = playerSpeed < 55;

  for (const cop of state.police) {
    cop.ramCooldown = Math.max(0, cop.ramCooldown - dt);
    cop.backoff = Math.max(0, cop.backoff - dt);
    const d = dist(cop.x, cop.y, p.x, p.y);
    const toPlayer = Math.atan2(p.y - cop.y, p.x - cop.x);

    // Corner-pocket escape: if the player is slow/crawling and a unit is
    // close, the unit backs off — the player can always get out.
    if (playerSlow && d < 120 && cop.backoff <= 0) cop.backoff = 1.8;

    let targetSpeed = tier.speed;
    let desiredAngle = toPlayer;
    if (cop.backoff > 0) {
      desiredAngle = toPlayer + Math.PI;
      targetSpeed = 190;
    } else if (d < TUNING.policeStandoff) {
      // Inside the standoff ring: hold position, nose toward the player.
      desiredAngle = toPlayer;
      targetSpeed = 0;
      // Gentle push-out so units never overlap the player.
      const push = (TUNING.policeStandoff - d) * 0.5;
      cop.x -= Math.cos(toPlayer) * push * dt * 4;
      cop.y -= Math.sin(toPlayer) * push * dt * 4;
    } else if (d < 150) {
      targetSpeed = tier.speed * 0.55;
    }

    // Gentle ram: only when the player is driving, with a cooldown, and the
    // unit backs off right after so it can never pin the player.
    if (p.inCar && d < 96 && cop.ramCooldown <= 0 && cop.backoff <= 0 && playerSpeed > 30) {
      cop.ramCooldown = TUNING.policeRamCooldown;
      cop.backoff = 1.4;
      p.car.speed *= 0.82;
      p.car.health -= 4;
      damagePlayer(2);
      burst(p.x, p.y, '#ffb703', 10, 140, 0.4, 3);
      audio.crash();
      state.camera.shake = Math.max(state.camera.shake, 4);
    }

    cop.angle = angleLerp(cop.angle, desiredAngle, Math.min(1, dt * 3.2));
    cop.speed += (targetSpeed - cop.speed) * Math.min(1, dt * 2.4);
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    pushOutOfBuildings(city, cop, TUNING.carRadius);
    clampToWorld(cop, TUNING.carRadius);
    cop.sirenPhase += dt * 10;
  }

  // Busted: on foot, slow, police close for 2.5s.
  if (!p.inCar && state.wanted > 0 && p.protect <= 0) {
    const close = state.police.some((c) => dist(c.x, c.y, p.x, p.y) < 78);
    if (close && p.speed < 70) {
      p.bustTimer += dt;
      if (p.bustTimer > 2.5) {
        flash('BUSTED!', 3);
        p.health = 0;
        state.mode = 'dead';
        audio.death();
      }
    } else {
      p.bustTimer = Math.max(0, p.bustTimer - dt);
    }
  }

  // Helicopter at 3+ stars.
  state.heli.active = state.wanted >= 3;
  if (state.heli.active) {
    const hx = p.x + Math.cos(state.time * 0.35) * 120;
    const hy = p.y + Math.sin(state.time * 0.35) * 120 - 60;
    state.heli.x += (hx - state.heli.x) * Math.min(1, dt * 1.6);
    state.heli.y += (hy - state.heli.y) * Math.min(1, dt * 1.6);
    state.heli.angle = angleLerp(state.heli.angle, Math.atan2(p.y - state.heli.y, p.x - state.heli.x), Math.min(1, dt * 2));
    state.heli.spotX = p.x;
    state.heli.spotY = p.y;
    state.lastSeen = state.time;
  }
}

function updatePlayerOnFoot(dt) {
  const p = state.player;
  const ax = axisX(input);
  const ay = axisY(input);
  const sprint = input.held.has('shift') ? TUNING.playerSprintSpeed : TUNING.playerWalkSpeed;
  const len = Math.hypot(ax, ay) || 1;
  const moving = ax !== 0 || ay !== 0;
  p.vx = moving ? (ax / len) * sprint : 0;
  p.vy = moving ? (ay / len) * sprint : 0;
  p.speed = Math.hypot(p.vx, p.vy);
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  pushOutOfBuildings(city, p, TUNING.playerRadius);
  clampToWorld(p, TUNING.playerRadius);

  // Aim at the mouse (screen → world); face travel direction when not aiming.
  const worldMouseX = state.camera.x + (input.mouseX - view.w / 2);
  const worldMouseY = state.camera.y + (input.mouseY - view.h / 2);
  if (input.mouseDown) {
    p.angle = Math.atan2(worldMouseY - p.y, worldMouseX - p.x);
  } else if (moving) {
    p.angle = Math.atan2(p.vy, p.vx);
  }
  if (input.mouseDown && !state.wheelOpen) fireWeapon();
}

function updatePlayerCar(dt) {
  const p = state.player;
  const car = p.car;
  const throttle = (input.held.has('w') || input.held.has('arrowup')) ? 1 : 0;
  const brake = (input.held.has('s') || input.held.has('arrowdown')) ? 1 : 0;
  const steer = axisX(input);

  if (throttle) car.speed += TUNING.carAccel * dt;
  if (brake) {
    if (car.speed > 12) car.speed -= TUNING.carBrake * dt;
    else car.speed -= TUNING.carAccel * 0.55 * dt;
  }
  // Drag + rolling resistance.
  car.speed -= car.speed * 0.55 * dt;
  if (!throttle && !brake) car.speed -= car.speed * 0.8 * dt;
  car.speed = clamp(car.speed, -TUNING.carReverseMax, TUNING.carMaxSpeed);

  // Steering stays usable when crawling: authority never drops below 35%.
  const authority = clamp(Math.abs(car.speed) / 130, 0.35, 1);
  const direction = car.speed >= 0 ? 1 : -1;
  car.angle += steer * 2.4 * authority * direction * dt;

  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;

  if (pushOutOfBuildings(city, car, TUNING.carRadius)) {
    if (Math.abs(car.speed) > 160) {
      damagePlayer(6);
      audio.crash();
      burst(car.x, car.y, '#ffb703', 14, 160, 0.5, 3);
    }
    car.speed *= 0.35;
    state.camera.shake = Math.max(state.camera.shake, 3);
  }
  clampToWorld(car, TUNING.carRadius);

  // Collide with other cars (circle push-apart, gentle).
  for (const other of [...state.traffic, ...state.parked, ...state.police]) {
    if (other === car) continue;
    const d = dist(car.x, car.y, other.x, other.y);
    if (d < 40 && d > 0.01) {
      const push = (40 - d) / 2;
      const nx = (car.x - other.x) / d;
      const ny = (car.y - other.y) / d;
      car.x += nx * push;
      car.y += ny * push;
      other.x -= nx * push;
      other.y -= ny * push;
      if (Math.abs(car.speed) > 200) {
        other.health -= 8;
        car.speed *= 0.8;
        audio.crash();
        addHeat(0.3);
      }
    }
  }

  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  p.speed = Math.abs(car.speed);
  p.carSpeedKmh = Math.abs(car.speed) * 0.36;
}

function updateMission(dt) {
  if (!state.job || !state.missionMarker) return;
  state.missionTime -= dt;
  if (state.missionTime <= 0) {
    failJob();
    return;
  }
  const stage = state.job.stages[state.stageIndex];
  const d = dist(state.player.x, state.player.y, state.missionMarker.x, state.missionMarker.y);
  if (d < 36 && (!stage.needCar || state.player.inCar)) {
    audio.pickup();
    burst(state.missionMarker.x, state.missionMarker.y, '#ffe600', 18, 140, 0.6, 4);
    if (state.stageIndex + 1 < state.job.stages.length) {
      setStage(state.stageIndex + 1);
      say(`Marlowe: "Good. Next: ${state.stageLabel.toLowerCase()}."`, 5);
      flash(state.stageLabel, 2.5);
    } else {
      completeJob();
    }
  }
}

function updatePickups(dt) {
  const p = state.player;
  for (const pickup of state.pickups) {
    if (pickup.taken) {
      pickup.respawn -= dt;
      if (pickup.respawn <= 0) pickup.taken = false;
      continue;
    }
    if (dist(p.x, p.y, pickup.x, pickup.y) < 30) {
      pickup.taken = true;
      pickup.respawn = 45;
      audio.pickup();
      burst(pickup.x, pickup.y, '#ffffff', 12, 110, 0.5, 3);
      if (pickup.kind === 'health') {
        p.health = Math.min(100, p.health + 50);
        flash('+50 Health', 1.8);
      } else if (pickup.kind === 'armor') {
        p.armor = 100;
        flash('Armor equipped', 1.8);
      } else {
        if (!save.weapons.includes(pickup.kind)) save.weapons.push(pickup.kind);
        const grant = pickup.kind === 'pistol' ? 36 : pickup.kind === 'smg' ? 80 : 16;
        save.ammo[pickup.kind] = (save.ammo[pickup.kind] || 0) + grant;
        state.weaponIndex = WEAPONS.findIndex((w) => w.id === pickup.kind);
        flash(`${WEAPONS[state.weaponIndex].name} +${grant} ammo`, 2.2);
        storeSave(save);
      }
    }
  }
}

function updateGarage(dt) {
  const p = state.player;
  const g = TUNING.garage;
  if (state.wanted > 0 && dist(p.x, p.y, g.x, g.y) < g.radius) {
    state.garageTimer += dt;
    if (state.garageTimer > 3) {
      state.wanted = 0;
      state.heat = 0;
      state.police = [];
      state.heli.active = false;
      state.garageTimer = 0;
      if (save.money >= 100) save.money -= 100;
      storeSave(save);
      flash('Heat cleared at the garage (−$100)', 3);
      audio.cash();
      burst(p.x, p.y, '#ffd60a', 24, 150, 0.8, 4);
    }
  } else {
    state.garageTimer = Math.max(0, state.garageTimer - dt);
  }
}

function updateHeat(dt) {
  // Heat cools when nobody has seen a crime for a while.
  if (state.wanted > 0 && state.time - state.lastSeen > 14) {
    state.heat = Math.max(0, state.heat - dt * 0.12);
    const stars = Math.ceil(state.heat);
    if (stars < state.wanted) {
      state.wanted = stars;
      if (stars === 0) flash('You lost them. Heat clear.', 2.5);
    }
  }
}

function handleKeys() {
  const p = state.player;
  if (state.mode === 'start') {
    if (input.pressed.has('enter') || input.mouseDown) {
      state.mode = 'play';
      audio.unlock();
      audio.setStation(save.radio);
      if (!state.job && !state.storyDone) startJob(save.missionIndex);
    }
    if (input.pressed.has('n')) {
      const fresh = freshSave();
      Object.assign(save, fresh);
      storeSave(save);
      state.job = null;
      state.storyDone = false;
      flash('New game started', 2);
    }
    return;
  }
  if (state.mode === 'dead') {
    if (input.pressed.has('enter')) respawn();
    return;
  }
  if (input.pressed.has('p') || input.pressed.has('escape')) {
    state.mode = state.mode === 'pause' ? 'play' : 'pause';
    audio.blip();
    return;
  }
  if (state.mode === 'pause') return;

  if (input.pressed.has('m')) {
    audio.setMuted(!audio.muted);
    flash(audio.muted ? 'Muted' : 'Sound on', 1.2);
  }
  if (input.pressed.has('r')) {
    const idx = RADIO_STATIONS.findIndex((s) => s.id === save.radio);
    const next = RADIO_STATIONS[(idx + 1) % RADIO_STATIONS.length];
    save.radio = next.id;
    storeSave(save);
    audio.setStation(next.id);
    flash(`♪ ${next.name}`, 1.8);
  }
  if (input.pressed.has('e')) {
    if (p.inCar) exitCar();
    else {
      const car = nearestEnterableCar();
      if (car) enterCar(car);
    }
  }
  if (input.pressed.has('h') && p.inCar) {
    // Horn: startles nearby pedestrians out of the road.
    audio.blip();
    for (const ped of state.peds) {
      if (dist(ped.x, ped.y, p.x, p.y) < 150) ped.panic = 1.2;
    }
    burst(p.x, p.y, '#ffffff', 4, 50, 0.3, 2);
  }
  for (let i = 0; i < WEAPONS.length; i += 1) {
    if (input.pressed.has(String(i + 1))) {
      if (save.weapons.includes(WEAPONS[i].id)) {
        state.weaponIndex = i;
        audio.blip();
      } else {
        flash(`${WEAPONS[i].name} not owned — find its pickup`, 1.6);
      }
    }
  }
  if (!state.frozen) state.wheelOpen = input.wheelHeld;
  if (state.wheelOpen && !state.frozen) {
    // Pick by mouse quadrant while the wheel is open.
    const dx = input.mouseX - view.w / 2;
    const dy = input.mouseY - view.h / 2;
    if (Math.hypot(dx, dy) > 40) {
      let angle = Math.atan2(dy, dx) + Math.PI / 2;
      if (angle < 0) angle += Math.PI * 2;
      const idx = Math.floor(angle / ((Math.PI * 2) / WEAPONS.length)) % WEAPONS.length;
      if (save.weapons.includes(WEAPONS[idx].id)) state.weaponIndex = idx;
    }
  }
}

function update(dt) {
  state.time += dt;
  state.gunfire = false;
  const p = state.player;
  p.protect = Math.max(0, p.protect - dt);
  p.fireCooldown = Math.max(0, p.fireCooldown - dt);
  state.dialogueTime = Math.max(0, state.dialogueTime - dt);
  state.bannerTime = Math.max(0, state.bannerTime - dt);
  state.messageTime = Math.max(0, state.messageTime - dt);
  state.hintTime = Math.max(0, state.hintTime - dt);
  state.district = districtAt(p.x, p.y);

  if (p.inCar) updatePlayerCar(dt);
  else updatePlayerOnFoot(dt);

  const allCars = [...state.traffic, ...state.parked, ...state.police, ...(p.car ? [p.car] : [])];
  for (const car of state.traffic) updateTrafficCar(car, dt, city, allCars, p);
  for (const ped of state.peds) updatePed(ped, dt, p, state.gunfire);

  updatePolice(dt);
  updateMission(dt);
  updatePickups(dt);
  updateGarage(dt);
  updateHeat(dt);

  for (const particle of state.particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 0.92;
    particle.vy *= 0.92;
    particle.life -= dt;
  }
  state.particles = state.particles.filter((pt) => pt.life > 0);
  for (const tracer of state.tracers) tracer.life -= dt;
  state.tracers = state.tracers.filter((t) => t.life > 0);

  // Camera follows with a touch of lead in the facing direction.
  const lead = p.inCar ? 60 : 24;
  const targetX = p.x + Math.cos(p.angle) * lead;
  const targetY = p.y + Math.sin(p.angle) * lead;
  state.camera.x += (targetX - state.camera.x) * Math.min(1, dt * 5);
  state.camera.y += (targetY - state.camera.y) * Math.min(1, dt * 5);
  state.camera.shake = Math.max(0, state.camera.shake - dt * 14);

  audio.setEngine(p.inCar ? Math.abs(p.car.speed) / TUNING.carMaxSpeed : 0, p.inCar);
  audio.setSiren(state.wanted > 0);
  if (statusEl) {
    statusEl.textContent = `${state.district.name}. $${save.money}. Wanted ${state.wanted}. ${state.stageLabel}`;
  }
}

function render() {
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, 0, view.w, view.h);
  if (state.mode === 'start') {
    drawStartScreen(ctx, view, save);
    return;
  }
  const shakeX = state.camera.shake ? (Math.random() - 0.5) * state.camera.shake : 0;
  const shakeY = state.camera.shake ? (Math.random() - 0.5) * state.camera.shake : 0;
  ctx.save();
  ctx.translate(view.w / 2 - state.camera.x + shakeX, view.h / 2 - state.camera.y + shakeY);
  const cam = { x: state.camera.x, y: state.camera.y };
  drawWorld(ctx, cam, view, city, state, state.time);
  for (const car of state.parked) drawCar(ctx, car, state.time, false);
  for (const car of state.traffic) drawCar(ctx, car, state.time, false);
  for (const ped of state.peds) drawPed(ctx, ped);
  for (const cop of state.police) drawCar(ctx, cop, state.time, true);
  if (state.player.inCar && state.player.car) drawCar(ctx, state.player.car, state.time, false);
  else drawPlayer(ctx, state.player, state.time, WEAPONS[state.weaponIndex].id);
  drawTracers(ctx, state.tracers);
  drawParticles(ctx, state.particles);
  drawHelicopter(ctx, state.heli, state.time);
  ctx.restore();

  drawHud(ctx, view, state);
  if (state.mode === 'pause') drawPauseScreen(ctx, view);
  if (state.mode === 'dead') drawDeathScreen(ctx, view, save);
}

// Screenshot staging: freeze the world, keep render-time animation alive.
const shot = shotNameFromQuery();
if (shot) {
  applyShot(state, shot);
  audio.setStation('off');
}

let lastTimestamp = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastTimestamp) / 1000);
  lastTimestamp = now;
  handleKeys();
  if (state.mode === 'play' && !state.frozen) update(dt);
  else if (state.frozen) state.time += dt;
  clearPressed(input);
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Headless playtest hooks (also handy for debugging in the console).
window.__game = {
  state,
  save,
  start: () => { state.mode = 'play'; if (!state.job) startJob(save.missionIndex); },
  teleport: (x, y) => { state.player.x = x; state.player.y = y; state.camera.x = x; state.camera.y = y; },
  giveWeapon: (id, ammo) => {
    if (!save.weapons.includes(id)) save.weapons.push(id);
    save.ammo[id] = ammo;
    state.weaponIndex = WEAPONS.findIndex((w) => w.id === id);
  },
  setWanted: (stars) => { state.heat = stars; state.wanted = stars; state.lastSeen = state.time; },
  setHealth: (hp) => { state.player.health = hp; },
  hurt: (amount) => damagePlayer(amount),
  marker: () => state.missionMarker,
  stageLabel: () => state.stageLabel,
  jobTitle: () => (state.job ? state.job.title : null),
  policeCount: () => state.police.length,
  nearestPolice: () => {
    let best = Infinity;
    for (const c of state.police) best = Math.min(best, dist(c.x, c.y, state.player.x, state.player.y));
    return best;
  },
  wipe: () => { wipeSave(); },
};

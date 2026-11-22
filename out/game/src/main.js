// Neon Bay Nights — game state, input, physics, police AI, missions and the main loop.

import { WORLD, VIEW, SAVE_KEY, WEAPONS, DISPATCH, RADIO, clamp, dist, angleTo, angleDiff, districtAt, mulberry } from './config.js';
import { buildCity, isRoad, nearestStreetPoint, collidesBuilding, trafficLightPhase } from './city.js';
import { JOBS, GARAGE, SPAWN } from './missions.js';
import { SoundBank } from './audio.js';
import { drawWorld, drawHUD } from './render.js';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 1);
const shotMode = params.get('shot');
const rnd = mulberry(seed * 104729 + 7);

export const game = {
  mode: 'title',
  time: 0,
  camera: { x: SPAWN.x, y: SPAWN.y, shake: 0 },
  player: null,
  cars: [], peds: [], police: [], bullets: [], particles: [], tracers: [],
  heli: null,
  city: buildCity(seed),
  wanted: 0, wantedTimer: 0, spawnProtect: 0,
  cash: 250, jobIndex: 0, jobStage: 0, jobTimer: 0, jobActive: false,
  respect: { downtown: 0, beachfront: 0, oldtown: 0, marina: 0 },
  weapon: 0, ammo: { pistol: 0, smg: 0, shotgun: 0 }, owned: { fists: true },
  radio: 0, dialogue: null, dialogueTimer: 0,
  banner: '', bannerTimer: 0,
  paused: false, dead: false, wheelOpen: false, wheelPick: 0,
  lightPhase: 'ns', sirenFlip: false, sirenTimer: 0,
  stats: { jobsDone: 0, carsStolen: 0, arrests: 0 },
};

const sound = new SoundBank();
const keys = {};
const mouse = { x: VIEW.w / 2, y: VIEW.h / 2, down: false };
let fireCooldown = 0;

function newPlayer() {
  return {
    x: SPAWN.x, y: SPAWN.y, angle: -Math.PI / 2, speed: 0,
    hp: 100, maxHp: 100, inCar: null, r: 12, walkPhase: 0,
  };
}

function makeCar(x, y, angle, color, kind = 'traffic') {
  return {
    x, y, angle, speed: 0, color, kind,
    hp: 100, r: 18, stuckTimer: 0, targetSpeed: 110 + rnd() * 60,
    laneOffset: 12, driver: kind === 'traffic',
  };
}

function spawnWorld() {
  game.cars = [];
  game.peds = [];
  for (const p of game.city.parked) {
    const c = makeCar(p.x, p.y, p.angle, p.color, 'parked');
    c.driver = false;
    game.cars.push(c);
  }
  for (let i = 0; i < 22; i++) {
    const vertical = rnd() < 0.5;
    const lane = Math.floor(rnd() * 16) * WORLD.block + (rnd() < 0.5 ? 12 : -12);
    const along = 100 + rnd() * (WORLD.h - 200);
    const x = vertical ? lane : along;
    const y = vertical ? along : lane;
    if (!isRoad(x, y)) continue;
    game.cars.push(makeCar(x, y, vertical ? Math.PI / 2 : 0, ['#e84a4a', '#4a90e8', '#f2c14e', '#7dd87d', '#c77dff', '#f5f5f5'][i % 6]));
  }
  for (let i = 0; i < 34; i++) {
    game.peds.push({
      x: 100 + rnd() * (WORLD.w - 200), y: 100 + rnd() * (WORLD.h - 400),
      angle: rnd() * Math.PI * 2, speed: 26 + rnd() * 22, hp: 30,
      color: ['#ffd9b3', '#c9e8ff', '#ffe3f2', '#d9ffd9'][i % 4], panic: 0, phase: rnd() * 6,
    });
  }
}

function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: game.cash, jobIndex: game.jobIndex, respect: game.respect,
      owned: game.owned, ammo: game.ammo, weapon: game.weapon, radio: game.radio,
      stats: game.stats,
    }));
  } catch (e) { /* storage unavailable in some sandboxes */ }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    game.cash = s.cash ?? game.cash;
    game.jobIndex = s.jobIndex ?? 0;
    game.respect = { ...game.respect, ...(s.respect || {}) };
    game.owned = { ...game.owned, ...(s.owned || {}) };
    game.ammo = { ...game.ammo, ...(s.ammo || {}) };
    game.weapon = s.weapon ?? 0;
    game.radio = s.radio ?? 0;
    game.stats = { ...game.stats, ...(s.stats || {}) };
  } catch (e) { /* fresh start */ }
}

function setDialogue(text, seconds = 6) {
  game.dialogue = { speaker: 'MARLOWE', text };
  game.dialogueTimer = seconds;
}

function setBanner(text, seconds = 3.5) {
  game.banner = text;
  game.bannerTimer = seconds;
}

function startJob() {
  const job = JOBS[game.jobIndex];
  if (!job) { setBanner('ALL JOBS COMPLETE — NEON BAY IS YOURS'); return; }
  game.jobActive = true;
  game.jobStage = 0;
  game.jobTimer = job.time;
  setDialogue(job.brief, 8);
  setBanner('JOB: ' + job.title.toUpperCase() + '  ·  $' + job.reward);
}

function currentTarget() {
  const job = JOBS[game.jobIndex];
  if (!job || !game.jobActive) return null;
  const st = job.stages[game.jobStage];
  if (!st) return null;
  return st.garage ? { ...GARAGE, label: st.label } : { x: st.x, y: st.y, label: st.label };
}

function completeStage() {
  const job = JOBS[game.jobIndex];
  game.jobStage += 1;
  sound.cash();
  if (game.jobStage >= job.stages.length) {
    game.cash += job.reward;
    game.jobActive = false;
    game.jobIndex += 1;
    game.stats.jobsDone += 1;
    const d = districtAt(game.player.x, game.player.y);
    game.respect[d.id] = clamp(game.respect[d.id] + 12, 0, 100);
    setBanner('JOB COMPLETE  +$' + job.reward + '  ·  ' + d.name + ' respect up');
    setDialogue('Marlowe: "Clean work. The next job is already waiting when you are."', 6);
    sound.win();
    saveGame();
    if (game.jobIndex < JOBS.length) setTimeout(() => { if (game.mode === 'play') startJob(); }, 2500);
  } else {
    setDialogue('Marlowe: "Good. Next step — ' + job.stages[game.jobStage].label + '."', 5);
  }
}

function addWanted(n) {
  const before = game.wanted;
  game.wanted = clamp(game.wanted + n, 0, 5);
  game.wantedTimer = 0;
  if (game.wanted > before) {
    const tier = DISPATCH[game.wanted];
    setBanner('DISPATCH: ' + tier.name.toUpperCase() + '  ·  ' + '★'.repeat(game.wanted));
  }
}

function burst(x, y, color, n = 10, speed = 120) {
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    game.particles.push({ x, y, vx: Math.cos(a) * speed * rnd(), vy: Math.sin(a) * speed * rnd(), life: 0.5 + rnd() * 0.5, color, size: 2 + rnd() * 3 });
  }
}

function tryEnterCar() {
  const p = game.player;
  if (p.inCar) {
    p.x = p.inCar.x + Math.cos(p.inCar.angle + Math.PI / 2) * 26;
    p.y = p.inCar.y + Math.sin(p.inCar.angle + Math.PI / 2) * 26;
    p.inCar.driver = false;
    p.inCar = null;
    sound.door();
    return;
  }
  let best = null, bestD = 60;
  for (const c of game.cars) {
    const d = dist(p, c);
    if (d < bestD) { bestD = d; best = c; }
  }
  if (best) {
    p.inCar = best;
    best.driver = false;
    best.kind = 'player';
    game.stats.carsStolen += 1;
    if (game.spawnProtect <= 0) addWanted(1);
    sound.door();
  }
}

function fireWeapon() {
  const p = game.player;
  const w = WEAPONS[game.weapon];
  if (fireCooldown > 0 || p.inCar) return;
  if (!w.infinite && (game.ammo[w.id] || 0) <= 0) { setBanner('NO AMMO — FIND A PICKUP'); fireCooldown = 0.4; return; }
  fireCooldown = w.rate;
  if (!w.infinite) game.ammo[w.id] -= 1;
  const aim = angleTo(p, mouseWorld());
  p.angle = aim;
  if (w.id === 'fists') {
    sound.punch();
    for (const ped of game.peds) {
      if (dist(p, ped) < 34) { ped.hp -= w.damage; ped.panic = 3; burst(ped.x, ped.y, '#ffb3b3', 5, 80); }
    }
    return;
  }
  if (w.id === 'smg') sound.smg(); else if (w.id === 'shotgun') sound.shotgun(); else sound.shot();
  for (let i = 0; i < w.pellets; i++) {
    const a = aim + (rnd() - 0.5) * 2 * w.spread;
    game.bullets.push({ x: p.x, y: p.y, vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed, life: 0.7, damage: w.damage });
    game.tracers.push({ x1: p.x, y1: p.y, x2: p.x + Math.cos(a) * 90, y2: p.y + Math.sin(a) * 90, life: 0.08 });
  }
  burst(p.x + Math.cos(aim) * 16, p.y + Math.sin(aim) * 16, '#ffd23f', 3, 60);
  if (game.spawnProtect <= 0) addWanted(1);
}

function mouseWorld() {
  return { x: game.camera.x + (mouse.x - VIEW.w / 2), y: game.camera.y + (mouse.y - VIEW.h / 2) };
}

function updatePlayer(dt) {
  const p = game.player;
  const up = keys['KeyW'] || keys['ArrowUp'];
  const down = keys['KeyS'] || keys['ArrowDown'];
  const left = keys['KeyA'] || keys['ArrowLeft'];
  const right = keys['KeyD'] || keys['ArrowRight'];
  const sprint = keys['ShiftLeft'] || keys['ShiftRight'];

  if (p.inCar) {
    const c = p.inCar;
    const accel = sprint ? 340 : 250;
    if (up) c.speed += accel * dt;
    if (down) c.speed -= 200 * dt;
    if (keys['Space']) c.speed -= c.speed * 3.2 * dt;
    c.speed -= c.speed * 0.55 * dt;
    c.speed = clamp(c.speed, -90, 430);
    // Low-speed steering stays usable when crawling.
    const steerBase = clamp(Math.abs(c.speed) / 60, 0.35, 1) * 2.1;
    if (left) c.angle -= steerBase * dt * Math.sign(c.speed || 1);
    if (right) c.angle += steerBase * dt * Math.sign(c.speed || 1);
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    c.x = clamp(c.x, 24, WORLD.w - 24);
    c.y = clamp(c.y, 24, WORLD.h - 190);
    const hit = collidesBuilding(game.city, c.x, c.y, 16);
    if (hit) {
      c.x -= Math.cos(c.angle) * c.speed * dt;
      c.y -= Math.sin(c.angle) * c.speed * dt;
      if (Math.abs(c.speed) > 120) { sound.crash(); game.camera.shake = 6; burst(c.x, c.y, '#ff9f43', 8, 140); c.hp -= 8; }
      c.speed *= 0.35;
    }
    p.x = c.x; p.y = c.y; p.angle = c.angle;
    if (Math.abs(c.speed) > 260 && rnd() < 0.3) burst(c.x - Math.cos(c.angle) * 16, c.y - Math.sin(c.angle) * 16, '#cfd8e8', 1, 30);
  } else {
    let mx = 0, my = 0;
    if (up) my -= 1;
    if (down) my += 1;
    if (left) mx -= 1;
    if (right) mx += 1;
    const len = Math.hypot(mx, my) || 1;
    const spd = sprint ? 235 : 150;
    if (mx || my) {
      p.angle = Math.atan2(my, mx);
      p.walkPhase += dt * 10;
      const nx = p.x + (mx / len) * spd * dt;
      const ny = p.y + (my / len) * spd * dt;
      if (!collidesBuilding(game.city, nx, p.y, p.r)) p.x = nx;
      if (!collidesBuilding(game.city, p.x, ny, p.r)) p.y = ny;
      p.x = clamp(p.x, 16, WORLD.w - 16);
      p.y = clamp(p.y, 16, WORLD.h - 190);
      p.speed = spd;
    } else p.speed = 0;
    if (mouse.down) fireWeapon();
  }
  fireCooldown = Math.max(0, fireCooldown - dt);

  // Pickups
  for (const pk of game.city.pickups) {
    if (pk.taken || dist(p, pk) > 26) continue;
    pk.taken = true;
    sound.pickup();
    if (pk.kind === 'health') { p.hp = clamp(p.hp + pk.ammo, 0, p.maxHp); setBanner('+HEALTH'); }
    else {
      game.owned[pk.kind] = true;
      game.ammo[pk.kind] = (game.ammo[pk.kind] || 0) + pk.ammo;
      game.weapon = WEAPONS.findIndex((w) => w.id === pk.kind);
      setBanner('PICKED UP: ' + pk.kind.toUpperCase());
      saveGame();
    }
    burst(pk.x, pk.y, '#37e0ff', 8, 90);
  }

  // Mission stage reach
  const target = currentTarget();
  if (target && dist(p, target) < (target.r || 40)) completeStage();
}

function updateTraffic(dt) {
  for (const c of game.cars) {
    if (c === game.player.inCar || c.kind === 'parked') continue;
    if (!c.driver) continue;
    const aheadX = c.x + Math.cos(c.angle) * 44;
    const aheadY = c.y + Math.sin(c.angle) * 44;
    let want = c.targetSpeed;
    for (const o of game.cars) {
      if (o !== c && Math.hypot(o.x - aheadX, o.y - aheadY) < 34) want = 0;
    }
    if (dist(c, game.player) < 60) want = 0;
    const phase = trafficLightPhase(game.time);
    const vertical = Math.abs(Math.sin(c.angle)) > 0.7;
    if ((phase === 'ns' && !vertical) || (phase === 'ew' && vertical)) {
      const mx = ((c.x % WORLD.block) + WORLD.block) % WORLD.block;
      const my = ((c.y % WORLD.block) + WORLD.block) % WORLD.block;
      if (mx < 40 || my < 40) want = Math.min(want, 20);
    }
    c.speed += clamp(want - c.speed, -260 * dt, 140 * dt);
    // Jam-proof: stuck timer teleports the car ahead along its lane.
    if (Math.abs(c.speed) < 6 && want > 0) {
      c.stuckTimer += dt;
      if (c.stuckTimer > 2.5) {
        c.x += Math.cos(c.angle) * 90;
        c.y += Math.sin(c.angle) * 90;
        c.stuckTimer = 0;
      }
    } else c.stuckTimer = 0;
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    // Turn at intersections sometimes; wrap at world edges.
    const gx = Math.abs(((c.x % WORLD.block) + WORLD.block) % WORLD.block);
    const gy = Math.abs(((c.y % WORLD.block) + WORLD.block) % WORLD.block);
    if ((gx < 8 || gy < 8) && rnd() < 0.012) c.angle += (rnd() < 0.5 ? 1 : -1) * Math.PI / 2;
    if (c.x < 20 || c.x > WORLD.w - 20 || c.y < 20 || c.y > WORLD.h - 200) {
      c.angle += Math.PI;
      c.x = clamp(c.x, 30, WORLD.w - 30);
      c.y = clamp(c.y, 30, WORLD.h - 210);
    }
    if (collidesBuilding(game.city, c.x, c.y, 15)) { c.angle += Math.PI / 2; c.speed = 40; }
  }
}

function updatePeds(dt) {
  for (const ped of game.peds) {
    if (ped.hp <= 0) continue;
    ped.phase += dt * 6;
    if (ped.panic > 0) {
      ped.panic -= dt;
      ped.angle = angleTo(game.player, ped);
      ped.x += Math.cos(ped.angle) * 130 * dt;
      ped.y += Math.sin(ped.angle) * 130 * dt;
    } else {
      if (rnd() < 0.005) ped.angle = rnd() * Math.PI * 2;
      const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
      const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
      if (!collidesBuilding(game.city, nx, ny, 8)) { ped.x = nx; ped.y = ny; } else ped.angle += Math.PI;
    }
    ped.x = clamp(ped.x, 14, WORLD.w - 14);
    ped.y = clamp(ped.y, 14, WORLD.h - 195);
    if (game.player.inCar && dist(ped, game.player) < 24 && Math.abs(game.player.inCar.speed) > 80) {
      ped.hp = 0; burst(ped.x, ped.y, '#ffb3b3', 8, 100);
      if (game.spawnProtect <= 0) addWanted(1);
    }
  }
}

function updatePolice(dt) {
  const p = game.player;
  const tier = DISPATCH[game.wanted];
  // Maintain unit count for the tier.
  while (game.police.length < tier.units) {
    const a = rnd() * Math.PI * 2;
    const sx = clamp(p.x + Math.cos(a) * 520, 40, WORLD.w - 40);
    const sy = clamp(p.y + Math.sin(a) * 520, 40, WORLD.h - 220);
    game.police.push({ x: sx, y: sy, angle: angleTo({ x: sx, y: sy }, p), speed: 0, hp: 120, r: 18, ramCooldown: 0, backoff: 0, kind: 'police', color: '#eef2ff' });
  }
  while (game.police.length > tier.units) game.police.pop();

  for (const cop of game.police) {
    cop.ramCooldown = Math.max(0, cop.ramCooldown - dt);
    cop.backoff = Math.max(0, cop.backoff - dt);
    const d = dist(cop, p);
    // Standoff ~72px: units hold off instead of pinning the player.
    const desired = angleTo(cop, p);
    const turn = clamp(angleDiff(desired, cop.angle), -2.4 * dt, 2.4 * dt);
    cop.angle += turn;
    let targetSpeed = tier.speed;
    if (d < 72) targetSpeed = Math.min(targetSpeed, 30);
    if (cop.backoff > 0) targetSpeed = -60;
    cop.speed += clamp(targetSpeed - cop.speed, -320 * dt, 200 * dt);
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    cop.x = clamp(cop.x, 24, WORLD.w - 24);
    cop.y = clamp(cop.y, 24, WORLD.h - 190);
    if (collidesBuilding(game.city, cop.x, cop.y, 15)) { cop.angle += 0.9; cop.speed = 50; }
    // Gentle ram with back-off; never shove the player backwards into a pin.
    if (d < 40 && cop.ramCooldown <= 0) {
      cop.ramCooldown = 1.6;
      cop.backoff = 0.7;
      cop.speed *= 0.3;
      game.camera.shake = Math.max(game.camera.shake, 3);
      burst(cop.x, cop.y, '#ffd23f', 5, 90);
      if (p.inCar) { p.inCar.hp -= 4; p.inCar.speed *= 0.92; }
      else if (game.spawnProtect <= 0) p.hp -= 5;
    }
    // Push-out so a unit can never rest on top of the player.
    if (d < 34) {
      const push = angleTo(p, cop);
      cop.x = p.x + Math.cos(push) * 36;
      cop.y = p.y + Math.sin(push) * 36;
    }
  }
  // Corner-pocket escape: if the player is boxed in, units peel away.
  if (game.police.length >= 2 && game.spawnProtect <= 0) {
    const near = game.police.filter((c) => dist(c, p) < 60);
    if (near.length >= 2) {
      for (const cop of near) {
        const away = angleTo(p, cop);
        cop.x += Math.cos(away) * 46;
        cop.y += Math.sin(away) * 46;
        cop.backoff = Math.max(cop.backoff, 0.8);
      }
    }
  }

  // Helicopter air support at wanted >= 3.
  if (game.wanted >= 3) {
    if (!game.heli) game.heli = { x: p.x + 300, y: p.y - 300, angle: 0, rotor: 0 };
    const h = game.heli;
    h.rotor += dt * 28;
    const lead = p.inCar ? p.inCar.speed * 0.35 : 0;
    const tx = p.x + Math.cos(p.angle) * lead;
    const ty = p.y + Math.sin(p.angle) * lead;
    h.angle = angleTo(h, { x: tx, y: ty });
    const hd = Math.hypot(tx - h.x, ty - h.y);
    const hs = clamp(hd * 1.6, 0, 330);
    h.x += Math.cos(h.angle) * hs * dt;
    h.y += Math.sin(h.angle) * hs * dt;
  } else game.heli = null;

  // Siren audio ticks.
  if (game.police.length) {
    game.sirenTimer -= dt;
    if (game.sirenTimer <= 0) { game.sirenTimer = 0.32; game.sirenFlip = !game.sirenFlip; sound.sirenTick(game.sirenFlip); }
  }

  // Wanted decays when out of sight; garage clears it fully.
  game.wantedTimer += dt;
  const seen = game.police.some((c) => dist(c, p) < 420) || game.heli;
  if (!seen && game.wanted > 0 && game.wantedTimer > 9) {
    game.wanted -= 1;
    game.wantedTimer = 0;
    if (game.wanted === 0) setBanner('HEAT LOST — ALL CLEAR');
  }
  if (dist(p, GARAGE) < GARAGE.r && game.wanted > 0) {
    game.wanted = 0;
    game.police = [];
    game.heli = null;
    setBanner('GARAGE — HEAT CLEARED');
    sound.cash();
  }

  // Busted / wasted checks (never during spawn protection).
  if (game.spawnProtect <= 0 && game.wanted > 0) {
    const close = game.police.filter((c) => dist(c, p) < 58).length;
    const playerSpeed = p.inCar ? Math.abs(p.inCar.speed) : p.speed;
    if (close >= 1 && playerSpeed < 12) {
      game.bustMeter = (game.bustMeter || 0) + dt;
      if (game.bustMeter > 2.2) die(true);
    } else game.bustMeter = 0;
  }
  if (p.hp <= 0) die(false);
}

function updateBullets(dt) {
  for (const b of game.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    for (const ped of game.peds) {
      if (ped.hp > 0 && Math.hypot(ped.x - b.x, ped.y - b.y) < 13) { ped.hp -= b.damage; ped.panic = 3; b.life = 0; burst(b.x, b.y, '#ffb3b3', 4, 80); }
    }
    for (const cop of game.police) {
      if (Math.hypot(cop.x - b.x, cop.y - b.y) < 20) { cop.hp -= b.damage; b.life = 0; burst(b.x, b.y, '#ffd23f', 4, 90); }
    }
    for (const c of game.cars) {
      if (Math.hypot(c.x - b.x, c.y - b.y) < 20) { c.hp -= b.damage; b.life = 0; burst(b.x, b.y, '#ff9f43', 3, 70); }
    }
    if (collidesBuilding(game.city, b.x, b.y, 2)) b.life = 0;
  }
  game.bullets = game.bullets.filter((b) => b.life > 0);
  game.police = game.police.filter((c) => c.hp > 0);
  for (const c of game.cars) if (c.hp <= 0 && !c.dead) { c.dead = true; c.speed = 0; burst(c.x, c.y, '#ff6b35', 22, 180); sound.crash(); }
}

function die(busted) {
  if (game.dead) return;
  game.dead = true;
  game.mode = 'dead';
  game.deadReason = busted ? 'BUSTED' : 'WASTED';
  if (busted) { game.stats.arrests += 1; game.cash = Math.max(0, game.cash - 150); }
  sound.fail();
  saveGame();
}

export function restart() {
  game.player = newPlayer();
  game.wanted = 0;
  game.police = [];
  game.heli = null;
  game.bullets = [];
  game.spawnProtect = 4;
  game.dead = false;
  game.bustMeter = 0;
  game.mode = 'play';
  game.camera.x = game.player.x;
  game.camera.y = game.player.y;
  if (!game.jobActive && game.jobIndex < JOBS.length) startJob();
}

function update(dt) {
  game.time += dt;
  game.spawnProtect = Math.max(0, game.spawnProtect - dt);
  game.dialogueTimer = Math.max(0, game.dialogueTimer - dt);
  game.bannerTimer = Math.max(0, game.bannerTimer - dt);
  game.lightPhase = trafficLightPhase(game.time);
  if (game.jobActive) {
    game.jobTimer -= dt;
    if (game.jobTimer <= 0) {
      game.jobActive = false;
      setBanner('JOB FAILED — TOO SLOW');
      sound.fail();
      setTimeout(() => { if (game.mode === 'play') startJob(); }, 2000);
    }
  }
  updatePlayer(dt);
  updateTraffic(dt);
  updatePeds(dt);
  updatePolice(dt);
  updateBullets(dt);
  for (const pt of game.particles) { pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt; }
  game.particles = game.particles.filter((pt) => pt.life > 0);
  for (const t of game.tracers) t.life -= dt;
  game.tracers = game.tracers.filter((t) => t.life > 0);
  const p = game.player;
  game.camera.x += (p.x - game.camera.x) * Math.min(1, dt * 5);
  game.camera.y += (p.y - game.camera.y) * Math.min(1, dt * 5);
  game.camera.shake = Math.max(0, game.camera.shake - dt * 14);
}

// ---- Screenshot staging: deterministic frames via ?shot= -------------------
function stageShot(kind) {
  game.mode = 'play';
  game.player = newPlayer();
  game.spawnProtect = 999;
  const p = game.player;
  const car = makeCar(1600, 1000, 0, '#e84a4a', 'player');
  car.driver = false;
  game.cars.push(car);

  if (kind === 'cover') {
    p.inCar = car; car.speed = 400; p.x = car.x; p.y = car.y; p.angle = 0;
    game.wanted = 4;
    game.police = [0, 1, 2, 3].map((i) => ({ x: car.x - 90 - i * 55, y: car.y + (i % 2 ? 30 : -30), angle: 0, speed: 320, hp: 120, r: 18, ramCooldown: 9, backoff: 0, kind: 'police', color: '#eef2ff' }));
    game.heli = { x: car.x + 60, y: car.y - 110, angle: 0.4, rotor: 2 };
    game.weapon = 1; game.owned.pistol = true; game.ammo.pistol = 36;
    startJob();
    setDialogue(JOBS[0].brief, 99);
    setBanner('DISPATCH: AIR SUPPORT  ·  ★★★★', 99);
  } else if (kind === 'wheel') {
    p.x = 1600; p.y = 1000; p.angle = -0.6;
    game.owned = { fists: true, pistol: true, smg: true, shotgun: true };
    game.ammo = { pistol: 36, smg: 90, shotgun: 12 };
    game.weapon = 2;
    game.wheelOpen = true; game.wheelPick = 2;
    game.wanted = 3;
    game.police = [0, 1].map((i) => ({ x: p.x - 150 + i * 280, y: p.y + 90, angle: -1.2, speed: 0, hp: 120, r: 18, ramCooldown: 9, backoff: 0, kind: 'police', color: '#eef2ff' }));
    game.heli = { x: p.x + 130, y: p.y - 130, angle: 2.2, rotor: 1 };
    startJob();
    setBanner('WEAPON WHEEL — HOLD Q', 99);
  } else if (kind === 'mission') {
    p.inCar = car; car.x = 1500; car.y = 1600; car.angle = 0.8; car.speed = 150;
    p.x = car.x; p.y = car.y; p.angle = 0.8;
    game.jobIndex = 1;
    game.respect = { downtown: 24, beachfront: 36, oldtown: 48, marina: 12 };
    game.radio = 0;
    game.weapon = 1; game.owned.pistol = true; game.ammo.pistol = 24;
    startJob();
    setDialogue(JOBS[1].brief, 99);
  } else if (kind === 'police') {
    p.inCar = car; car.x = 1050; car.y = 950; car.angle = -2.2; car.speed = 280;
    p.x = car.x; p.y = car.y; p.angle = -2.2;
    game.wanted = 5;
    game.police = [0, 1, 2, 3, 4].map((i) => ({ x: car.x + 120 - i * 40, y: car.y - 110 + i * 45, angle: 2.4, speed: 300, hp: 120, r: 18, ramCooldown: 9, backoff: 0, kind: 'police', color: '#eef2ff' }));
    game.heli = { x: car.x - 90, y: car.y - 140, angle: 0.9, rotor: 3 };
    startJob();
    setBanner('DISPATCH: MAXIMUM RESPONSE  ·  ★★★★★', 99);
    setDialogue('Marlowe: "Maximum response, kid. The garage ring is your only way out."', 99);
  }
  game.camera.x = p.x;
  game.camera.y = p.y;
  // Freeze the staged frame so the screenshot is deterministic.
  game.frozen = true;
}

// ---- Input -------------------------------------------------------------------
addEventListener('keydown', (e) => {
  keys[e.code] = true;
  sound.ensure();
  if (game.mode === 'title' && (e.code === 'Enter' || e.code === 'Space')) {
    game.mode = 'play';
    game.spawnProtect = 4;
    startJob();
    sound.setStation(RADIO[game.radio]);
  }
  if (game.mode === 'dead' && e.code === 'Enter') restart();
  if (e.code === 'KeyE' && game.mode === 'play') tryEnterCar();
  if (e.code === 'KeyP') game.paused = !game.paused;
  if (e.code === 'KeyM') setBanner(sound.toggleMute() ? 'SOUND OFF' : 'SOUND ON');
  if (e.code === 'KeyR' && game.mode === 'play') {
    game.radio = (game.radio + 1) % RADIO.length;
    sound.setStation(RADIO[game.radio]);
    setBanner('RADIO: ' + RADIO[game.radio].name.toUpperCase());
    saveGame();
  }
  if (e.code === 'KeyQ') game.wheelOpen = true;
  const num = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3 }[e.code];
  if (num !== undefined && game.owned[WEAPONS[num].id]) { game.weapon = num; saveGame(); }
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => {
  keys[e.code] = false;
  if (e.code === 'KeyQ') {
    game.wheelOpen = false;
    if (game.owned[WEAPONS[game.wheelPick].id]) game.weapon = game.wheelPick;
    saveGame();
  }
});
const canvas = document.getElementById('game');
canvas.addEventListener('mousemove', (e) => {
  const r = canvas.getBoundingClientRect();
  mouse.x = (e.clientX - r.left) * (VIEW.w / r.width);
  mouse.y = (e.clientY - r.top) * (VIEW.h / r.height);
  if (game.wheelOpen) {
    const dx = mouse.x - VIEW.w / 2, dy = mouse.y - VIEW.h / 2;
    const a = Math.atan2(dy, dx);
    game.wheelPick = ((Math.round((a + Math.PI / 2) / (Math.PI / 2)) % 4) + 4) % 4;
  }
});
canvas.addEventListener('mousedown', () => { mouse.down = true; sound.ensure(); });
addEventListener('mouseup', () => { mouse.down = false; });

// ---- Boot + loop ---------------------------------------------------------------
loadGame();
game.player = newPlayer();
spawnWorld();
if (shotMode) stageShot(shotMode);

const ctx = canvas.getContext('2d');
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  if (game.mode === 'play' && !game.paused && !game.frozen) update(dt);
  drawWorld(ctx, game);
  drawHUD(ctx, game);
  window.__nbnReady = true;
}
requestAnimationFrame(frame);

// Test hooks for the headless playtest (harmless in normal play). The playtest
// drives real keyboard input and only reads state through these hooks.
window.__nbn = { game, restart, startJob, tryEnterCar, addWanted, JOBS, GARAGE, keys };

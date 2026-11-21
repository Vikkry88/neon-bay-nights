// Neon Bay Nights — game loop, physics, police/traffic AI, missions.
import { WORLD_W, WORLD_H, VIEW_W, VIEW_H, PLAYER_R, POLICE_STANDOFF, RAM_GATE_MS } from './config.js';
import { makeRng, seedFromUrl } from './random.js';
import { buildCity, pushOutOfBuildings, collideBuildings } from './city.js';
import { createInput, axis } from './input.js';
import { loadSave, writeSave } from './save.js';
import { createAudio } from './audio.js';
import { MISSIONS, missionTargets, stageBanner } from './missions.js';
import { spawnTraffic, spawnParked, spawnPeds, makeCar, addParticles } from './world.js';
import { drawWorld } from './render.js';
import { drawHud } from './hud.js';
import { applyShot, shotFromUrl } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const rng = makeRng(seedFromUrl());
const city = buildCity(rng);
const input = createInput(canvas);
const audio = createAudio();
const saved = loadSave();

const state = {
  mode: 'menu', city, rng,
  player: { x: city.spawn.x, y: city.spawn.y, hp: 100, inCar: null, angle: 0, spawnProtectUntil: 0 },
  cars: [], police: [], peds: [], particles: [], tracers: [],
  money: saved.money, done: saved.done.slice(),
  wanted: 0, wantedDecayAt: 0, lastCrimeAt: 0, lastRamAt: 0,
  hasPistol: false, ammo: 0, mission: null, missionStage: 0, marker: null,
  banner: '', shake: 0, aimX: 0, aimY: 0, time: 0, flashMsg: '', flashUntil: 0,
  _targets: null, arrestTimer: 0,
};

function resetWorld() {
  state.cars = spawnTraffic(city, rng, 14).concat(spawnParked(city, rng, 12));
  state.peds = spawnPeds(city, rng, 22);
  state.police = [];
  state.particles = []; state.tracers = [];
  for (const pk of city.pickups) pk.taken = false;
  state.player.x = city.spawn.x; state.player.y = city.spawn.y;
  state.player.hp = 100; state.player.inCar = null;
  state.player.spawnProtectUntil = performance.now() + 4000;
  state.wanted = 0; state.hasPistol = false; state.ammo = 0;
  state.mission = null; state.missionStage = 0; state.marker = null; state._targets = null;
  state.banner = 'Press Enter to take a job from Marlowe.';
}
resetWorld();

function nextMission() {
  for (const m of MISSIONS) if (!state.done.includes(m.id)) return m;
  return MISSIONS[0];
}
function startMission() {
  state.mission = nextMission();
  state._targets = missionTargets(city, state.mission.id);
  state.missionStage = 0;
  state.marker = { x: state._targets.a.x, y: state._targets.a.y };
  state.banner = stageBanner(state.mission, 0);
  flash(state.mission.title + ' — $' + state.mission.reward);
  if (state.mission.id === 'm5') raiseWanted(2);
}
function flash(msg) { state.flashMsg = msg; state.flashUntil = performance.now() + 2600; }
function raiseWanted(n) {
  state.wanted = Math.min(5, Math.max(state.wanted, n));
  state.lastCrimeAt = performance.now();
  ensurePolice();
}
function ensurePolice() {
  const want = state.wanted === 0 ? 0 : 1 + state.wanted;
  while (state.police.filter((c) => !c.dead).length < want) {
    const p = state.player.inCar || state.player;
    const a = rng.range(0, 6.28), d = rng.range(320, 460);
    const x = Math.max(60, Math.min(WORLD_W - 60, p.x + Math.cos(a) * d));
    const y = Math.max(60, Math.min(WORLD_H - 300, p.y + Math.sin(a) * d));
    state.police.push(makeCar(x, y, a + Math.PI, '#1e3a8a', { police: true }));
  }
  if (state.wanted === 0) state.police = state.police.filter((c) => c.dead);
}

function playerPos() { return state.player.inCar || state.player; }

function updatePlayer(dt) {
  const p = state.player, ax = axis(input);
  if (p.inCar) {
    const car = p.inCar;
    const accel = 340, maxF = 360, maxR = -140;
    if (ax.y < 0) car.speed += accel * dt;
    else if (ax.y > 0) car.speed -= (car.speed > 0 ? 520 : 240) * dt;
    else car.speed -= car.speed * 1.1 * dt;
    car.speed = Math.max(maxR, Math.min(maxF, car.speed));
    // Low-speed steering: keep turn rate usable even when crawling.
    const steer = ax.x * (1.9 + Math.min(1.4, Math.abs(car.speed) / 160)) * dt;
    if (Math.abs(car.speed) > 4) car.angle += steer * (car.speed >= 0 ? 1 : -1);
    else if (ax.x !== 0 && (ax.y !== 0 || Math.abs(car.speed) > 1)) car.angle += ax.x * 1.6 * dt;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.x = Math.max(30, Math.min(WORLD_W - 30, car.x));
    car.y = Math.max(30, Math.min(WORLD_H - 30, car.y));
    if (pushOutOfBuildings(city, car, 20)) { car.speed *= 0.4; state.shake = Math.max(state.shake, 4); }
    p.x = car.x; p.y = car.y;
    if (input.wasPressed('e')) {
      p.inCar = null;
      p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
      p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
      car.speed = 0; car.parked = true;
    }
  } else {
    const sp = 190;
    p.x += ax.x * sp * dt; p.y += ax.y * sp * dt;
    p.x = Math.max(20, Math.min(WORLD_W - 20, p.x));
    p.y = Math.max(20, Math.min(WORLD_H - 20, p.y));
    pushOutOfBuildings(city, p, PLAYER_R);
    if (input.wasPressed('e')) {
      let best = null, bd = 70;
      for (const c of state.cars) {
        if (c.dead || c.police) continue;
        const d = Math.hypot(c.x - p.x, c.y - p.y);
        if (d < bd) { bd = d; best = c; }
      }
      if (best) {
        p.inCar = best; best.parked = false; best.traffic = false; best.speed = 0;
        raiseWanted(Math.max(1, state.wanted));
        flash('Car stolen! Heat is on.');
      }
    }
  }
  // pickups
  for (const pk of city.pickups) {
    if (pk.taken) continue;
    const pp = playerPos();
    if (Math.hypot(pp.x - pk.x, pp.y - pk.y) < 34) {
      pk.taken = true; audio.pickup();
      if (pk.kind === 'pistol') { state.hasPistol = true; state.ammo = 60; flash('Pistol picked up!'); }
      else { p.hp = Math.min(100, p.hp + 40); flash('Health restored.'); }
    }
  }
}

function shoot() {
  const p = state.player;
  if (p.inCar) return;
  const wx = state.aimX, wy = state.aimY;
  if (state.hasPistol && state.ammo > 0) {
    state.ammo--; audio.shot();
    state.tracers.push({ x1: p.x, y1: p.y, x2: wx, y2: wy, life: 1 });
    addParticles(state.particles, wx, wy, 5, '#fde047', 120);
    for (const ped of state.peds) {
      if (!ped.dead && Math.hypot(ped.x - wx, ped.y - wy) < 26) { ped.dead = true; raiseWanted(2); addParticles(state.particles, ped.x, ped.y, 10, '#ef4444', 140); }
    }
    for (const c of state.police) {
      if (!c.dead && Math.hypot(c.x - wx, c.y - wy) < 34) { c.hp -= 34; if (c.hp <= 0) { c.dead = true; addParticles(state.particles, c.x, c.y, 22, '#f97316', 220); state.shake = 8; } }
    }
    raiseWanted(Math.max(2, state.wanted));
  } else {
    audio.punch();
    const a = Math.atan2(wy - p.y, wx - p.x);
    const hx = p.x + Math.cos(a) * 26, hy = p.y + Math.sin(a) * 26;
    for (const ped of state.peds) {
      if (!ped.dead && Math.hypot(ped.x - hx, ped.y - hy) < 24) { ped.hp -= 30; ped.panic = 2; if (ped.hp <= 0) { ped.dead = true; raiseWanted(1); } }
    }
  }
}

function updateTraffic(dt, now) {
  for (const c of state.cars) {
    if (!c.traffic || c.dead || state.player.inCar === c) continue;
    // Jam-proof: if blocked too long, teleport ahead / despawn far away.
    let blocked = false;
    for (const o of state.cars) {
      if (o === c || o.dead) continue;
      if (Math.hypot(o.x - c.x, o.y - c.y) < 52) { blocked = true; break; }
    }
    if (blocked) { c.stuckTime += dt; c.speed = Math.max(0, c.speed - 200 * dt); }
    else { c.stuckTime = 0; c.speed = Math.min(115, c.speed + 90 * dt); }
    if (c.stuckTime > 2.5) {
      c.stuckTime = 0;
      c.x += c.dirX * 140; c.y += c.dirY * 140; c.speed = 90;
      pushOutOfBuildings(city, c, 20);
    }
    c.x += c.dirX * c.speed * dt; c.y += c.dirY * c.speed * dt;
    if (c.x < -60) c.x = WORLD_W + 40; if (c.x > WORLD_W + 60) c.x = -40;
    if (c.y < -60) c.y = WORLD_H - 320; if (c.y > WORLD_H - 280) c.y = 40;
  }
}

function updatePolice(dt, now) {
  ensurePolice();
  const target = playerPos();
  for (const c of state.police) {
    if (c.dead) continue;
    const dx = target.x - c.x, dy = target.y - c.y;
    const dist = Math.hypot(dx, dy) || 1;
    const desired = Math.atan2(dy, dx);
    let da = desired - c.angle;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    c.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, da));
    // Standoff: hold ~72px, never pin the player.
    let wantSpeed = 0;
    if (now < c.backoffUntil) wantSpeed = -90;
    else if (dist > POLICE_STANDOFF + 30) wantSpeed = 300;
    else if (dist > POLICE_STANDOFF) wantSpeed = 140;
    else if (dist < POLICE_STANDOFF - 18) wantSpeed = -110;
    else wantSpeed = 0;
    // Corner-pocket escape: if player is slow & boxed, back off.
    const pSpeed = state.player.inCar ? Math.abs(state.player.inCar.speed) : 999;
    if (state.player.inCar && pSpeed < 30 && dist < 110) wantSpeed = -120;
    c.speed += (wantSpeed - c.speed) * Math.min(1, 3 * dt);
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    pushOutOfBuildings(city, c, 20);
    // Push-out so police can never overlap/pin the player car.
    const minD = POLICE_STANDOFF;
    const d2 = Math.hypot(target.x - c.x, target.y - c.y);
    if (d2 < minD && d2 > 0.01) {
      const push = (minD - d2);
      c.x -= ((target.x - c.x) / d2) * push;
      c.y -= ((target.y - c.y) / d2) * push;
      pushOutOfBuildings(city, c, 20);
    }
    // Gentle ram with a global gate + back-off (no death spiral).
    if (d2 < 84 && now - state.lastRamAt > RAM_GATE_MS && now > state.player.spawnProtectUntil) {
      state.lastRamAt = now; c.backoffUntil = now + 900;
      if (state.player.inCar) {
        state.player.inCar.speed *= 0.75;
        state.player.hp -= 3;
        state.shake = Math.max(state.shake, 5);
        audio.crash();
        addParticles(state.particles, target.x, target.y, 6, '#f97316', 120);
      } else {
        state.arrestTimer += 0.5;
      }
    }
    if (Math.random() < 0.01) audio.siren();
  }
  // Foot arrest: standing near police on foot fills the arrest meter.
  if (!state.player.inCar && state.wanted > 0) {
    const near = state.police.some((c) => !c.dead && Math.hypot(c.x - state.player.x, c.y - state.player.y) < 90);
    if (near && now > state.player.spawnProtectUntil) state.arrestTimer += dt;
    else state.arrestTimer = Math.max(0, state.arrestTimer - dt * 2);
    if (state.arrestTimer > 2.5) gameOver('BUSTED');
  } else state.arrestTimer = 0;
  // Wanted decay when not committing crimes.
  if (state.wanted > 0 && now - state.lastCrimeAt > 18000) {
    state.wanted -= 1; state.lastCrimeAt = now;
    if (state.wanted === 0) state.police = [];
  }
}

function updatePeds(dt, now) {
  for (const ped of state.peds) {
    if (ped.dead) continue;
    if (now > ped.wanderAt) { ped.angle = rng.range(0, 6.28); ped.wanderAt = now + rng.range(1500, 4000); }
    const sp = ped.panic > 0 ? 110 : ped.speed;
    ped.panic = Math.max(0, ped.panic - dt);
    ped.x += Math.cos(ped.angle) * sp * dt;
    ped.y += Math.sin(ped.angle) * sp * dt;
    ped.x = Math.max(20, Math.min(WORLD_W - 20, ped.x));
    ped.y = Math.max(20, Math.min(WORLD_H - 260, ped.y));
    pushOutOfBuildings(city, ped, 8);
    const pp = playerPos();
    if (state.player.inCar && Math.abs(state.player.inCar.speed) > 60 && Math.hypot(ped.x - pp.x, ped.y - pp.y) < 30) {
      ped.dead = true; raiseWanted(2); addParticles(state.particles, ped.x, ped.y, 10, '#ef4444', 140);
    }
  }
}

function updateMission() {
  if (!state.mission || !state._targets) return;
  const pp = playerPos();
  if (state.missionStage === 0) {
    state.marker = { x: state._targets.a.x, y: state._targets.a.y };
    if (Math.hypot(pp.x - state._targets.a.x, pp.y - state._targets.a.y) < 52) {
      state.missionStage = 1;
      state.banner = stageBanner(state.mission, 1);
      flash('Package secured — get to the garage!');
      audio.pickup();
      if (state.mission.id === 'm3' || state.mission.id === 'm4') raiseWanted(2);
    }
  } else if (state.missionStage === 1) {
    state.marker = { x: city.garage.x, y: city.garage.y };
    if (Math.hypot(pp.x - city.garage.x, pp.y - city.garage.y) < city.garage.r + 10) {
      const reward = state.mission.reward;
      state.money += reward;
      if (!state.done.includes(state.mission.id)) state.done.push(state.mission.id);
      writeSave(state.money, state.done);
      audio.cash();
      state.mode = 'complete';
      state.banner = state.mission.title + ' complete! +$' + reward;
      state.wanted = Math.max(0, state.wanted - 1);
    }
  }
}

function gameOver(reason) {
  state.mode = 'over';
  state.banner = reason === 'BUSTED' ? 'BUSTED — press R to try again.' : 'WASTED — press R to try again.';
  audio.stopMusic();
}

function step(dt) {
  const now = performance.now();
  state.time += dt;
  state.shake = Math.max(0, state.shake - dt * 30);
  if (state.mode === 'menu') {
    if (input.wasPressed('enter')) { state.mode = 'play'; audio.unlock(); audio.startMusic(); startMission(); }
    return;
  }
  if (state.mode === 'complete') {
    if (input.wasPressed('enter')) { state.mode = 'play'; startMission(); }
    return;
  }
  if (state.mode === 'over') {
    if (input.wasPressed('r')) { resetWorld(); state.mode = 'play'; audio.startMusic(); startMission(); }
    return;
  }
  if (input.wasPressed('p')) { state.mode = state.mode === 'pause' ? 'play' : 'pause'; return; }
  if (state.mode === 'pause') return;
  if (input.wasPressed('m')) flash(audio.toggleMute() ? 'Muted' : 'Sound on');
  if (input.wasPressed('enter') && !state.mission) startMission();
  updatePlayer(dt);
  updateTraffic(dt, now);
  updatePolice(dt, now);
  updatePeds(dt, now);
  updateMission();
  if (input.mouseDown && !state.player.inCar) shoot();
  // particles + tracers
  for (const p of state.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; p.life -= dt; }
  state.particles = state.particles.filter((p) => p.life > 0);
  for (const t of state.tracers) t.life -= dt * 4;
  state.tracers = state.tracers.filter((t) => t.life > 0);
  // Garage slowly repairs health while parked in the yellow ring.
  {
    const pp = playerPos();
    if (Math.hypot(pp.x - city.garage.x, pp.y - city.garage.y) < city.garage.r) {
      state.player.hp = Math.min(100, state.player.hp + dt * 6);
    }
  }
  // death check (spawn protection prevents instant death)
  if (state.player.hp <= 0 && now > state.player.spawnProtectUntil) gameOver('WASTED');
  // camera aim in world space
  const cam = camera();
  state.aimX = cam.x + input.mouseX; state.aimY = cam.y + input.mouseY;
}

function camera() {
  const p = playerPos();
  return {
    x: Math.max(0, Math.min(WORLD_W - VIEW_W, p.x - VIEW_W / 2)),
    y: Math.max(0, Math.min(WORLD_H - VIEW_H, p.y - VIEW_H / 2)),
  };
}

function draw() {
  const cam = camera();
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  drawWorld(ctx, state, cam, state.time);
  drawHud(ctx, state);
  if (state.flashMsg && performance.now() < state.flashUntil) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(VIEW_W / 2 - 260, 52, 520, 30);
    ctx.fillStyle = '#fde68a'; ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center';
    ctx.fillText(state.flashMsg, VIEW_W / 2, 73); ctx.textAlign = 'left';
  }
  if (state.arrestTimer > 0.2 && !state.player.inCar) {
    ctx.fillStyle = '#ef4444'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center';
    ctx.fillText('ARRESTING... RUN!', VIEW_W / 2, 110); ctx.textAlign = 'left';
  }
  if (state.mode === 'menu') overlay('NEON BAY NIGHTS', 'Press ENTER to start', 'WASD move/drive - E steal car - Click punch/shoot - P pause - M mute');
  else if (state.mode === 'pause') overlay('PAUSED', 'Press P to resume', '');
  else if (state.mode === 'complete') overlay('MISSION COMPLETE', state.banner + '  Press ENTER for next job', 'Cash: $' + Math.floor(state.money));
  else if (state.mode === 'over') overlay('GAME OVER', state.banner, 'Cash: $' + Math.floor(state.money));
}
function overlay(title, line1, line2) {
  ctx.fillStyle = 'rgba(5,8,20,0.78)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff2e88'; ctx.font = 'bold 52px monospace';
  ctx.fillText(title, VIEW_W / 2, 300);
  ctx.fillStyle = '#f8fafc'; ctx.font = 'bold 20px monospace';
  ctx.fillText(line1, VIEW_W / 2, 350);
  ctx.fillStyle = '#94a3b8'; ctx.font = '15px monospace';
  ctx.fillText(line2, VIEW_W / 2, 390);
  ctx.textAlign = 'left';
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  step(dt);
  draw();
  input.endFrame();
  requestAnimationFrame(frame);
}

// Debug hook for tests + screenshots.
window.__nbn = state;
window.__neon = state;
Object.defineProperty(state, 'hasPistolFlag', { get() { return state.hasPistol; } });
const shot = shotFromUrl();
if (shot) { startMission(); applyShot(state, shot); }
window.__neonReady = true;
window.__nbnReady = true;
requestAnimationFrame(frame);

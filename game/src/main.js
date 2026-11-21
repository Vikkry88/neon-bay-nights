// Neon Bay Nights — main loop and game state (round 5 fresh rebuild).
import { CFG } from './config.js';
import { makeRng } from './random.js';
import { Sfx } from './audio.js';
import { Input } from './input.js';
import { buildCity, snapToStreet, isStreet } from './city.js';
import { createWorld, updateTraffic, updatePeds, updatePolice, spawnSafe } from './world.js';
import { MISSIONS, missionTarget, advanceMission } from './missions.js';
import { drawHud, drawMenus } from './hud.js';
import { drawMinimap } from './minimap.js';
import { drawWorld } from './render.js';
import { loadSave, storeSave } from './save.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

function resize() {
  canvas.width = Math.min(window.innerWidth, 1600);
  canvas.height = Math.min(window.innerHeight, 1000);
}
window.addEventListener('resize', resize);
resize();

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 7) || 7;
const rng = makeRng(seed);
const city = buildCity(rng);
const input = new Input(canvas);
const sfx = new Sfx();

const state = {
  mode: 'menu', // menu | play | pause | dead
  time: 0,
  money: 250,
  health: 100,
  wanted: 0,
  wantedHeat: 0,
  missionIdx: 0,
  missionStage: 0,
  cashGot: 0,
  escapeTimer: 0,
  hasPistol: false,
  ammo: 0,
  player: { x: 0, y: 0, angle: 0, speed: 0, inCar: null, walkPhase: 0 },
  cam: { x: 0, y: 0 },
  world: null,
  tracers: [],
  flashes: [],
  message: '',
  messageT: 0,
  deadT: 0,
  shot: params.get('shot') || '',
  seed,
  city,
  rng,
  sfx,
  input,
};

state.world = createWorld(city, rng, state);
spawnSafe(state, city, rng);
const saved = loadSave();
if (saved && !state.shot) {
  state.money = saved.money ?? state.money;
  state.missionIdx = Math.min(saved.missionIdx ?? 0, MISSIONS.length);
}

function announce(text) {
  state.message = text;
  state.messageT = 4;
  if (statusEl) statusEl.textContent = text;
}

function addWanted(amount) {
  state.wantedHeat = Math.min(100, state.wantedHeat + amount);
  state.wanted = Math.min(5, Math.floor(state.wantedHeat / 20) + (state.wantedHeat > 0 ? 1 : 0));
  if (state.wantedHeat <= 0) state.wanted = 0;
}

function playerPos() {
  const p = state.player;
  if (p.inCar) return { x: p.inCar.x, y: p.inCar.y };
  return { x: p.x, y: p.y };
}

function collideBuildings(x, y, r) {
  let nx = x;
  let ny = y;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(nx, b.x + b.w));
    const cy = Math.max(b.y, Math.min(ny, b.y + b.h));
    const dx = nx - cx;
    const dy = ny - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      nx = cx + (dx / d) * r;
      ny = cy + (dy / d) * r;
    } else if (d2 <= 0.0001) {
      ny = b.y - r;
    }
  }
  nx = Math.max(r, Math.min(city.size - r, nx));
  ny = Math.max(r, Math.min(city.size - r, ny));
  return { x: nx, y: ny };
}

function nearestCar(x, y, maxD) {
  let best = null;
  let bd = maxD;
  for (const c of state.world.cars) {
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

function toggleCar() {
  const p = state.player;
  if (p.inCar) {
    const car = p.inCar;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
    const fixed = collideBuildings(p.x, p.y, 12);
    p.x = fixed.x; p.y = fixed.y;
    car.driver = null;
    car.speed = 0;
    p.inCar = null;
    sfx.door();
  } else {
    const car = nearestCar(p.x, p.y, 56);
    if (car) {
      if (car.police) { announce('That is a police cruiser — too hot to steal.'); return; }
      const wasTraffic = car.traffic;
      car.traffic = false;
      car.driver = 'player';
      p.inCar = car;
      p.x = car.x; p.y = car.y;
      sfx.door();
      if (wasTraffic) { addWanted(18); announce('Car stolen! Police are watching.'); }
      else announce('You got in. Drive with W/S, steer with A/D.');
    }
  }
}

function shoot() {
  const p = state.player;
  if (!state.hasPistol || state.ammo <= 0 || p.inCar) return;
  state.ammo--;
  sfx.shot();
  const pp = playerPos();
  const mx = pp.x + Math.cos(p.angle) * 16;
  const my = pp.y + Math.sin(p.angle) * 16;
  state.flashes.push({ x: mx, y: my, t: 0.07 });
  let endX = pp.x + Math.cos(p.angle) * 520;
  let endY = pp.y + Math.sin(p.angle) * 520;
  let hit = null;
  let hitD = 520;
  const test = (ox, oy, r, obj, kind) => {
    const vx = Math.cos(p.angle);
    const vy = Math.sin(p.angle);
    const rx = ox - pp.x;
    const ry = oy - pp.y;
    const along = rx * vx + ry * vy;
    if (along < 0 || along > hitD) return;
    const perp = Math.abs(rx * -vy + ry * vx);
    if (perp < r) { hit = { obj, kind }; hitD = along; endX = pp.x + vx * along; endY = pp.y + vy * along; }
  };
  for (const ped of state.world.peds) if (ped.alive) test(ped.x, ped.y, 12, ped, 'ped');
  for (const car of state.world.cars) test(car.x, car.y, 20, car, 'car');
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(endX, b.x + b.w));
    const cy = Math.max(b.y, Math.min(endY, b.y + b.h));
    if (Math.hypot(endX - cx, endY - cy) < 4) { /* wall hit visual only */ }
  }
  state.tracers.push({ x1: mx, y1: my, x2: endX, y2: endY, t: 0.09 });
  if (hit && hit.kind === 'ped') {
    hit.obj.alive = false;
    hit.obj.downT = 8;
    state.money += 15;
    addWanted(30);
    announce('Pedestrian down. Wanted level rising!');
  } else if (hit && hit.kind === 'car') {
    hit.obj.hp -= 25;
    addWanted(hit.obj.police ? 35 : 12);
    if (hit.obj.hp <= 0) { hit.obj.speed = 0; hit.obj.dead = true; }
  } else {
    addWanted(6);
  }
}

function die() {
  state.mode = 'dead';
  state.deadT = 0;
  sfx.crash();
  announce('You were taken out. Respawning at the garage…');
}

function respawn() {
  const penalty = Math.min(100, Math.max(25, Math.floor(state.money * 0.1)));
  state.money = Math.max(0, state.money - penalty);
  state.health = 100;
  state.wanted = 0;
  state.wantedHeat = 0;
  state.player.inCar = null;
  spawnSafe(state, city, rng);
  state.mode = 'play';
  announce('Back on your feet. Hospital fee $' + penalty + '.');
  storeSave(state);
}

function update(dt) {
  state.time += dt;
  if (state.messageT > 0) state.messageT -= dt;
  for (const t of state.tracers) t.t -= dt;
  state.tracers = state.tracers.filter((t) => t.t > 0);
  for (const f of state.flashes) f.t -= dt;
  state.flashes = state.flashes.filter((f) => f.t > 0);

  if (state.mode === 'dead') {
    state.deadT += dt;
    if (state.deadT > 2.2 || input.consume('enter') || input.clicked) respawn();
    input.clicked = false;
    return;
  }
  if (state.mode !== 'play') return;

  if (input.consume('pause')) { state.mode = 'pause'; return; }
  if (input.consume('use')) toggleCar();
  input.clicked = false; // clicks are menu/death inputs; never carry a stale one into play
  // Pistol fire rate: one shot per 0.18s while the mouse is held.
  if (input.mouseDown && !state.player.inCar && state.time - (state._lastShot || 0) > 0.18) {
    state._lastShot = state.time;
    shoot();
  }

  const p = state.player;
  const pp = playerPos();
  // Aim follows mouse in world space.
  const mwx = state.cam.x + input.mouse.x;
  const mwy = state.cam.y + input.mouse.y;
  if (!p.inCar) p.angle = Math.atan2(mwy - pp.y, mwx - pp.x);

  if (p.inCar) {
    const car = p.inCar;
    const fwd = (input.down('up') ? 1 : 0) + (input.down('down') ? -0.6 : 0);
    const steer = (input.down('left') ? -1 : 0) + (input.down('right') ? 1 : 0);
    const accel = fwd >= 0 ? CFG.carAccel : CFG.carBrake;
    car.speed += fwd * accel * dt;
    car.speed -= car.speed * CFG.carDrag * dt;
    car.speed = Math.max(-CFG.carReverse, Math.min(CFG.carMax, car.speed));
    // Low-speed steering: always steerable, no dead zone.
    const steerPower = 1.9 * (0.45 + Math.min(1, Math.abs(car.speed) / 140));
    if (steer !== 0) {
      const dir = car.speed < -4 ? -1 : 1;
      car.angle += steer * steerPower * dt * dir;
    }
    if (input.down('handbrake')) car.speed -= car.speed * 2.2 * dt;
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const fixed = collideBuildings(nx, ny, 18);
    if (fixed.x !== nx || fixed.y !== ny) {
      if (Math.abs(car.speed) > 160) { state.health -= 6; sfx.crash(); }
      car.speed *= 0.55;
    }
    car.x = fixed.x; car.y = fixed.y;
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    sfx.engine(Math.abs(car.speed) / CFG.carMax);
    // Run-over peds.
    for (const ped of state.world.peds) {
      if (ped.alive && Math.hypot(ped.x - car.x, ped.y - car.y) < 22 && Math.abs(car.speed) > 40) {
        ped.alive = false; ped.downT = 8; addWanted(25); state.health -= 2;
      }
    }
  } else {
    let mx = (input.down('right') ? 1 : 0) - (input.down('left') ? 1 : 0);
    let my = (input.down('down') ? 1 : 0) - (input.down('up') ? 1 : 0);
    const len = Math.hypot(mx, my) || 1;
    const run = input.down('run') ? 1.5 : 1;
    const sp = CFG.walkSpeed * run;
    const nx = p.x + (mx / len) * sp * dt * (mx || my ? 1 : 0);
    const ny = p.y + (my / len) * sp * dt * (mx || my ? 1 : 0);
    const fixed = collideBuildings(nx, ny, 12);
    p.x = fixed.x; p.y = fixed.y;
    if (mx || my) p.walkPhase += dt * 10;
    sfx.engine(0);
  }

  updateTraffic(state, city, rng, dt);
  updatePeds(state, city, rng, dt);
  updatePolice(state, city, rng, dt);

  // Wanted decay when unseen and slow.
  const policeNear = state.world.cars.some((c) => c.police && !c.dead && Math.hypot(c.x - pp.x, c.y - pp.y) < 420);
  if (!policeNear && state.wantedHeat > 0) state.wantedHeat = Math.max(0, state.wantedHeat - dt * 3.2);
  state.wanted = state.wantedHeat <= 0 ? 0 : Math.min(5, 1 + Math.floor(state.wantedHeat / 22));
  if (policeNear && state.wanted > 0) sfx.siren();

  // Pickups.
  for (const pk of state.world.pickups) {
    if (pk.taken) continue;
    if (Math.hypot(pk.x - pp.x, pk.y - pp.y) < 30) {
      if (pk.kind === 'pistol') { state.hasPistol = true; state.ammo += 60; pk.taken = true; sfx.pickup(); announce('Pistol picked up! Aim with mouse, click to shoot.'); }
      if (pk.kind === 'cash') { state.money += 50; pk.taken = true; sfx.cash(); announce('+$50 cash drop.'); }
      if (pk.kind === 'health') { state.health = Math.min(100, state.health + 40); pk.taken = true; sfx.pickup(); announce('+40 health.'); }
    }
  }

  advanceMission(state, city, dt, announce, sfx);

  if (state.health <= 0) { state.health = 0; die(); return; }
  if (Math.floor(state.time * 2) !== Math.floor((state.time - dt) * 2)) storeSave(state);
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - (frame.last || now)) / 1000 || 0.016);
  frame.last = now;

  if (state.mode === 'menu') {
    if (input.consume('enter') || input.clicked) { state.mode = 'play'; sfx.resume(); announce('Welcome to Neon Bay. Follow the gold marker.'); }
    input.clicked = false;
  } else if (state.mode === 'pause') {
    if (input.consume('pause') || input.consume('enter') || input.clicked) state.mode = 'play';
    input.clicked = false;
  } else {
    update(dt);
  }

  const pp = playerPos();
  state.cam.x = Math.max(0, Math.min(city.size - canvas.width, pp.x - canvas.width / 2));
  state.cam.y = Math.max(0, Math.min(city.size - canvas.height, pp.y - canvas.height / 2));
  if (city.size < canvas.width) state.cam.x = 0;
  if (city.size < canvas.height) state.cam.y = 0;

  drawWorld(ctx, canvas, state, city);
  if (state.mode === 'play' || state.mode === 'pause' || state.mode === 'dead') {
    drawHud(ctx, canvas, state);
    drawMinimap(ctx, canvas, state, city);
  }
  drawMenus(ctx, canvas, state);
}

applyShot(state, city, rng, announce);
if (state.shot) state.mode = 'play';
window.__neon = state;
window.__neonReady = true;
requestAnimationFrame(frame);

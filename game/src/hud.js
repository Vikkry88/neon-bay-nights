// The HUD: cash, health, wanted stars, the mission objective, speed, the context prompt
// (what E does right now), the toast message, and the mute indicator. Drawing only — it
// reads the world state and paints text and bars on the main canvas.

import { CAR, FONT, PALETTE, STEAL_RADIUS } from './config.js';
import { drawMinimap } from './minimap.js';

const FIELD_W = 1280;
const FIELD_H = 720;

/** Build a font string directly: the renderer's font cache only holds sizes its own
 * text() calls have used, so looking sizes up there silently renders the HUD in
 * whatever font the context happened to hold (10px by default). */
function hudFont(size) {
  return `${size}px ${FONT}`;
}

function star(ctx, cx, cy, r, filled) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = filled ? PALETTE.wanted : 'rgba(244, 241, 232, 0.25)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(16, 22, 35, 0.8)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function drawHud(ctx, state, fonts) {
  const p = state.player;
  ctx.textBaseline = 'top';
  // A dark strip behind the whole top row (cash, health, objective, stars) so the
  // text stays readable whatever the world behind it is doing — a police cruiser
  // driving under the objective title must not swallow the words.
  ctx.fillStyle = 'rgba(16, 22, 35, 0.55)';
  ctx.fillRect(0, 0, FIELD_W, 100);
  // Cash, top left.
  ctx.font = hudFont(28);
  ctx.fillStyle = PALETTE.gold;
  ctx.textAlign = 'left';
  ctx.fillText(`$${state.money.toLocaleString('en-US')}`, 20, 16);
  // Health bar under the cash.
  ctx.fillStyle = 'rgba(16, 22, 35, 0.7)';
  ctx.fillRect(20, 50, 180, 14);
  ctx.fillStyle = p.health > 30 ? PALETTE.health : PALETTE.red;
  ctx.fillRect(20, 50, Math.max(0, 180 * (p.health / 100)), 14);
  ctx.strokeStyle = 'rgba(244, 241, 232, 0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(20, 50, 180, 14);
  ctx.font = hudFont(14);
  ctx.fillStyle = PALETTE.text;
  ctx.fillText('HEALTH', 206, 50);
  // Wanted stars, top right.
  const starR = 13;
  const gap = 30;
  const totalW = 5 * gap;
  for (let i = 0; i < 5; i += 1) {
    star(ctx, FIELD_W - 20 - totalW + i * gap + starR, 30, starR, i < state.wanted);
  }
  ctx.font = hudFont(14);
  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText(state.wanted > 0 ? 'WANTED' : '', FIELD_W - 20, 56);
  // Mission objective, top centre.
  const objective = state.mission.objective();
  if (objective) {
    ctx.font = hudFont(20);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.marker;
    ctx.fillText(`${objective.name}  (${objective.step + 1}/${objective.total})`, FIELD_W / 2, 16);
    ctx.font = hudFont(17);
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(objective.text, FIELD_W / 2, 44);
    // Timed job: show the seconds left under the objective so the deadline is visible.
    const active = state.mission.active;
    if (active && active.def.timeLimit) {
      const left = Math.max(0, Math.ceil(active.def.timeLimit - active.timer));
      ctx.font = hudFont(18);
      ctx.fillStyle = left <= 15 ? PALETTE.red : PALETTE.gold;
      ctx.fillText(`${left}s left`, FIELD_W / 2, 70);
    }
  } else {
    ctx.font = hudFont(17);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.muted;
    const next = state.mission.nextAvailable(state.done);
    ctx.fillText(next ? 'No job active — press Enter for the next job' : 'All jobs done — Neon Bay is yours. Free roam!', FIELD_W / 2, 20);
  }
  // Speed, bottom right, when driving.
  if (p.car) {
    const kmh = Math.round(Math.abs(p.car.speed) * 0.32);
    ctx.font = hudFont(34);
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`${kmh}`, FIELD_W - 20, FIELD_H - 66);
    ctx.font = hudFont(14);
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('km/h', FIELD_W - 20, FIELD_H - 30);
    // Car condition bar.
    ctx.fillStyle = 'rgba(16, 22, 35, 0.7)';
    ctx.fillRect(FIELD_W - 200, FIELD_H - 88, 180, 10);
    ctx.fillStyle = p.car.health > CAR.health * 0.3 ? PALETTE.health : PALETTE.red;
    ctx.fillRect(FIELD_W - 200, FIELD_H - 88, Math.max(0, 180 * (p.car.health / CAR.health)), 10);
    ctx.font = hudFont(12);
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('CAR', FIELD_W - 206, FIELD_H - 90);
  }
  // Pistol ammo, bottom centre-right when armed on foot.
  if (!p.car && p.hasPistol) {
    ctx.font = hudFont(18);
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`PISTOL  ${p.ammo} / 12`, FIELD_W - 20, FIELD_H - 120);
  }
  // Context prompt: what E does right now. The mission-marked coupe wins over any
  // other car in reach, the same way the steal itself prefers it.
  if (!p.car) {
    let nearest = null;
    let bestD = STEAL_RADIUS;
    if (state.targetCar && Math.hypot(p.x - state.targetCar.x, p.y - state.targetCar.y) < bestD) {
      nearest = state.targetCar;
    } else {
      for (const car of state.cars) {
        if (car.dead) continue;
        const d = Math.hypot(p.x - car.x, p.y - car.y);
        if (d < bestD) { bestD = d; nearest = car; }
      }
    }
    if (nearest) {
      ctx.font = hudFont(18);
      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.text;
      ctx.fillText(nearest === state.targetCar ? 'Press E — steal the marked coupe' : 'Press E — steal this car', FIELD_W / 2, FIELD_H - 44);
    }
  } else {
    ctx.font = hudFont(16);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('E — get out    •    W/S — drive    •    A/D — steer', FIELD_W / 2, FIELD_H - 44);
  }
  // Toast message, above the bottom centre.
  if (state.message.text && state.time < state.message.until) {
    ctx.font = hudFont(18);
    ctx.textAlign = 'center';
    const w = ctx.measureText(state.message.text).width + 32;
    ctx.fillStyle = 'rgba(16, 22, 35, 0.78)';
    ctx.fillRect(FIELD_W / 2 - w / 2, FIELD_H - 116, w, 32);
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(state.message.text, FIELD_W / 2, FIELD_H - 109);
  }
  // Controls hint, bottom left above the minimap.
  ctx.font = hudFont(13);
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(244, 241, 232, 0.75)';
  ctx.fillText('WASD move / drive   •   Mouse aim   •   Click shoot   •   Space punch   •   P pause   •   M mute', 16, FIELD_H - 186);
  drawMinimap(ctx, state, FIELD_H);
}

// World rendering: roads, buildings, beach, cars, people, labels.
import { WORLD_W, WORLD_H, ROAD_W, COLORS, CAR_W, CAR_H } from './config.js';

function drawCar(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = car.dead ? '#1f2937' : car.color;
  ctx.fillRect(-CAR_W / 2, -CAR_H / 2, CAR_W, CAR_H);
  ctx.fillStyle = 'rgba(15,23,42,0.85)';
  ctx.fillRect(-8, -CAR_H / 2 + 3, 16, CAR_H - 6);
  if (car.police && !car.dead) {
    ctx.fillStyle = COLORS.policeStripe;
    ctx.fillRect(-CAR_W / 2, -3, CAR_W, 6);
    const blink = Math.sin(time * 10 + car.sirenPhase) > 0;
    ctx.fillStyle = blink ? '#ef4444' : '#3b82f6';
    ctx.fillRect(-5, -CAR_H / 2 - 3, 10, 5);
  }
  ctx.restore();
}

export function drawWorld(ctx, state, cam, time) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.save();
  ctx.translate(-cam.x + (state.shake ? (Math.random() - 0.5) * state.shake : 0), -cam.y + (state.shake ? (Math.random() - 0.5) * state.shake : 0));
  // ground
  ctx.fillStyle = '#3f4a3a';
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  // beach + sea
  ctx.fillStyle = COLORS.sand;
  ctx.fillRect(0, state.city.beachY - 40, WORLD_W, 60);
  ctx.fillStyle = COLORS.water;
  ctx.fillRect(0, state.city.beachY + 20, WORLD_W, WORLD_H - state.city.beachY);
  ctx.fillStyle = COLORS.waterDeep;
  ctx.fillRect(0, state.city.beachY + 120, WORLD_W, WORLD_H - state.city.beachY - 120);
  // parks
  for (const p of state.city.parks) { ctx.fillStyle = COLORS.grass; ctx.fillRect(p.x, p.y, p.w, p.h); }
  // sidewalks + roads
  ctx.fillStyle = COLORS.sidewalk;
  for (const cx of state.city.xs) ctx.fillRect(cx - ROAD_W / 2 - 14, 0, ROAD_W + 28, WORLD_H);
  for (const cy of state.city.ys) ctx.fillRect(0, cy - ROAD_W / 2 - 14, WORLD_W, ROAD_W + 28);
  ctx.fillStyle = COLORS.road;
  for (const cx of state.city.xs) ctx.fillRect(cx - ROAD_W / 2, 0, ROAD_W, WORLD_H);
  for (const cy of state.city.ys) ctx.fillRect(0, cy - ROAD_W / 2, WORLD_W, ROAD_W);
  // lane dashes
  ctx.fillStyle = COLORS.roadLine;
  for (const cx of state.city.xs) for (let y = 10; y < WORLD_H; y += 40) ctx.fillRect(cx - 2, y, 4, 18);
  for (const cy of state.city.ys) for (let x = 10; x < WORLD_W; x += 40) ctx.fillRect(x, cy - 2, 18, 4);
  // traffic lights
  for (const l of state.city.lights) {
    const green = Math.sin(time * 0.7 + l.phase) > 0;
    ctx.fillStyle = green ? '#22c55e' : '#ef4444';
    ctx.beginPath(); ctx.arc(l.x + ROAD_W / 2 + 8, l.y - ROAD_W / 2 - 8, 5, 0, 6.29); ctx.fill();
  }
  // buildings
  for (const b of state.city.buildings) {
    ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = COLORS.roof; ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
    ctx.fillStyle = 'rgba(253,224,71,0.55)';
    for (let i = 0; i < b.floors; i++) ctx.fillRect(b.x + 8 + i * 10, b.y + 10, 5, 5);
  }
  // garage ring (yellow)
  const g = state.city.garage;
  ctx.strokeStyle = '#facc15'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, 6.29); ctx.stroke();
  ctx.strokeStyle = 'rgba(250,204,21,0.35)'; ctx.lineWidth = 14;
  ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, 6.29); ctx.stroke();
  // mission marker
  if (state.marker) {
    const pulse = 18 + Math.sin(time * 4) * 5;
    ctx.fillStyle = 'rgba(255,46,136,0.3)';
    ctx.beginPath(); ctx.arc(state.marker.x, state.marker.y, pulse + 10, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#ff2e88';
    ctx.beginPath(); ctx.arc(state.marker.x, state.marker.y, 10, 0, 6.29); ctx.fill();
  }
  // pickups with beacon for pistol
  for (const pk of state.city.pickups) {
    if (pk.taken) continue;
    if (pk.kind === 'pistol') {
      const r = 26 + Math.sin(time * 5) * 6;
      ctx.fillStyle = 'rgba(250,204,21,0.25)';
      ctx.beginPath(); ctx.arc(pk.x, pk.y, r, 0, 6.29); ctx.fill();
      ctx.fillStyle = '#facc15'; ctx.fillRect(pk.x - 8, pk.y - 4, 16, 8);
    } else {
      ctx.fillStyle = '#ef4444'; ctx.fillRect(pk.x - 8, pk.y - 3, 16, 6); ctx.fillRect(pk.x - 3, pk.y - 8, 6, 16);
    }
  }
  // direction arrow to marker
  if (state.marker) {
    const p = state.player.inCar || state.player;
    const a = Math.atan2(state.marker.y - p.y, state.marker.x - p.x);
    ctx.save(); ctx.translate(p.x, p.y - 34); ctx.rotate(a);
    ctx.fillStyle = '#ff2e88';
    ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-8, -6); ctx.lineTo(-8, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // peds
  for (const ped of state.peds) {
    if (ped.dead) continue;
    ctx.fillStyle = ped.color;
    ctx.beginPath(); ctx.arc(ped.x, ped.y, 7, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#f8fafc'; ctx.fillRect(ped.x - 3, ped.y - 3, 6, 6);
  }
  // cars
  for (const c of state.cars) drawCar(ctx, c, time);
  for (const c of state.police) drawCar(ctx, c, time);
  // player on foot
  if (!state.player.inCar) {
    ctx.fillStyle = COLORS.player;
    ctx.beginPath(); ctx.arc(state.player.x, state.player.y, 11, 0, 6.29); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    const a = Math.atan2(state.aimY - state.player.y, state.aimX - state.player.x);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(state.player.x, state.player.y);
    ctx.lineTo(state.player.x + Math.cos(a) * 16, state.player.y + Math.sin(a) * 16); ctx.stroke();
  }
  // tracers
  for (const t of state.tracers) {
    ctx.strokeStyle = 'rgba(253,224,71,' + Math.max(0, t.life) + ')';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(t.x1, t.y1); ctx.lineTo(t.x2, t.y2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,200,60,' + Math.max(0, t.life) + ')';
    ctx.beginPath(); ctx.arc(t.x1, t.y1, 7, 0, 6.29); ctx.fill();
  }
  // particles
  for (const p of state.particles) {
    ctx.fillStyle = p.color; ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4); ctx.globalAlpha = 1;
  }
  // labels with de-overlap: stack vertically, drawn last on top
  const labels = [
    { text: 'GARAGE', x: g.x, y: g.y - g.r - 16, color: '#facc15' },
  ];
  for (const pk of state.city.pickups) {
    if (!pk.taken && pk.kind === 'pistol') labels.push({ text: 'PISTOL', x: pk.x, y: pk.y - 34, color: '#fde68a' });
  }
  if (state.marker) labels.push({ text: 'TARGET', x: state.marker.x, y: state.marker.y - 30, color: '#f9a8d4' });
  labels.sort((a, b) => a.y - b.y);
  let lastY = -1e9;
  ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
  for (const l of labels) {
    let y = l.y;
    if (y - lastY < 16) y = lastY + 16;
    lastY = y;
    const w = ctx.measureText(l.text).width + 10;
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(l.x - w / 2, y - 12, w, 16);
    ctx.fillStyle = l.color; ctx.fillText(l.text, l.x, y);
  }
  ctx.textAlign = 'left';
  ctx.restore();
}

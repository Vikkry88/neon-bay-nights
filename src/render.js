// Neon Bay Nights — world rendering.
// Label rules: world labels never overlap each other and never draw under the HUD.
import { CFG } from './config.js';
import { missionTarget } from './missions.js';

function drawCar(ctx, car, t) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  if (car.missionCar) {
    ctx.strokeStyle = '#ffd740';
    ctx.lineWidth = 3;
    ctx.strokeRect(-24, -14, 48, 28);
  }
  ctx.fillStyle = car.dead ? '#333344' : car.color;
  ctx.fillRect(-22, -11, 44, 22);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-10, -9, 18, 18);
  ctx.fillStyle = '#0b0e1a';
  ctx.fillRect(-18, -13, 8, 4);
  ctx.fillRect(10, -13, 8, 4);
  ctx.fillRect(-18, 9, 8, 4);
  ctx.fillRect(10, 9, 8, 4);
  if (car.police) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-8, -11, 16, 22);
    const blink = Math.floor(t * 6) % 2 === 0;
    ctx.fillStyle = blink ? '#ff1744' : '#2979ff';
    ctx.fillRect(-4, -4, 8, 8);
    ctx.fillStyle = blink ? 'rgba(255,23,68,0.25)' : 'rgba(41,121,255,0.25)';
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#fff9c4';
    ctx.fillRect(20, -8, 3, 5);
    ctx.fillRect(20, 3, 3, 5);
  }
  ctx.restore();
}

export function drawWorld(ctx, canvas, state, city) {
  const cam = state.cam;
  const t = state.time;
  ctx.save();
  ctx.fillStyle = CFG.colors.ground;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(-cam.x, -cam.y);

  // Streets.
  ctx.fillStyle = CFG.colors.street;
  const m = city.block;
  const s = city.street;
  for (let i = 0; i <= city.size / m; i++) {
    ctx.fillRect(i * m - s / 2, 0, s, city.size);
    ctx.fillRect(0, i * m - s / 2, city.size, s);
  }
  ctx.strokeStyle = CFG.colors.streetLine;
  ctx.lineWidth = 2;
  ctx.setLineDash([18, 22]);
  for (let i = 0; i <= city.size / m; i++) {
    ctx.beginPath();
    ctx.moveTo(i * m, 0);
    ctx.lineTo(i * m, city.size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * m);
    ctx.lineTo(city.size, i * m);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Parks.
  for (const p of city.parks) {
    ctx.fillStyle = '#173d2a';
    ctx.fillRect(p.x, p.y, p.w, p.h);
  }
  // Buildings.
  const shades = ['#2b3050', '#33284d', '#243447', '#3d2c3a', '#2a3a33', '#38304a'];
  for (const b of city.buildings) {
    ctx.fillStyle = shades[b.hue % shades.length];
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,230,120,0.5)';
    const cols = Math.max(2, Math.floor(b.w / 26));
    const rows = Math.max(2, Math.floor(b.h / 26));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if ((r * 7 + c * 13 + b.hue) % 3 === 0) ctx.fillRect(b.x + 8 + c * 24, b.y + 8 + r * 24, 8, 8);
      }
    }
  }
  // Neon signs.
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const sign of city.signs) {
    ctx.fillStyle = sign.color;
    ctx.globalAlpha = 0.75 + Math.sin(t * 2 + sign.x) * 0.2;
    ctx.fillText(sign.text, sign.x, sign.y);
  }
  ctx.globalAlpha = 1;

  // Garage yellow ring.
  const g = city.garage;
  ctx.strokeStyle = '#ffe600';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(g.x, g.y, 52, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,230,0,0.10)';
  ctx.beginPath();
  ctx.arc(g.x, g.y, 52, 0, Math.PI * 2);
  ctx.fill();

  // Mission target marker.
  const target = missionTarget(state, city);
  if (target) {
    const pulse = 26 + Math.sin(t * 5) * 6;
    ctx.strokeStyle = '#ffd740';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(target.x, target.y, pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,215,64,0.16)';
    ctx.beginPath();
    ctx.arc(target.x, target.y, pulse, 0, Math.PI * 2);
    ctx.fill();
    // Light pillar so it reads from far away.
    ctx.fillStyle = 'rgba(255,215,64,0.10)';
    ctx.fillRect(target.x - 5, target.y - 220, 10, 220);
  }

  // Pickups (pistol gets a tall beacon + ring).
  for (const pk of state.world.pickups) {
    if (pk.taken) continue;
    pk.pulse += 0.016;
    if (pk.kind === 'pistol') {
      ctx.fillStyle = 'rgba(0,229,255,0.12)';
      ctx.fillRect(pk.x - 4, pk.y - 260, 8, 260);
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(pk.x, pk.y, 20 + Math.sin(t * 6) * 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#00e5ff';
      ctx.fillRect(pk.x - 9, pk.y - 3, 18, 6);
      ctx.fillRect(pk.x + 4, pk.y + 2, 5, 8);
    } else if (pk.kind === 'cash') {
      ctx.fillStyle = '#00ffa3';
      ctx.beginPath();
      ctx.arc(pk.x, pk.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#06351f';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', pk.x, pk.y + 4);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(pk.x - 9, pk.y - 9, 18, 18);
      ctx.fillStyle = '#ff1744';
      ctx.fillRect(pk.x - 2, pk.y - 7, 4, 14);
      ctx.fillRect(pk.x - 7, pk.y - 2, 14, 4);
    }
  }

  // Pedestrians.
  for (const ped of state.world.peds) {
    if (!ped.alive) {
      ctx.fillStyle = 'rgba(180,180,200,0.5)';
      ctx.beginPath();
      ctx.ellipse(ped.x, ped.y, 12, 6, ped.angle, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe0b2';
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cars.
  for (const car of state.world.cars) drawCar(ctx, car, t);

  // Player (on foot).
  const p = state.player;
  if (!p.inCar) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#ff2d95';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe0b2';
    ctx.beginPath();
    ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
    ctx.fill();
    if (state.hasPistol) {
      ctx.fillStyle = '#111111';
      ctx.fillRect(6, -2, 14, 4);
    }
    ctx.restore();
  }

  // Tracers + muzzle flashes.
  ctx.strokeStyle = 'rgba(255,240,150,0.9)';
  ctx.lineWidth = 2;
  for (const tr of state.tracers) {
    ctx.beginPath();
    ctx.moveTo(tr.x1, tr.y1);
    ctx.lineTo(tr.x2, tr.y2);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,200,60,0.9)';
  for (const f of state.flashes) {
    ctx.beginPath();
    ctx.arc(f.x, f.y, 9, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  // --- Screen-space overlays: direction arrow + de-overlapped world labels ---
  const pp = state.player.inCar || state.player;
  if (target) {
    const dx = target.x - pp.x;
    const dy = target.y - pp.y;
    const dist = Math.hypot(dx, dy);
    const sx = target.x - cam.x;
    const sy = target.y - cam.y;
    const offscreen = sx < 30 || sy < 110 || sx > canvas.width - 30 || sy > canvas.height - 30;
    if (offscreen && dist > 80) {
      const ang = Math.atan2(dy, dx);
      const ax = canvas.width / 2 + Math.cos(ang) * 130;
      const ay = canvas.height / 2 + Math.sin(ang) * 100;
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(ang);
      ctx.fillStyle = '#ffd740';
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-10, -9);
      ctx.lineTo(-10, 9);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#ffd740';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(Math.round(dist) + 'm', ax, ay + 26);
    }
  }

  // Collect labels, then place them without overlap and below the HUD band.
  const labels = [];
  const addLabel = (wx, wy, text, color) => {
    const sx = wx - cam.x;
    const sy = wy - cam.y;
    if (sx < -80 || sx > canvas.width + 80 || sy < 100 || sy > canvas.height + 40) return;
    labels.push({ x: sx, y: sy - 34, text, color });
  };
  addLabel(g.x, g.y, 'GARAGE', '#ffe600');
  if (target) addLabel(target.x, target.y, target.label, '#ffd740');
  for (const pk of state.world.pickups) {
    if (pk.taken) continue;
    if (pk.kind === 'pistol') addLabel(pk.x, pk.y, 'PISTOL', '#00e5ff');
    if (pk.kind === 'health') addLabel(pk.x, pk.y, 'HEALTH', '#ffffff');
  }
  for (const car of state.world.cars) {
    if (car.missionCar && state.player.inCar !== car) addLabel(car.x, car.y, 'TARGET CAR', '#ffd740');
  }
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  const placed = [];
  for (const lb of labels) {
    let y = lb.y;
    let guard = 0;
    const collides = () => placed.some((q) => Math.abs(q.x - lb.x) < 92 && Math.abs(q.y - y) < 18);
    while (collides() && guard < 8) { y -= 18; guard++; }
    if (y < 100) continue; // never under the HUD
    placed.push({ x: lb.x, y });
    const tw = ctx.measureText(lb.text).width + 12;
    ctx.fillStyle = 'rgba(8,10,24,0.75)';
    ctx.fillRect(lb.x - tw / 2, y - 13, tw, 18);
    ctx.fillStyle = lb.color;
    ctx.fillText(lb.text, lb.x, y);
  }
}

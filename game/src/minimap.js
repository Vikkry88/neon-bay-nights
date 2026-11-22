// Minimap: scaled city overview with roads, sea, player arrow, police blips,
// the helicopter, mission marker, garage ring and pickups.

import { WORLD, BEACH_X, SEA_X, TUNING } from './config.js';

export function drawMinimap(ctx, state, x, y, size) {
  const scale = size / WORLD.width;
  ctx.save();
  ctx.fillStyle = 'rgba(10,14,28,0.82)';
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, size, size);

  // Sea + beach.
  ctx.fillStyle = '#1b7fa8';
  ctx.fillRect(x + SEA_X * scale, y, (WORLD.width - SEA_X) * scale, size);
  ctx.fillStyle = '#f4e3b2';
  ctx.fillRect(x + BEACH_X * scale, y, (SEA_X - BEACH_X) * scale, size);
  // Land.
  ctx.fillStyle = '#8d8570';
  ctx.fillRect(x, y, BEACH_X * scale, size);
  // Roads.
  ctx.fillStyle = '#555b66';
  const m = WORLD.block;
  const r = WORLD.road;
  for (let lx = 0; lx < WORLD.width; lx += m) ctx.fillRect(x + lx * scale, y, Math.max(1, r * scale), size);
  for (let ly = 0; ly < WORLD.height; ly += m) ctx.fillRect(x, y + ly * scale, size, Math.max(1, r * scale));

  // Garage ring.
  ctx.strokeStyle = '#ffd60a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x + TUNING.garage.x * scale, y + TUNING.garage.y * scale, 5, 0, Math.PI * 2);
  ctx.stroke();

  // Mission marker.
  if (state.missionMarker) {
    ctx.fillStyle = '#ffe600';
    ctx.beginPath();
    ctx.arc(x + state.missionMarker.x * scale, y + state.missionMarker.y * scale, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Pickups.
  ctx.fillStyle = '#ffffff';
  for (const p of state.pickups) {
    if (p.taken) continue;
    ctx.fillRect(x + p.x * scale - 1, y + p.y * scale - 1, 2, 2);
  }

  // Police + helicopter.
  ctx.fillStyle = '#ff2e2e';
  for (const cop of state.police) {
    ctx.beginPath();
    ctx.arc(x + cop.x * scale, y + cop.y * scale, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  if (state.heli.active) {
    ctx.fillStyle = '#ffe600';
    ctx.fillRect(x + state.heli.x * scale - 3, y + state.heli.y * scale - 3, 6, 6);
  }

  // Player arrow.
  const px = x + state.player.x * scale;
  const py = y + state.player.y * scale;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(state.player.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4, -4);
  ctx.lineTo(-4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = 'bold 9px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('NEON BAY', x + 4, y + 11);
  ctx.restore();
}

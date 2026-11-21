// Canvas minimap: streets, player, mission marker, police, garage.
import { WORLD_W, WORLD_H } from './config.js';

export function drawMinimap(ctx, state, mx, my, size) {
  const sx = size / WORLD_W, sy = size / WORLD_H;
  ctx.save();
  ctx.fillStyle = 'rgba(8,12,24,0.82)';
  ctx.fillRect(mx, my, size, size);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.strokeRect(mx, my, size, size);
  // beach + water
  ctx.fillStyle = '#14507d';
  ctx.fillRect(mx, my + state.city.beachY * sy, size, size - state.city.beachY * sy);
  ctx.fillStyle = '#e3c98a';
  ctx.fillRect(mx, my + (state.city.beachY - 40) * sy, size, 40 * sy);
  // roads
  ctx.strokeStyle = 'rgba(200,210,230,0.55)';
  ctx.lineWidth = 2;
  for (const cx of state.city.xs) { ctx.beginPath(); ctx.moveTo(mx + cx * sx, my); ctx.lineTo(mx + cx * sx, my + size); ctx.stroke(); }
  for (const cy of state.city.ys) { ctx.beginPath(); ctx.moveTo(mx, my + cy * sy); ctx.lineTo(mx + size, my + cy * sy); ctx.stroke(); }
  // garage
  ctx.fillStyle = '#facc15';
  ctx.fillRect(mx + state.city.garage.x * sx - 3, my + state.city.garage.y * sy - 3, 6, 6);
  // mission marker
  if (state.marker) {
    ctx.fillStyle = '#ff2e88';
    ctx.beginPath(); ctx.arc(mx + state.marker.x * sx, my + state.marker.y * sy, 4, 0, 6.29); ctx.fill();
  }
  // police
  ctx.fillStyle = '#3b82f6';
  for (const c of state.police) {
    if (c.dead) continue;
    ctx.fillRect(mx + c.x * sx - 2, my + c.y * sy - 2, 4, 4);
  }
  // player
  const p = state.player.inCar || state.player;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#f59e0b';
  ctx.beginPath(); ctx.arc(mx + p.x * sx, my + p.y * sy, 4, 0, 6.29); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = '10px monospace';
  ctx.fillText('NEON BAY', mx + 4, my + 12);
  ctx.restore();
}

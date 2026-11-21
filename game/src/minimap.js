// Neon Bay Nights — minimap (bottom-right).
import { missionTarget } from './missions.js';

export function drawMinimap(ctx, canvas, state, city) {
  const size = 168;
  const x0 = canvas.width - size - 14;
  const y0 = canvas.height - size - 14;
  const scale = size / city.size;
  ctx.save();
  ctx.fillStyle = 'rgba(8,10,24,0.85)';
  ctx.fillRect(x0 - 4, y0 - 4, size + 8, size + 8);
  ctx.strokeStyle = '#5a628f';
  ctx.strokeRect(x0 - 4, y0 - 4, size + 8, size + 8);
  ctx.fillStyle = '#1c2138';
  ctx.fillRect(x0, y0, size, size);
  // Streets.
  ctx.fillStyle = '#2c3358';
  const step = city.block * scale;
  for (let i = 0; i <= city.size / city.block; i++) {
    ctx.fillRect(x0 + i * step - 2, y0, 4, size);
    ctx.fillRect(x0, y0 + i * step - 2, size, 4);
  }
  // Garage.
  ctx.fillStyle = '#ffe600';
  ctx.fillRect(x0 + city.garage.x * scale - 3, y0 + city.garage.y * scale - 3, 6, 6);
  // Police.
  ctx.fillStyle = '#4fc3f7';
  for (const c of state.world.cars) {
    if (c.police && !c.dead) ctx.fillRect(x0 + c.x * scale - 2, y0 + c.y * scale - 2, 4, 4);
  }
  // Mission target (pulsing gold).
  const target = missionTarget(state, city);
  if (target) {
    const pulse = 3 + Math.sin(state.time * 5) * 1.2;
    ctx.fillStyle = '#ffd740';
    ctx.beginPath();
    ctx.arc(x0 + target.x * scale, y0 + target.y * scale, pulse + 2, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player.
  const pp = state.player.inCar || state.player;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x0 + pp.x * scale, y0 + pp.y * scale, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ff2d95';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#cfd6ff';
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('NEON BAY', x0, y0 - 8);
  ctx.restore();
}

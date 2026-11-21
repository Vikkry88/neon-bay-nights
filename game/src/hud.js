// HUD: cash, health, wanted stars, objective, speed, ammo.
import { drawMinimap } from './minimap.js';
import { stageBanner } from './missions.js';

export function drawHud(ctx, state) {
  const W = ctx.canvas.width;
  ctx.save();
  ctx.font = 'bold 16px monospace';
  // cash + health top-right
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(W - 260, 10, 250, 64);
  ctx.fillStyle = '#4ade80';
  ctx.fillText('$' + Math.floor(state.money), W - 250, 32);
  ctx.fillStyle = '#f8fafc';
  ctx.fillText('HP ' + Math.max(0, Math.round(state.player.hp)), W - 250, 54);
  ctx.fillStyle = '#334155'; ctx.fillRect(W - 190, 44, 120, 10);
  ctx.fillStyle = '#ef4444'; ctx.fillRect(W - 190, 44, 120 * Math.max(0, state.player.hp) / 100, 10);
  // wanted stars
  ctx.font = 'bold 20px monospace';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < state.wanted ? '#facc15' : 'rgba(255,255,255,0.25)';
    ctx.fillText('*', W - 250 + i * 22, 92);
  }
  // speed + ammo
  const spd = state.player.inCar ? Math.round(Math.abs(state.player.inCar.speed)) : 0;
  ctx.font = 'bold 14px monospace';
  ctx.fillStyle = '#e2e8f0';
  ctx.fillText(spd + ' km/h', W - 250, 114);
  if (state.hasPistol) ctx.fillText('PISTOL ' + state.ammo, W - 160, 114);
  // objective banner (stage-aware)
  const banner = state.banner || stageBanner(state.mission, state.missionStage);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  const bw = Math.min(W - 40, 760);
  ctx.fillRect((W - bw) / 2, 10, bw, 30);
  ctx.fillStyle = '#fde68a';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(banner, W / 2, 30);
  ctx.textAlign = 'left';
  // controls hint bottom
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(10, ctx.canvas.height - 34, 640, 24);
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '12px monospace';
  ctx.fillText('WASD move/drive  E enter/exit  Click punch/shoot  P pause  M mute  Enter job', 16, ctx.canvas.height - 18);
  // minimap bottom-right
  drawMinimap(ctx, state, W - 170, ctx.canvas.height - 170, 160);
  ctx.restore();
}

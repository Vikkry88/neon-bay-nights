// Neon Bay Nights — HUD and menus (canvas-drawn).
import { missionBanner } from './missions.js';

export function drawHud(ctx, canvas, state) {
  const w = canvas.width;
  ctx.save();
  // Top bar background so world labels never hide under it (render skips y<96).
  ctx.fillStyle = 'rgba(8,10,24,0.78)';
  ctx.fillRect(0, 0, w, 86);
  ctx.fillStyle = '#ff2d95';
  ctx.fillRect(0, 86, w, 2);

  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillStyle = '#ffe600';
  ctx.textAlign = 'left';
  ctx.fillText('$' + Math.floor(state.money), 16, 30);

  // Health bar.
  ctx.fillStyle = '#2a2f4d';
  ctx.fillRect(16, 40, 180, 14);
  ctx.fillStyle = state.health > 35 ? '#00ffa3' : '#ff5252';
  ctx.fillRect(16, 40, 180 * Math.max(0, state.health) / 100, 14);
  ctx.strokeStyle = '#5a628f';
  ctx.strokeRect(16, 40, 180, 14);
  ctx.fillStyle = '#cfd6ff';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('HEALTH ' + Math.ceil(state.health), 16, 70);

  // Wanted stars.
  ctx.font = '22px system-ui, sans-serif';
  ctx.textAlign = 'right';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < state.wanted ? '#ffe600' : '#3a4066';
    ctx.fillText('★', w - 16 - i * 26, 32);
  }
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = '#cfd6ff';
  ctx.fillText(state.wanted > 0 ? 'WANTED — lose the police!' : 'No heat', w - 16, 52);

  // Weapon / vehicle line.
  ctx.textAlign = 'right';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = '#9be7ff';
  const veh = state.player.inCar ? 'DRIVING — E to exit' : 'ON FOOT — E to enter a car';
  ctx.fillText(veh, w - 16, 70);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffb3d9';
  ctx.fillText(state.hasPistol ? 'PISTOL  ammo ' + state.ammo : 'No weapon — find the PISTOL beacon', 216, 30);

  // Stage-aware mission banner.
  ctx.textAlign = 'center';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  const banner = missionBanner(state);
  ctx.fillText(banner, w / 2, 108);

  // Toast message.
  if (state.messageT > 0 && state.message) {
    ctx.font = '14px system-ui, sans-serif';
    const tw = ctx.measureText(state.message).width + 28;
    ctx.fillStyle = 'rgba(8,10,24,0.82)';
    ctx.fillRect((w - tw) / 2, canvas.height - 58, tw, 30);
    ctx.fillStyle = '#ffe600';
    ctx.fillText(state.message, w / 2, canvas.height - 38);
  }
  ctx.restore();
}

export function drawMenus(ctx, canvas, state) {
  const w = canvas.width;
  const h = canvas.height;
  ctx.save();
  if (state.mode === 'menu') {
    ctx.fillStyle = 'rgba(5,6,16,0.82)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff2d95';
    ctx.font = 'bold 52px system-ui, sans-serif';
    ctx.fillText('NEON BAY NIGHTS', w / 2, h / 2 - 120);
    ctx.fillStyle = '#00e5ff';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText('A top-down open-world crime game in the city of Neon Bay', w / 2, h / 2 - 84);
    ctx.fillStyle = '#e8ebff';
    ctx.font = '15px system-ui, sans-serif';
    const lines = [
      'WASD / Arrows — walk & drive      E — enter / exit car',
      'Mouse — aim      Click — shoot (after the pistol pickup)',
      'Shift — run      Space — handbrake      P / Esc — pause',
      'Complete 5 fixer missions. Steal cars, grab cash, outrun the police.',
      'Police keep their distance — you can always drive away.',
    ];
    lines.forEach((line, i) => ctx.fillText(line, w / 2, h / 2 - 36 + i * 24));
    ctx.fillStyle = '#ffe600';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('Press ENTER or click to play', w / 2, h / 2 + 130);
  } else if (state.mode === 'pause') {
    ctx.fillStyle = 'rgba(5,6,16,0.7)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px system-ui, sans-serif';
    ctx.fillText('PAUSED', w / 2, h / 2 - 10);
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillStyle = '#cfd6ff';
    ctx.fillText('Press P, Esc, Enter or click to resume', w / 2, h / 2 + 28);
  } else if (state.mode === 'dead') {
    ctx.fillStyle = 'rgba(60,0,10,0.62)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff5252';
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.fillText('TAKEN OUT', w / 2, h / 2 - 12);
    ctx.fillStyle = '#ffffff';
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText('Respawning at the garage with a small hospital fee…', w / 2, h / 2 + 24);
  }
  ctx.restore();
}

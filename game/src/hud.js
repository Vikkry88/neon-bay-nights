// Heads-up display: money/health/armor, wanted stars + named dispatch tier
// banner, speedometer gauge, mission objective + timer, district respect,
// radio station, current weapon + ammo, Marlowe's dialogue box, the weapon
// wheel, direction arrow to the objective, and start/pause/death screens.

import { DISPATCH_TIERS, WEAPONS, RADIO_STATIONS, DISTRICTS } from './config.js';
import { drawMinimap } from './minimap.js';

export function drawHud(ctx, view, state) {
  const { player, save } = state;
  ctx.save();
  ctx.textBaseline = 'alphabetic';

  // Top-left: cash, health, armor.
  panel(ctx, 12, 12, 220, 78);
  ctx.fillStyle = '#7bf1a8';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`$${save.money.toLocaleString('en-US')}`, 22, 40);
  bar(ctx, 22, 50, 190, 10, player.health / 100, '#ff5d8f', 'HP');
  bar(ctx, 22, 66, 190, 10, player.armor / 100, '#4cc9f0', 'ARM');

  // Top-right: wanted stars + dispatch tier.
  const tier = DISPATCH_TIERS[state.wanted];
  ctx.textAlign = 'right';
  ctx.font = 'bold 24px system-ui, sans-serif';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < state.wanted ? '#ffe600' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', view.w - 16 - i * 26, 38);
  }
  if (state.wanted > 0) {
    ctx.fillStyle = '#ff5964';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(tier.name.toUpperCase(), view.w - 16, 60);
  }

  // Dispatch banner when the tier changes.
  if (state.bannerTime > 0 && state.wanted > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, state.bannerTime);
    ctx.fillStyle = 'rgba(160,10,30,0.85)';
    ctx.fillRect(view.w / 2 - 190, 14, 380, 34);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`DISPATCH: ${tier.name.toUpperCase()}`, view.w / 2, 37);
    ctx.restore();
  }

  // Objective + mission timer (top centre).
  if (state.job) {
    panel(ctx, view.w / 2 - 260, 56, 520, 52);
    ctx.fillStyle = '#ffe600';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${state.job.title} — ${state.stageLabel}`, view.w / 2, 78);
    ctx.fillStyle = state.missionTime < 20 ? '#ff5964' : '#ffffff';
    ctx.font = 'bold 14px system-ui, sans-serif';
    const mins = Math.floor(Math.max(0, state.missionTime) / 60);
    const secs = Math.floor(Math.max(0, state.missionTime) % 60);
    ctx.fillText(`⏱ ${mins}:${String(secs).padStart(2, '0')}  ·  Reward $${state.job.reward.toLocaleString('en-US')}`, view.w / 2, 99);
  } else if (state.storyDone) {
    panel(ctx, view.w / 2 - 260, 56, 520, 34);
    ctx.fillStyle = '#7bf1a8';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Story complete — Neon Bay is yours. Free roam!', view.w / 2, 78);
  }

  // Bottom-left: district + respect + radio.
  panel(ctx, 12, view.h - 96, 250, 84);
  ctx.textAlign = 'left';
  ctx.fillStyle = state.district.color;
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.fillText(state.district.name.toUpperCase(), 22, view.h - 70);
  const respect = save.respect[state.district.id] || 0;
  bar(ctx, 22, view.h - 62, 220, 9, respect / 100, state.district.color, `Respect ${Math.round(respect)}%`);
  const station = RADIO_STATIONS.find((s) => s.id === save.radio) || RADIO_STATIONS[0];
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(`♪ ${station.name}`, 22, view.h - 22);

  // Bottom-right: weapon + ammo, speedometer above it.
  const weapon = WEAPONS[state.weaponIndex];
  panel(ctx, view.w - 232, view.h - 62, 220, 50);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px system-ui, sans-serif';
  const ammoText = weapon.id === 'fists' ? '∞' : `${save.ammo[weapon.id] || 0}`;
  ctx.fillText(`${weapon.name}  ${ammoText}`, view.w - 22, view.h - 30);
  if (player.inCar) drawSpeedometer(ctx, view.w - 120, view.h - 150, player.carSpeedKmh);

  // Minimap top-right, below the stars and dispatch tier name.
  drawMinimap(ctx, state, view.w - 172, 88, 160);

  // Marlowe dialogue box.
  if (state.dialogue && state.dialogueTime > 0) drawDialogue(ctx, view, state.dialogue);

  // Direction arrow to the objective (screen edge of player).
  if (state.missionMarker) drawObjectiveArrow(ctx, view, state);

  // Weapon wheel.
  if (state.wheelOpen) drawWeaponWheel(ctx, view, state);

  // Centre message (pickups, job done, etc).
  if (state.message && state.messageTime > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, state.messageTime);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 6;
    ctx.fillText(state.message, view.w / 2, view.h / 2 - 120);
    ctx.restore();
  }

  // Controls hint (fades after the first seconds of a fresh game).
  if (state.hintTime > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('WASD move/drive · E car · Mouse aim + click shoot · Q weapon wheel · R radio · P pause · M mute', view.w / 2, view.h - 14);
  }

  ctx.restore();
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(8,10,22,0.72)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
}

function bar(ctx, x, y, w, h, ratio, color, label) {
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, ratio)), h);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 9px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, x + 4, y + h - 2);
}

function drawSpeedometer(ctx, cx, cy, kmh) {
  const radius = 58;
  ctx.save();
  ctx.fillStyle = 'rgba(8,10,22,0.78)';
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.stroke();
  const start = Math.PI * 0.75;
  const sweep = Math.PI * 1.5;
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, start, start + sweep);
  ctx.stroke();
  const frac = Math.min(1, kmh / 220);
  ctx.strokeStyle = kmh > 160 ? '#ff5964' : '#ffe600';
  ctx.beginPath();
  ctx.arc(cx, cy, radius, start, start + sweep * frac);
  ctx.stroke();
  const needle = start + sweep * frac;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(needle) * (radius - 8), cy + Math.sin(needle) * (radius - 8));
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(kmh)}`, cx, cy + 26);
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.fillText('km/h', cx, cy + 40);
  ctx.restore();
}

function drawDialogue(ctx, view, text) {
  const w = Math.min(640, view.w - 60);
  const x = view.w / 2 - w / 2;
  const y = view.h - 150;
  ctx.save();
  ctx.fillStyle = 'rgba(8,10,22,0.88)';
  ctx.fillRect(x, y, w, 64);
  ctx.strokeStyle = '#fca311';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, 64);
  // Portrait box.
  ctx.fillStyle = '#14213d';
  ctx.fillRect(x + 8, y + 8, 48, 48);
  ctx.fillStyle = '#f2c9a0';
  ctx.beginPath();
  ctx.arc(x + 32, y + 28, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fca311';
  ctx.fillRect(x + 16, y + 42, 32, 12);
  ctx.fillStyle = '#fca311';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('MARLOWE', x + 66, y + 20);
  ctx.fillStyle = '#ffffff';
  ctx.font = '14px system-ui, sans-serif';
  wrapText(ctx, text.replace(/^Marlowe:\s*/, ''), x + 66, y + 40, w - 80, 17);
  ctx.restore();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      yy += lineHeight;
      line = word;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

function drawObjectiveArrow(ctx, view, state) {
  const marker = state.missionMarker;
  const dx = marker.x - state.player.x;
  const dy = marker.y - state.player.y;
  const d = Math.hypot(dx, dy);
  if (d < 60) return;
  const angle = Math.atan2(dy, dx);
  const cx = view.w / 2;
  const cy = view.h / 2;
  const ax = cx + Math.cos(angle) * 120;
  const ay = cy + Math.sin(angle) * 120;
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(angle);
  ctx.fillStyle = '#ffe600';
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(-8, -8);
  ctx.lineTo(-8, 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#ffe600';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(d)}m`, ax, ay - 16);
}

function drawWeaponWheel(ctx, view, state) {
  const cx = view.w / 2;
  const cy = view.h / 2;
  const radius = 110;
  ctx.save();
  ctx.fillStyle = 'rgba(8,10,22,0.55)';
  ctx.fillRect(0, 0, view.w, view.h);
  for (let i = 0; i < WEAPONS.length; i += 1) {
    const weapon = WEAPONS[i];
    const angle = -Math.PI / 2 + (i / WEAPONS.length) * Math.PI * 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    const owned = state.save.weapons.includes(weapon.id);
    const selected = i === state.weaponIndex;
    ctx.fillStyle = selected ? '#fca311' : owned ? 'rgba(255,255,255,0.85)' : 'rgba(120,120,120,0.5)';
    ctx.beginPath();
    ctx.arc(x, y, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#14141c';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(weapon.name, x, y - 2);
    ctx.font = 'bold 11px system-ui, sans-serif';
    const ammo = weapon.id === 'fists' ? '∞' : `${state.save.ammo[weapon.id] || 0}`;
    ctx.fillText(owned ? ammo : 'LOCKED', x, y + 14);
    ctx.fillText(`${i + 1}`, x, y + 28);
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('WEAPON WHEEL — release Q', cx, cy + 4);
  ctx.restore();
}

export function drawStartScreen(ctx, view, save) {
  ctx.save();
  const grad = ctx.createLinearGradient(0, 0, 0, view.h);
  grad.addColorStop(0, '#0b1020');
  grad.addColorStop(0.6, '#1b2a6b');
  grad.addColorStop(1, '#ff2e88');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe600';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.shadowColor = '#ff2e88';
  ctx.shadowBlur = 24;
  ctx.fillText('NEON BAY NIGHTS', view.w / 2, view.h / 2 - 90);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText('An open-world crime story in Neon Bay — ten jobs for Marlowe, four districts, one city that never cools down.', view.w / 2, view.h / 2 - 50);
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText('Press ENTER or click to start', view.w / 2, view.h / 2 + 10);
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('WASD move/drive · E enter car · Mouse aim, click shoot · Q weapon wheel · 1-4 weapons · R radio · P pause · M mute', view.w / 2, view.h / 2 + 48);
  if (save.jobsDone > 0) {
    ctx.fillText(`Saved progress: ${save.jobsDone}/10 jobs · $${save.money.toLocaleString('en-US')} · press N for a new game`, view.w / 2, view.h / 2 + 78);
  }
  const districtsLine = DISTRICTS.map((d) => d.name).join(' · ');
  ctx.fillText(districtsLine, view.w / 2, view.h - 40);
  ctx.restore();
}

export function drawPauseScreen(ctx, view) {
  ctx.save();
  ctx.fillStyle = 'rgba(5,6,14,0.7)';
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 40px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', view.w / 2, view.h / 2 - 10);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('P or Esc to resume · M mute', view.w / 2, view.h / 2 + 30);
  ctx.restore();
}

export function drawDeathScreen(ctx, view, save) {
  ctx.save();
  ctx.fillStyle = 'rgba(40,0,10,0.78)';
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.fillStyle = '#ff5964';
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('WASTED', view.w / 2, view.h / 2 - 30);
  ctx.fillStyle = '#ffffff';
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillText(`Neon Bay Hospital patched you up. Jobs done: ${save.jobsDone}/10 · Cash: $${save.money.toLocaleString('en-US')}`, view.w / 2, view.h / 2 + 14);
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText('Press ENTER to get back out there', view.w / 2, view.h / 2 + 54);
  ctx.restore();
}

// Neon Bay Nights — canvas rendering: city, actors, HUD, minimap, speedometer, wheel.

import { WORLD, VIEW, COLORS, WEAPONS, DISPATCH, RADIO, clamp, districtAt } from './config.js';
import { JOBS, GARAGE } from './missions.js';

function cam(game) {
  const sh = game.camera.shake;
  const sx = sh ? (Math.random() - 0.5) * sh : 0;
  const sy = sh ? (Math.random() - 0.5) * sh : 0;
  return { x: game.camera.x - VIEW.w / 2 + sx, y: game.camera.y - VIEW.h / 2 + sy };
}

function drawCar(ctx, c, police = false) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-19, -9, 40, 20);
  ctx.fillStyle = c.dead ? '#333' : c.color;
  ctx.fillRect(-20, -10, 40, 20);
  ctx.fillStyle = police ? '#22335e' : 'rgba(20,30,50,0.85)';
  ctx.fillRect(-8, -8, 16, 16);
  ctx.fillStyle = '#111';
  ctx.fillRect(-16, -12, 8, 4); ctx.fillRect(9, -12, 8, 4);
  ctx.fillRect(-16, 8, 8, 4); ctx.fillRect(9, 8, 8, 4);
  if (police) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(-20, -3, 40, 6);
    ctx.fillStyle = Math.floor(performance.now() / 180) % 2 ? '#ff3b30' : '#2f7bff';
    ctx.fillRect(-4, -3, 8, 6);
    ctx.fillStyle = '#22335e';
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, 2);
  }
  ctx.restore();
}

function drawPerson(ctx, x, y, angle, color, phase, isPlayer = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const step = Math.sin(phase) * 4;
  ctx.fillStyle = '#222';
  ctx.fillRect(-3, -6 + step * 0.4, 4, 5);
  ctx.fillRect(-3, 2 - step * 0.4, 4, 5);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2c99a';
  ctx.beginPath(); ctx.arc(3, 0, 4.5, 0, Math.PI * 2); ctx.fill();
  if (isPlayer) {
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

export function drawWorld(ctx, game) {
  const c = cam(game);
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  ctx.save();
  ctx.translate(-c.x, -c.y);

  // Sea + beach along the south edge.
  ctx.fillStyle = COLORS.sand;
  ctx.fillRect(0, WORLD.h - 300, WORLD.w, 120);
  ctx.fillStyle = COLORS.sea;
  ctx.fillRect(0, WORLD.h - 180, WORLD.w, 180);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let x = 0; x < WORLD.w; x += 90) ctx.fillRect(x + (game.time * 20) % 90, WORLD.h - 182, 46, 4);

  // Roads: vertical + horizontal grid with centre lines.
  ctx.fillStyle = COLORS.road;
  for (let x = 0; x <= WORLD.w; x += WORLD.block) ctx.fillRect(x - WORLD.road / 2, 0, WORLD.road, WORLD.h - 300);
  for (let y = 0; y <= WORLD.h - 300; y += WORLD.block) ctx.fillRect(0, y - WORLD.road / 2, WORLD.w, WORLD.road);
  ctx.fillStyle = COLORS.roadLine;
  for (let x = 0; x <= WORLD.w; x += WORLD.block) for (let y = 10; y < WORLD.h - 300; y += 42) ctx.fillRect(x - 2, y, 4, 22);
  for (let y = 0; y <= WORLD.h - 300; y += WORLD.block) for (let x = 10; x < WORLD.w; x += 42) ctx.fillRect(x, y - 2, 22, 4);

  // Traffic lights at intersections.
  for (let x = 0; x <= WORLD.w; x += WORLD.block) {
    for (let y = 0; y <= WORLD.h - 300; y += WORLD.block) {
      ctx.fillStyle = '#222';
      ctx.fillRect(x + 24, y + 24, 8, 14);
      ctx.fillStyle = game.lightPhase === 'ns' ? '#37e05a' : game.lightPhase === 'warn' ? '#ffd23f' : '#ff3b30';
      ctx.beginPath(); ctx.arc(x + 28, y + 29, 3, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Buildings + neon signs.
  for (const b of game.city.buildings) {
    if (b.x + b.w < c.x || b.y + b.h < c.y || b.x > c.x + VIEW.w || b.y > c.y + VIEW.h) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = COLORS.roof;
    ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
    ctx.fillStyle = 'rgba(255,240,170,0.85)';
    for (let i = 0; i < b.floors; i++) ctx.fillRect(b.x + 8 + (i % 3) * 12, b.y + 8 + Math.floor(i / 3) * 12, 6, 6);
  }
  ctx.textAlign = 'center';
  for (const s of game.city.signs) {
    if (s.x < c.x - 80 || s.y < c.y - 40 || s.x > c.x + VIEW.w + 80 || s.y > c.y + VIEW.h + 40) continue;
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = 'rgba(10,10,25,0.75)';
    const wdt = ctx.measureText(s.text).width + 12;
    ctx.fillRect(s.x - wdt / 2, s.y - 11, wdt, 18);
    ctx.fillStyle = s.color;
    ctx.fillText(s.text, s.x, s.y + 3);
  }
  for (const t of game.city.trees) {
    ctx.fillStyle = '#2f7a3d';
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#46a85a';
    ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, t.r * 0.6, 0, Math.PI * 2); ctx.fill();
  }

  // Garage ring (yellow) + mission marker.
  ctx.strokeStyle = '#ffd23f';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(GARAGE.x, GARAGE.y, GARAGE.r, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 13px monospace';
  ctx.fillText('GARAGE', GARAGE.x, GARAGE.y - GARAGE.r - 8);

  const job = JOBS[game.jobIndex];
  if (job && game.jobActive) {
    const st = job.stages[game.jobStage];
    const tx = st.garage ? GARAGE.x : st.x;
    const ty = st.garage ? GARAGE.y : st.y;
    const pulse = 26 + Math.sin(game.time * 4) * 6;
    ctx.fillStyle = 'rgba(55,224,255,0.25)';
    ctx.beginPath(); ctx.arc(tx, ty, pulse + 12, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#37e0ff';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(tx, ty, pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#37e0ff';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('OBJECTIVE', tx, ty - pulse - 10);
  }

  // Pickups with beacons.
  for (const pk of game.city.pickups) {
    if (pk.taken) continue;
    const col = pk.kind === 'health' ? '#37e05a' : '#ffd23f';
    ctx.fillStyle = col + '55';
    ctx.beginPath(); ctx.arc(pk.x, pk.y, 16 + Math.sin(game.time * 3 + pk.x) * 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = col;
    ctx.fillRect(pk.x - 7, pk.y - 3, 14, 6);
    ctx.fillStyle = '#111';
    ctx.font = 'bold 9px monospace';
    ctx.fillText(pk.kind === 'health' ? '+' : pk.kind.slice(0, 3).toUpperCase(), pk.x, pk.y + 3);
  }

  // Actors.
  for (const car of game.cars) drawCar(ctx, car, false);
  for (const ped of game.peds) if (ped.hp > 0) drawPerson(ctx, ped.x, ped.y, ped.angle, ped.color, ped.phase);
  for (const cop of game.police) drawCar(ctx, cop, true);

  const p = game.player;
  if (p && !p.inCar) drawPerson(ctx, p.x, p.y, p.angle, '#ff5da2', p.walkPhase, true);

  // Helicopter + spotlight cone.
  if (game.heli) {
    const h = game.heli;
    const grad = ctx.createRadialGradient(h.x, h.y, 10, h.x, h.y, 190);
    grad.addColorStop(0, 'rgba(255,255,210,0.4)');
    grad.addColorStop(1, 'rgba(255,255,210,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(h.x, h.y, 190, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(h.angle);
    ctx.fillStyle = '#2b3a55';
    ctx.fillRect(-26, -9, 52, 18);
    ctx.fillRect(24, -3, 30, 6);
    ctx.strokeStyle = '#dfe9ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(Math.cos(h.rotor) * 42, Math.sin(h.rotor) * 42);
    ctx.lineTo(-Math.cos(h.rotor) * 42, -Math.sin(h.rotor) * 42);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#ff3b30';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('AIR SUPPORT', h.x, h.y - 34);
  }

  // Bullets, tracers, particles.
  ctx.fillStyle = '#ffe98a';
  for (const b of game.bullets) ctx.fillRect(b.x - 2, b.y - 2, 4, 4);
  ctx.strokeStyle = 'rgba(255,230,120,0.8)';
  ctx.lineWidth = 2;
  for (const t of game.tracers) { ctx.beginPath(); ctx.moveTo(t.x1, t.y1); ctx.lineTo(t.x2, t.y2); ctx.stroke(); }
  for (const pt of game.particles) {
    ctx.globalAlpha = clamp(pt.life, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;

  // Direction arrow toward the objective (screen-space, drawn in world pass edge).
  ctx.restore();

  if (job && game.jobActive && p) {
    const st = job.stages[game.jobStage];
    const tx = st.garage ? GARAGE.x : st.x;
    const ty = st.garage ? GARAGE.y : st.y;
    const a = Math.atan2(ty - p.y, tx - p.x);
    const ax = VIEW.w / 2 + Math.cos(a) * 110;
    const ay = VIEW.h / 2 + Math.sin(a) * 110;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(a);
    ctx.fillStyle = '#37e0ff';
    ctx.beginPath();
    ctx.moveTo(16, 0); ctx.lineTo(-8, -8); ctx.lineTo(-8, 8); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(8,12,28,0.78)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(120,170,255,0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
}

export function drawHUD(ctx, game) {
  const p = game.player;
  ctx.textAlign = 'left';

  if (game.mode === 'title') {
    ctx.fillStyle = 'rgba(5,8,20,0.72)';
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff5da2';
    ctx.font = 'bold 64px monospace';
    ctx.fillText('NEON BAY NIGHTS', VIEW.w / 2, 240);
    ctx.fillStyle = '#dfe9ff';
    ctx.font = '20px monospace';
    ctx.fillText('Ten jobs for Marlowe. Five stars of trouble. One city.', VIEW.w / 2, 300);
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 24px monospace';
    ctx.fillText('PRESS ENTER TO PLAY', VIEW.w / 2, 380);
    ctx.fillStyle = '#9fb7e8';
    ctx.font = '15px monospace';
    ctx.fillText('WASD drive/walk · E steal car · mouse shoot · Q weapon wheel · R radio · P pause · M mute', VIEW.w / 2, 440);
    return;
  }
  if (game.mode === 'dead') {
    ctx.fillStyle = 'rgba(20,4,4,0.7)';
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff3b30';
    ctx.font = 'bold 72px monospace';
    ctx.fillText(game.deadReason || 'WASTED', VIEW.w / 2, 320);
    ctx.fillStyle = '#fff';
    ctx.font = '22px monospace';
    ctx.fillText('PRESS ENTER TO RESTART', VIEW.w / 2, 400);
    return;
  }
  if (!p) return;

  // Top-left: cash, health, weapon, district, radio.
  panel(ctx, 12, 12, 300, 128);
  ctx.fillStyle = '#7dff6a';
  ctx.font = 'bold 24px monospace';
  ctx.fillText('$' + game.cash, 24, 42);
  ctx.fillStyle = '#333';
  ctx.fillRect(24, 54, 200, 12);
  ctx.fillStyle = p.hp > 30 ? '#37e05a' : '#ff3b30';
  ctx.fillRect(24, 54, 200 * clamp(p.hp / p.maxHp, 0, 1), 12);
  const w = WEAPONS[game.weapon];
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 17px monospace';
  ctx.fillText(w.name.toUpperCase() + (w.infinite ? '' : '  ' + (game.ammo[w.id] || 0)), 24, 92);
  const d = districtAt(p.x, p.y);
  ctx.fillStyle = '#dfe9ff';
  ctx.font = '15px monospace';
  ctx.fillText(d.name + '  ·  Respect ' + Math.round(game.respect[d.id]) + '%', 24, 114);
  ctx.fillStyle = '#37e0ff';
  ctx.fillText('♪ ' + RADIO[game.radio].name, 24, 132);

  // Top-right: wanted stars + dispatch tier.
  panel(ctx, VIEW.w - 312, 12, 300, 74);
  ctx.textAlign = 'right';
  ctx.fillStyle = game.wanted ? '#ffd23f' : '#5a6b8a';
  ctx.font = 'bold 28px monospace';
  ctx.fillText('★'.repeat(game.wanted) + '☆'.repeat(5 - game.wanted), VIEW.w - 24, 46);
  ctx.fillStyle = '#ff8a7a';
  ctx.font = 'bold 16px monospace';
  ctx.fillText('DISPATCH: ' + DISPATCH[game.wanted].name.toUpperCase(), VIEW.w - 24, 72);
  ctx.textAlign = 'left';

  // Objective + timer.
  const job = JOBS[game.jobIndex];
  if (job && game.jobActive) {
    panel(ctx, 12, 150, 420, 64);
    ctx.fillStyle = '#37e0ff';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(job.title.toUpperCase() + '  ·  $' + job.reward, 24, 176);
    ctx.fillStyle = '#fff';
    ctx.font = '14px monospace';
    const st = job.stages[game.jobStage];
    const tx = st.garage ? GARAGE.x : st.x;
    const ty = st.garage ? GARAGE.y : st.y;
    const metres = Math.round(Math.hypot(tx - p.x, ty - p.y) / 10);
    ctx.fillText(st.label + '  (' + metres + 'm)', 24, 198);
    const mm = Math.floor(Math.max(0, game.jobTimer) / 60);
    const ss = Math.floor(Math.max(0, game.jobTimer) % 60);
    ctx.fillStyle = game.jobTimer < 20 ? '#ff3b30' : '#ffd23f';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(mm + ':' + String(ss).padStart(2, '0'), 360, 176);
  }

  // Banner (dispatch changes, pickups, job events).
  if (game.bannerTimer > 0 && game.banner) {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(8,12,28,0.85)';
    const bw = ctx.measureText(game.banner).width + 60;
    ctx.font = 'bold 22px monospace';
    const bw2 = ctx.measureText(game.banner).width + 60;
    ctx.fillRect(VIEW.w / 2 - bw2 / 2, 96, bw2, 40);
    ctx.fillStyle = '#ffd23f';
    ctx.fillText(game.banner, VIEW.w / 2, 124);
    ctx.textAlign = 'left';
    void bw;
  }

  // Marlowe dialogue box.
  if (game.dialogue && game.dialogueTimer > 0) {
    panel(ctx, 220, VIEW.h - 128, 840, 104);
    ctx.fillStyle = '#ff5da2';
    ctx.fillRect(236, VIEW.h - 112, 64, 72);
    ctx.fillStyle = '#1a0f1e';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('M', 268, VIEW.h - 66);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 15px monospace';
    ctx.fillText(game.dialogue.speaker, 316, VIEW.h - 92);
    ctx.fillStyle = '#fff';
    ctx.font = '16px monospace';
    const words = game.dialogue.text.split(' ');
    let line = '', ly = VIEW.h - 68;
    for (const word of words) {
      if (ctx.measureText(line + word).width > 700) { ctx.fillText(line, 316, ly); ly += 22; line = ''; }
      line += word + ' ';
    }
    ctx.fillText(line, 316, ly);
  }

  // Speedometer (arc + needle + km/h).
  const kmh = p.inCar ? Math.round(Math.abs(p.inCar.speed) * 0.42) : Math.round(p.speed * 0.3);
  const sx = VIEW.w - 130, sy = VIEW.h - 110;
  ctx.fillStyle = 'rgba(8,12,28,0.8)';
  ctx.beginPath(); ctx.arc(sx, sy, 74, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#37e0ff';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(sx, sy, 64, Math.PI * 0.75, Math.PI * 2.25); ctx.stroke();
  const na = Math.PI * 0.75 + clamp(kmh / 200, 0, 1) * Math.PI * 1.5;
  ctx.strokeStyle = '#ff3b30';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(na) * 54, sy + Math.sin(na) * 54); ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 26px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(String(kmh), sx, sy + 34);
  ctx.font = '12px monospace';
  ctx.fillText('km/h', sx, sy + 52);
  ctx.textAlign = 'left';

  // Minimap.
  const mw = 210, mh = 158, mx = 12, my = VIEW.h - mh - 12;
  panel(ctx, mx - 4, my - 4, mw + 8, mh + 8);
  const sxScale = mw / WORLD.w, syScale = mh / WORLD.h;
  ctx.fillStyle = '#274b2f';
  ctx.fillRect(mx, my, mw, mh);
  ctx.fillStyle = COLORS.sea;
  ctx.fillRect(mx, my + (WORLD.h - 180) * syScale, mw, 180 * syScale);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= WORLD.w; x += WORLD.block) { ctx.beginPath(); ctx.moveTo(mx + x * sxScale, my); ctx.lineTo(mx + x * sxScale, my + mh); ctx.stroke(); }
  for (let y = 0; y <= WORLD.h; y += WORLD.block) { ctx.beginPath(); ctx.moveTo(mx, my + y * syScale); ctx.lineTo(mx + mw, my + y * syScale); ctx.stroke(); }
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath(); ctx.arc(mx + GARAGE.x * sxScale, my + GARAGE.y * syScale, 4, 0, Math.PI * 2); ctx.fill();
  if (job && game.jobActive) {
    const st = job.stages[game.jobStage];
    const tx = st.garage ? GARAGE.x : st.x;
    const ty = st.garage ? GARAGE.y : st.y;
    ctx.fillStyle = '#37e0ff';
    ctx.beginPath(); ctx.arc(mx + tx * sxScale, my + ty * syScale, 5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#ff3b30';
  for (const cop of game.police) ctx.fillRect(mx + cop.x * sxScale - 2, my + cop.y * syScale - 2, 4, 4);
  if (game.heli) {
    ctx.fillStyle = '#ff8a00';
    ctx.beginPath(); ctx.arc(mx + game.heli.x * sxScale, my + game.heli.y * syScale, 4, 0, Math.PI * 2); ctx.fill();
    ctx.font = 'bold 8px monospace';
    ctx.fillText('HELI', mx + game.heli.x * sxScale + 5, my + game.heli.y * syScale);
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(mx + p.x * sxScale, my + p.y * syScale, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#9fb7e8';
  ctx.font = 'bold 10px monospace';
  ctx.fillText('NEON BAY', mx + 6, my + 14);

  // Bust meter + spawn protection note.
  if (game.bustMeter > 0.2) {
    ctx.fillStyle = '#ff3b30';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('BUSTED IN ' + Math.max(0, 2.2 - game.bustMeter).toFixed(1) + 's — MOVE!', VIEW.w / 2, 190);
    ctx.textAlign = 'left';
  }
  if (game.spawnProtect > 0 && game.spawnProtect < 900) {
    ctx.fillStyle = '#7dff6a';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SPAWN PROTECTION ' + game.spawnProtect.toFixed(1) + 's', VIEW.w / 2, 170);
    ctx.textAlign = 'left';
  }

  // Weapon wheel overlay.
  if (game.wheelOpen) {
    const cx = VIEW.w / 2, cy = VIEW.h / 2;
    ctx.fillStyle = 'rgba(5,8,20,0.55)';
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    WEAPONS.forEach((wp, i) => {
      const a = -Math.PI / 2 + i * Math.PI / 2;
      const wx = cx + Math.cos(a) * 130;
      const wy = cy + Math.sin(a) * 130;
      const owned = !!game.owned[wp.id];
      ctx.fillStyle = i === game.wheelPick ? 'rgba(255,210,63,0.9)' : 'rgba(20,30,55,0.9)';
      ctx.beginPath(); ctx.arc(wx, wy, 62, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = owned ? '#37e0ff' : '#555';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(wx, wy, 62, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = owned ? '#fff' : '#777';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(wp.name.toUpperCase(), wx, wy - 4);
      ctx.font = '13px monospace';
      ctx.fillText(owned ? (wp.infinite ? '∞' : String(game.ammo[wp.id] || 0)) : 'LOCKED', wx, wy + 18);
      ctx.fillText('DMG ' + wp.damage, wx, wy + 38);
    });
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('WEAPON WHEEL', cx, cy - 8);
    ctx.font = '13px monospace';
    ctx.fillText('release Q to equip', cx, cy + 18);
    ctx.textAlign = 'left';
  }

  if (game.paused) {
    ctx.fillStyle = 'rgba(5,8,20,0.6)';
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', VIEW.w / 2, VIEW.h / 2);
    ctx.textAlign = 'left';
  }
}

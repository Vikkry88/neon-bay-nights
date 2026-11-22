// hud.js — DOM HUD and canvas minimap for Neon Bay Nights.
import { WORLD, LANDMARKS, districtAt } from './world.js';
import { missionInfo, currentStage } from './missions.js';
import { dispatchInfo } from './police.js';
import { RADIO_NAMES } from './audio.js';

export const WEAPON_SLOTS = [
  { key: 'fists', label: 'Fists' },
  { key: 'pistol', label: 'Pistol' },
  { key: 'smg', label: 'SMG' },
  { key: 'shotgun', label: 'Shotgun' },
];

export function buildHud(G) {
  const root = document.getElementById('hud');
  root.innerHTML = `
    <div id="mission-card" class="panel">
      <div id="mission-job">JOB 1/10</div>
      <div id="mission-title">First Wheels</div>
      <div id="mission-stage">STAGE 1/2</div>
      <div id="mission-objective">—</div>
      <div id="mission-next">—</div>
      <div id="mission-timer"></div>
    </div>
    <div id="dispatch-panel" class="panel" style="display:none">
      <div id="dispatch-tier">TIER 1 · PATROL</div>
      <div id="dispatch-units"></div>
    </div>
    <div id="district-panel" class="panel">
      <div id="district-name">Downtown</div>
      <div id="district-respect">Respect 0</div>
      <div id="radio-line">Neon FM</div>
    </div>
    <div id="topbar">
      <div id="money">$250</div>
      <div id="clock">17:42</div>
      <div id="stars"></div>
    </div>
    <div id="weapons"></div>
    <div id="bars">
      <div class="bar-row"><span>HP</span><div class="bar"><div id="hp-fill"></div></div></div>
      <div class="bar-row"><span>ARMOR</span><div class="bar"><div id="armor-fill"></div></div></div>
    </div>
    <canvas id="minimap" width="180" height="180"></canvas>
    <div id="speedo" class="panel">
      <div><span id="speed-value">0</span><span id="speed-unit">km/h</span></div>
      <div id="vehicle-name">On foot</div>
      <div id="vehicle-cond"></div>
    </div>
    <div id="dialogue">
      <div id="dialogue-portrait">M</div>
      <div><div id="dialogue-name">MARLOWE</div><div id="dialogue-text"></div></div>
    </div>
    <div id="banner"></div>
    <div id="tier-banner"></div>
    <div id="hint"></div>
    <div id="crosshair">+</div>
    <div id="controls-bar">WASD move/drive · E steal/exit car · Mouse aim · Click/F attack · 1-4 weapons · R radio · H horn · Space handbrake/sprint · P pause · M mute</div>
    <div id="title-screen">
      <h1>NEON BAY NIGHTS</h1>
      <div class="tag">A true-3D open-world crime game. Run Marlowe's jobs, steal cars, outrun Bay PD.</div>
      <button id="start-btn">START</button>
      <div class="controls">WASD move / drive &nbsp;·&nbsp; E enter / exit car &nbsp;·&nbsp; Mouse aim, Click or F attack<br>
      1-4 weapons &nbsp;·&nbsp; R radio &nbsp;·&nbsp; H horn &nbsp;·&nbsp; Space handbrake / sprint &nbsp;·&nbsp; P pause &nbsp;·&nbsp; M mute</div>
      <div class="small">10 story jobs · 4 districts · 5 dispatch tiers · helicopter air support · saves in your browser</div>
    </div>
    <div id="pause-screen"><h2>PAUSED</h2><div>Press P to resume</div></div>
    <div id="wasted-screen"><h2>WASTED</h2><div>Back to Neon Bay Hospital…</div></div>
  `;
  const el = (id) => document.getElementById(id);
  const hud = {
    money: el('money'), clock: el('clock'), stars: el('stars'),
    job: el('mission-job'), title: el('mission-title'), stage: el('mission-stage'),
    objective: el('mission-objective'), next: el('mission-next'), timer: el('mission-timer'),
    dispatch: el('dispatch-panel'), dispatchTier: el('dispatch-tier'), dispatchUnits: el('dispatch-units'),
    district: el('district-name'), respect: el('district-respect'), radio: el('radio-line'),
    weapons: el('weapons'), hp: el('hp-fill'), armor: el('armor-fill'),
    minimap: el('minimap'), speed: el('speed-value'), vehicleName: el('vehicle-name'),
    vehicleCond: el('vehicle-cond'), dialogue: el('dialogue'), dialogueName: el('dialogue-name'),
    dialogueText: el('dialogue-text'), banner: el('banner'), tierBanner: el('tier-banner'),
    hint: el('hint'), crosshair: el('crosshair'),
    titleScreen: el('title-screen'), pauseScreen: el('pause-screen'), wastedScreen: el('wasted-screen'),
    dialogueUntil: 0, bannerUntil: 0, tierUntil: 0,
  };
  hud.showDialogue = function (name, text, secs) {
    hud.dialogueName.textContent = name;
    hud.dialogueText.textContent = text;
    hud.dialogue.style.display = 'flex';
    hud.dialogueUntil = G.time + (secs || 5);
  };
  hud.showBanner = function (text, secs) {
    hud.banner.textContent = text;
    hud.banner.style.display = 'block';
    hud.bannerUntil = G.time + (secs || 3);
  };
  hud.showTier = function (text) {
    hud.tierBanner.textContent = text;
    hud.tierBanner.style.display = 'block';
    hud.tierUntil = G.time + 3.2;
  };
  hud.setHint = function (text) { hud.hint.textContent = text || ''; };
  G.hud = hud;
  return hud;
}

export function updateHud(G) {
  const hud = G.hud;
  if (!hud) return;
  const p = G.player;
  hud.money.textContent = '$' + Math.floor(G.save.money).toLocaleString('en-US');
  const mins = Math.floor(G.clockMinutes) % (24 * 60);
  hud.clock.textContent = String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
  hud.stars.textContent = '★'.repeat(G.police.stars) + '☆'.repeat(5 - G.police.stars);

  const mi = missionInfo(G);
  hud.job.textContent = mi.jobLabel;
  hud.title.textContent = mi.title;
  hud.stage.textContent = mi.stageLabel;
  hud.objective.textContent = mi.objective;
  hud.next.textContent = mi.next;
  hud.timer.textContent = mi.timer ? '⏱ ' + mi.timer : '';
  hud.timer.style.color = mi.timer && G.mission.timerLeft < 15 ? '#ff6b6b' : '#ffd94d';

  const di = dispatchInfo(G);
  if (G.police.stars > 0) {
    hud.dispatch.style.display = 'block';
    hud.dispatchTier.textContent = di.tier;
    hud.dispatchUnits.innerHTML = di.lines
      .map((l) => '<div>' + l.callsign + ' — ' + l.dist + 'm — ' + l.tactic + '</div>')
      .join('');
  } else {
    hud.dispatch.style.display = 'none';
  }

  const district = districtAt(p.pos.x, p.pos.z);
  hud.district.textContent = district;
  hud.respect.textContent = 'Respect ' + (G.save.respect[district] || 0) +
    '  ·  Downtown ' + (G.save.respect.Downtown || 0) +
    ' · Beachfront ' + (G.save.respect.Beachfront || 0) +
    ' · Old Town ' + (G.save.respect['Old Town'] || 0) +
    ' · Marina ' + (G.save.respect.Marina || 0);
  hud.radio.textContent = '♪ ' + RADIO_NAMES[G.save.radio];

  hud.weapons.innerHTML = WEAPON_SLOTS.map((slot, i) => {
    const w = G.save.weapons[slot.key];
    const active = p.weapon === slot.key ? ' active' : '';
    const locked = !w.owned ? ' locked' : '';
    const ammo = !w.owned ? 'LOCKED' : slot.key === 'fists' ? '—' : String(Math.floor(w.ammo));
    return '<div class="wslot' + active + locked + '"><span>' + (i + 1) + ' ' + slot.label + '</span><span>' + ammo + '</span></div>';
  }).join('');

  hud.hp.style.width = Math.max(0, p.hp) + '%';
  hud.armor.style.width = Math.max(0, p.armor) + '%';

  if (p.car) {
    hud.speed.textContent = String(Math.round(Math.abs(p.car.speed) * 3.6));
    hud.vehicleName.textContent = p.car.spec.name;
    hud.vehicleCond.textContent = 'Condition ' + Math.round(p.car.condition) + '%';
  } else {
    hud.speed.textContent = String(Math.round(Math.abs(p.speed || 0) * 3.6));
    hud.vehicleName.textContent = 'On foot';
    hud.vehicleCond.textContent = '';
  }
  hud.crosshair.style.display = !p.car && p.weapon !== 'fists' ? 'block' : 'none';

  if (hud.dialogue.style.display !== 'none' && G.time > hud.dialogueUntil) hud.dialogue.style.display = 'none';
  if (hud.banner.style.display !== 'none' && G.time > hud.bannerUntil) hud.banner.style.display = 'none';
  if (hud.tierBanner.style.display !== 'none' && G.time > hud.tierUntil) hud.tierBanner.style.display = 'none';

  drawMinimap(G);
}

function drawMinimap(G) {
  const canvas = G.hud.minimap;
  const ctx = canvas.getContext('2d');
  const S = canvas.width;
  const range = 150; // metres shown across the map
  const p = G.player.pos;
  const toMap = (x, z) => [S / 2 + ((x - p.x) / range) * S, S / 2 + ((z - p.z) / range) * S];
  ctx.clearRect(0, 0, S, S);
  ctx.save();
  ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = '#6f9e58'; ctx.fillRect(0, 0, S, S);
  // Water on the east.
  const [waterX] = toMap(WORLD.waterX, 0);
  ctx.fillStyle = '#2e7fc4'; ctx.fillRect(waterX, 0, S, S);
  ctx.fillStyle = '#ecd29a';
  const [beachX] = toMap(WORLD.beachX, 0);
  ctx.fillRect(beachX, 0, Math.max(0, waterX - beachX), S);
  // Roads.
  ctx.strokeStyle = '#3c4148'; ctx.lineWidth = 5;
  for (const ax of WORLD.avenues) {
    const [mx] = toMap(ax, 0);
    ctx.beginPath(); ctx.moveTo(mx, 0); ctx.lineTo(mx, S); ctx.stroke();
  }
  for (const sz of WORLD.streets) {
    const [, mz] = toMap(0, sz);
    ctx.beginPath(); ctx.moveTo(0, mz); ctx.lineTo(S, mz); ctx.stroke();
  }
  function dot(x, z, color, r) {
    const [mx, mz] = toMap(x, z);
    if (mx < -6 || mx > S + 6 || mz < -6 || mz > S + 6) return;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(mx, mz, r, 0, Math.PI * 2); ctx.fill();
  }
  dot(LANDMARKS.hospital.x, LANDMARKS.hospital.z, '#ffffff', 4);
  if (G.garagePoint) dot(G.garagePoint.x, G.garagePoint.z, '#4de8ff', 4);
  for (const car of G.cars) {
    if (car.kind === 'police') dot(car.pos.x, car.pos.z, '#ff4f4f', 3.4);
  }
  if (G.police.heli) dot(G.police.heli.pos.x, G.police.heli.pos.z, '#ff9a3d', 4);
  const stage = currentStage(G);
  if (stage) {
    const [mx, mz] = toMap(stage.x, stage.z);
    const cx = Math.max(8, Math.min(S - 8, mx)), cz = Math.max(8, Math.min(S - 8, mz));
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath(); ctx.arc(cx, cz, 5 + Math.sin(G.time * 4) * 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#14202e'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  // Player arrow.
  const heading = G.player.car ? G.player.car.heading : G.player.heading;
  ctx.save();
  ctx.translate(S / 2, S / 2);
  ctx.rotate(Math.atan2(Math.sin(heading), -Math.cos(heading)) + Math.PI);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -7); ctx.lineTo(4.5, 5); ctx.lineTo(-4.5, 5); ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

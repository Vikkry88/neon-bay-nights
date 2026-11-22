// hud.js — dense DOM HUD: mission card, dispatch panel, weapon slots,
// circular minimap, speedometer, money, clock, stars, bars, dialogue.
// Built once as DOM, updated each frame from game state.
import { WORLD_SIZE } from './world.js';

export function buildHud() {
  const root = document.getElementById('hud');
  root.innerHTML = `
    <div id="topbar">
      <div id="money">$0</div>
      <div id="clock">17:40</div>
      <div id="stars"></div>
    </div>
    <div id="mission-card">
      <div id="mission-job">JOB 1/10</div>
      <div id="mission-title">First Wheels</div>
      <div id="mission-stage">STAGE 1/2</div>
      <div id="mission-objective"></div>
      <div id="mission-next"></div>
      <div id="mission-timer"></div>
    </div>
    <div id="dispatch-panel">
      <div id="dispatch-tier">DISPATCH: CLEAR</div>
      <div id="dispatch-units"></div>
    </div>
    <div id="district-panel">
      <div id="district-name">Beachfront</div>
      <div id="district-respect"></div>
      <div id="radio-line">RADIO: Neon FM</div>
    </div>
    <canvas id="minimap" width="170" height="170"></canvas>
    <div id="speedo">
      <div id="speed-value">0</div>
      <div id="speed-unit">km/h</div>
      <div id="vehicle-name">On foot</div>
      <div id="vehicle-cond">CONDITION 100%</div>
    </div>
    <div id="bars">
      <div class="bar-row"><span>HP</span><div class="bar"><div id="hp-fill"></div></div></div>
      <div class="bar-row"><span>ARMOR</span><div class="bar"><div id="armor-fill"></div></div></div>
    </div>
    <div id="weapons"></div>
    <div id="dialogue"><div id="dialogue-portrait">M</div><div><div id="dialogue-name">MARLOWE</div><div id="dialogue-text"></div></div></div>
    <div id="banner"></div>
    <div id="hint"></div>
    <div id="title-screen">
      <h1>NEON BAY NIGHTS</h1>
      <p class="tag">A true-3D open-world crime game in the coastal city of Neon Bay.</p>
      <p class="controls">WASD move / drive &nbsp;·&nbsp; E enter car &nbsp;·&nbsp; Mouse aim &nbsp;·&nbsp; Click / F attack<br>
      1–4 weapons &nbsp;·&nbsp; R radio &nbsp;·&nbsp; H horn &nbsp;·&nbsp; P pause &nbsp;·&nbsp; M mute &nbsp;·&nbsp; Space handbrake</p>
      <button id="start-btn">START — 10 JOBS FOR MARLOWE</button>
      <p class="small">Free roam, traffic, pedestrians, police dispatch with helicopter air support, saves on this device.</p>
    </div>
    <div id="pause-screen"><h2>PAUSED</h2><p>Press P to resume. Progress saves automatically.</p></div>
    <div id="wasted-screen"><h2>WASTED</h2><p>You wake at the hospital. Marlowe still has work.</p></div>
  `;
  const el = (id) => document.getElementById(id);
  return {
    money: el('money'),
    clock: el('clock'),
    stars: el('stars'),
    missionJob: el('mission-job'),
    missionTitle: el('mission-title'),
    missionStage: el('mission-stage'),
    missionObjective: el('mission-objective'),
    missionNext: el('mission-next'),
    missionTimer: el('mission-timer'),
    dispatchTier: el('dispatch-tier'),
    dispatchUnits: el('dispatch-units'),
    districtName: el('district-name'),
    districtRespect: el('district-respect'),
    radioLine: el('radio-line'),
    minimap: el('minimap'),
    speedValue: el('speed-value'),
    vehicleName: el('vehicle-name'),
    vehicleCond: el('vehicle-cond'),
    hpFill: el('hp-fill'),
    armorFill: el('armor-fill'),
    weapons: el('weapons'),
    dialogue: el('dialogue'),
    dialogueText: el('dialogue-text'),
    banner: el('banner'),
    hint: el('hint'),
    titleScreen: el('title-screen'),
    pauseScreen: el('pause-screen'),
    wastedScreen: el('wasted-screen'),
    startBtn: el('start-btn'),
  };
}

const WEAPON_NAMES = ['FISTS', 'PISTOL', 'SMG', 'SHOTGUN'];

export function updateHud(hud, s) {
  hud.money.textContent = `$${Math.round(s.money).toLocaleString('en-US')}`;
  const hh = Math.floor(s.clockMinutes / 60) % 24;
  const mm = Math.floor(s.clockMinutes % 60);
  hud.clock.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  hud.stars.textContent = '★'.repeat(s.wanted) + '☆'.repeat(5 - s.wanted);
  hud.stars.style.color = s.wanted > 0 ? '#ffd94d' : 'rgba(255,255,255,0.35)';

  if (s.job) {
    hud.missionJob.textContent = `JOB ${s.jobIndex + 1}/10 · $${s.job.reward}`;
    hud.missionTitle.textContent = s.job.title;
    hud.missionStage.textContent = `STAGE ${Math.min(s.stageIndex + 1, s.job.stages.length)}/${s.job.stages.length} · ${s.job.district}`;
    hud.missionObjective.textContent = s.stage ? s.stage.text : 'Job complete';
    const next = s.job.stages[s.stageIndex + 1];
    hud.missionNext.textContent = next ? `NEXT: ${next.text}` : 'NEXT: Collect reward';
    const t = Math.max(0, Math.ceil(s.missionTimer));
    hud.missionTimer.textContent = `⏱ ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    hud.missionTimer.style.color = t < 20 ? '#ff6b6b' : '#ffd94d';
  } else {
    hud.missionJob.textContent = 'FREE ROAM';
    hud.missionTitle.textContent = 'Neon Bay is yours';
    hud.missionStage.textContent = 'All 10 jobs complete';
    hud.missionObjective.textContent = 'Drive, explore, cause trouble — or rest at the garage.';
    hud.missionNext.textContent = '';
    hud.missionTimer.textContent = '';
  }

  if (s.tier) {
    hud.dispatchTier.textContent = `DISPATCH TIER ${s.tier.stars}: ${s.tier.name.toUpperCase()} · ${s.policeUnits.length} UNITS`;
    hud.dispatchTier.style.color = '#ff8a8a';
    hud.dispatchUnits.innerHTML = s.policeUnits
      .map((u) => `<div>${u.unitName} · ${u.distance ?? '—'}m · ${u.tactic}</div>`)
      .join('') + (s.heli ? '<div>AIR-1 · OVERHEAD · SPOTLIGHT</div>' : '') + (s.roadblocks ? '<div>ROADBLOCK · AHEAD</div>' : '');
  } else {
    hud.dispatchTier.textContent = 'DISPATCH: CLEAR';
    hud.dispatchTier.style.color = '#8be89b';
    hud.dispatchUnits.innerHTML = '<div>No units responding</div>';
  }

  hud.districtName.textContent = s.district;
  hud.districtRespect.textContent = Object.entries(s.respect)
    .map(([k, v]) => `${k} ${v}`)
    .join(' · ');
  hud.radioLine.textContent = `RADIO: ${s.radio} (R)`;

  hud.speedValue.textContent = String(Math.round(s.speedKmh));
  hud.vehicleName.textContent = s.vehicleName;
  hud.vehicleCond.textContent = `CONDITION ${Math.round(s.vehicleCondition)}%`;
  hud.hpFill.style.width = `${Math.max(0, Math.min(100, s.health))}%`;
  hud.armorFill.style.width = `${Math.max(0, Math.min(100, s.armor))}%`;

  hud.weapons.innerHTML = WEAPON_NAMES.map((name, i) => {
    const slot = i + 1;
    const active = s.weaponSlot === slot;
    const ammo = slot === 1 ? '∞' : s.ammo[slot] ?? 0;
    const owned = slot === 1 || s.owned[slot];
    return `<div class="wslot${active ? ' active' : ''}${owned ? '' : ' locked'}"><b>${slot}</b> ${name}<span>${owned ? ammo : 'LOCKED'}</span></div>`;
  }).join('');

  if (s.dialogue && s.dialogueTimer > 0) {
    hud.dialogue.style.display = 'flex';
    hud.dialogueText.textContent = s.dialogue.replace(/^Marlowe: "?/, '').replace(/"$/, '');
  } else {
    hud.dialogue.style.display = 'none';
  }
  hud.banner.textContent = s.banner || '';
  hud.banner.style.display = s.banner ? 'block' : 'none';
  hud.hint.textContent = s.hint || '';

  drawMinimap(hud.minimap, s);
}

function drawMinimap(canvas, s) {
  const g = canvas.getContext('2d');
  const size = canvas.width;
  const half = size / 2;
  const range = 150; // metres shown
  g.clearRect(0, 0, size, size);
  g.save();
  g.beginPath();
  g.arc(half, half, half - 2, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = '#1d2b3a';
  g.fillRect(0, 0, size, size);
  // ocean at the south (bottom of minimap = +z)
  g.fillStyle = '#2e8fb8';
  const oceanY = half + ((WORLD_SIZE / 2 - s.playerPos.z) / range) * half;
  g.fillRect(0, oceanY, size, size - oceanY);
  g.fillStyle = '#e8d29a';
  g.fillRect(0, oceanY - 8, size, 8);
  // roads
  g.strokeStyle = 'rgba(255,255,255,0.4)';
  g.lineWidth = 3;
  for (let r = -192; r <= 192; r += 48) {
    const x = half + ((r - s.playerPos.x) / range) * half;
    const y = half + ((r - s.playerPos.z) / range) * half;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, size); g.stroke();
    g.beginPath(); g.moveTo(0, y); g.lineTo(size, y); g.stroke();
  }
  const blip = (wx, wz, color, r = 4) => {
    const x = half + ((wx - s.playerPos.x) / range) * half;
    const y = half + ((wz - s.playerPos.z) / range) * half;
    if (x < 4 || x > size - 4 || y < 4 || y > size - 4) return;
    g.fillStyle = color;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  };
  for (const p of s.policePositions) blip(p.x, p.z, '#ff4444', 4);
  if (s.heliPos) blip(s.heliPos.x, s.heliPos.z, '#ff9d2e', 5);
  if (s.targetPos) blip(s.targetPos.x, s.targetPos.z, '#ffd94d', 6);
  blip(90, 78, '#ffb020', 5); // garage
  // player arrow
  g.translate(half, half);
  g.rotate(-s.heading + Math.PI);
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(0, -8);
  g.lineTo(5, 6);
  g.lineTo(-5, 6);
  g.closePath();
  g.fill();
  g.restore();
  g.strokeStyle = 'rgba(255,255,255,0.7)';
  g.lineWidth = 2;
  g.beginPath();
  g.arc(half, half, half - 2, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = '#fff';
  g.font = 'bold 11px Arial';
  g.textAlign = 'center';
  g.fillText('N', half, 14);
}

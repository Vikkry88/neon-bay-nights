// missions.js — Marlowe's 10 story jobs: stages, timers, rewards, markers.
import * as THREE from 'three';
import { districtAt } from './world.js';
import { spawnCarAt } from './vehicles.js';
import { addHeat } from './police.js';

export const JOBS = [
  {
    title: 'First Wheels', reward: 500, timer: 0,
    brief: 'Marlowe: "New face, easy money. A Sol Convertible sits by the Marina. Bring it to Bay Garage, no scratches."',
    stages: [
      { kind: 'steal', x: 150, z: 138, carSpec: 7, text: 'Steal the Sol Convertible at the Marina', next: 'Deliver it to Bay Garage' },
      { kind: 'deliver', x: 40, z: 104, text: 'Deliver the car to Bay Garage', next: 'Job complete' },
    ],
  },
  {
    title: 'Package Run', reward: 650, timer: 120,
    brief: 'Marlowe: "Pick up a package in Old Town, drop it Downtown. Clock is ticking, do not open it."',
    stages: [
      { kind: 'go', x: -160, z: -80, text: 'Pick up the package in Old Town', next: 'Deliver it Downtown' },
      { kind: 'go', x: 0, z: 80, text: 'Deliver the package Downtown', next: 'Job complete' },
    ],
  },
  {
    title: 'Hot Ride', reward: 800, timer: 110, heatOnSteal: 1.2,
    brief: 'Marlowe: "A Palm GT downtown has my name on it. The owner may call Bay PD. Drive like you mean it."',
    stages: [
      { kind: 'steal', x: 0, z: -150, carSpec: 2, text: 'Steal the Palm GT Downtown', next: 'Deliver it to the Beachfront' },
      { kind: 'deliver', x: 160, z: -80, text: 'Deliver the Palm GT to the Beachfront', next: 'Job complete' },
    ],
  },
  {
    title: 'Heat Check', reward: 900, timer: 0,
    brief: 'Marlowe: "Make some noise on the Beachfront, then lose Bay PD at the garage and come see me."',
    stages: [
      { kind: 'go', x: 160, z: 80, text: 'Head to the Beachfront boulevard', next: 'Lose the heat at Bay Garage', heat: 2.2 },
      { kind: 'escape', x: 40, z: 104, text: 'Lose Bay PD — reach Bay Garage', next: 'Meet Marlowe Downtown' },
      { kind: 'go', x: 80, z: 0, text: 'Meet Marlowe Downtown', next: 'Job complete' },
    ],
  },
  {
    title: 'Marina Money', reward: 1200, timer: 150,
    brief: 'Marlowe: "Cash pickup at the pier, then the Marina, then home to the garage. Two stops, one timer."',
    stages: [
      { kind: 'go', x: 205, z: 0, text: 'Pick up the cash at the pier', next: 'Second pickup at the Marina' },
      { kind: 'go', x: 160, z: 160, text: 'Second pickup at the Marina', next: 'Deliver to Bay Garage' },
      { kind: 'deliver', x: 40, z: 104, text: 'Deliver the cash to Bay Garage', next: 'Job complete' },
    ],
  },
  {
    title: 'Beachfront Chase', reward: 1500, timer: 95, heatOnSteal: 2.2,
    brief: 'Marlowe: "Neon Coupe on the Beachfront, buyer waiting in Old Town. Bay PD will be all over you. Floor it."',
    stages: [
      { kind: 'steal', x: 160, z: -150, carSpec: 4, text: 'Steal the Neon Coupe on the Beachfront', next: 'Deliver it to Old Town' },
      { kind: 'deliver', x: -160, z: 80, text: 'Deliver the Neon Coupe to Old Town', next: 'Job complete' },
    ],
  },
  {
    title: 'Old Town Debt', reward: 1800, timer: 180,
    brief: 'Marlowe: "Three debt stops: Old Town south, Downtown, Old Town north. Collect, do not chat."',
    stages: [
      { kind: 'go', x: -160, z: 160, text: 'Collect the debt in south Old Town', next: 'Next stop: Downtown' },
      { kind: 'go', x: 0, z: 0, text: 'Collect the debt Downtown', next: 'Next stop: north Old Town' },
      { kind: 'go', x: -160, z: -160, text: 'Collect the debt in north Old Town', next: 'Job complete' },
    ],
  },
  {
    title: 'Air Support', reward: 2200, timer: 0, heatOnSteal: 3.2,
    brief: 'Marlowe: "Steal the Bay Cruiser and bring the helicopter with you. Lose them at the garage. Good luck."',
    stages: [
      { kind: 'steal', x: 80, z: 150, carSpec: 1, text: 'Steal the Bay Cruiser', next: 'Escape to Bay Garage' },
      { kind: 'escape', x: 40, z: 104, text: 'Lose the helicopter — reach Bay Garage', next: 'Job complete' },
    ],
  },
  {
    title: 'Grand Tour', reward: 3000, timer: 240,
    brief: 'Marlowe: "Four districts, four drops, one big payday. Old Town, Beachfront, Marina, Downtown. Go."',
    stages: [
      { kind: 'go', x: -160, z: -160, text: 'Drop 1: Old Town', next: 'Drop 2: Beachfront' },
      { kind: 'go', x: 160, z: -160, text: 'Drop 2: Beachfront', next: 'Drop 3: Marina' },
      { kind: 'go', x: 160, z: 160, text: 'Drop 3: Marina', next: 'Drop 4: Downtown' },
      { kind: 'go', x: 0, z: 0, text: 'Drop 4: Downtown', next: 'Job complete' },
    ],
  },
  {
    title: 'Neon Bay Nights', reward: 5000, timer: 210, heatOnSteal: 4.2,
    brief: 'Marlowe: "Last job, biggest score. Steal the Sol, run it to the pier, then vanish at the garage. Make me proud."',
    stages: [
      { kind: 'steal', x: 0, z: 150, carSpec: 7, text: 'Steal the Sol Convertible', next: 'Run it to the pier' },
      { kind: 'deliver', x: 205, z: 0, text: 'Deliver the Sol to the pier', next: 'Escape to Bay Garage' },
      { kind: 'escape', x: 40, z: 104, text: 'Vanish — reach Bay Garage and lose Bay PD', next: 'Job complete' },
    ],
  },
];

const STAGE_LINES = [
  'Marlowe: "Good. Keep moving."',
  'Marlowe: "That is the spot. Next one, quick."',
  'Marlowe: "Smooth. Do not get sloppy now."',
  'Marlowe: "Almost there. Bring it home."',
];

export function initMissions(G) {
  G.mission = {
    jobIndex: Math.min(G.save.jobIndex || 0, JOBS.length),
    stage: 0, timerLeft: 0, markedCar: null, visitedGarage: false,
    allDone: (G.save.jobIndex || 0) >= JOBS.length, lineIdx: 0,
  };
  // Objective marker: glowing cylinder + ground ring.
  const marker = new THREE.Group();
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 9, 18, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd94d, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
  beam.position.y = 4.5;
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.4, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd94d, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.1;
  marker.add(beam); marker.add(ring);
  G.scene.add(marker);
  G.mission.marker = marker;
  // Floating direction arrow above the player.
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.6, 4),
    new THREE.MeshBasicMaterial({ color: 0xffd94d }));
  arrow.rotation.x = Math.PI / 2;
  G.scene.add(arrow);
  G.mission.arrow = arrow;
  startJob(G, G.mission.jobIndex, true);
  return G.mission;
}

export function currentJob(G) {
  return G.mission.allDone ? null : JOBS[G.mission.jobIndex];
}

export function currentStage(G) {
  const job = currentJob(G);
  return job ? job.stages[G.mission.stage] : null;
}

export function startJob(G, index, silent) {
  const M = G.mission;
  M.jobIndex = index;
  M.stage = 0;
  M.visitedGarage = false;
  M.allDone = index >= JOBS.length;
  if (M.allDone) { M.marker.visible = false; M.arrow.visible = false; return; }
  const job = JOBS[index];
  M.timerLeft = job.timer || 0;
  setupStage(G);
  if (!silent && G.hud) G.hud.showDialogue('MARLOWE', job.brief, 7);
}

function setupStage(G) {
  const M = G.mission;
  const stage = currentStage(G);
  if (!stage) return;
  if (stage.kind === 'steal') {
    M.markedCar = spawnCarAt(G, stage.carSpec || 0, stage.x, stage.z, Math.PI / 2, 'parked');
  } else {
    M.markedCar = null;
  }
  if (stage.heat) addHeat(G, stage.heat);
  M.marker.position.set(stage.x, 0, stage.z);
  M.marker.visible = true;
}

function completeStage(G) {
  const M = G.mission;
  const job = currentJob(G);
  M.stage += 1;
  M.visitedGarage = false;
  if (M.stage >= job.stages.length) {
    // Job complete: pay out, respect, unlocks, next job.
    G.save.money += job.reward;
    const district = districtAt(job.stages[0].x, job.stages[0].z);
    G.save.respect[district] = (G.save.respect[district] || 0) + 1;
    G.save.jobsDone = (G.save.jobsDone || 0) + 1;
    G.audio.cash();
    if (G.hud) {
      G.hud.showBanner('JOB COMPLETE  +$' + job.reward.toLocaleString('en-US'), 3.5);
      G.hud.showDialogue('MARLOWE', 'Marlowe: "Paid. $' + job.reward.toLocaleString('en-US') + ' — ' + district + ' respect up. Next job is ready."', 6);
    }
    if (M.jobIndex === 2 && !G.save.weapons.smg.owned) {
      G.save.weapons.smg.owned = true; G.save.weapons.smg.ammo = 120;
      if (G.hud) G.hud.showBanner('SMG UNLOCKED — press 3', 3.5);
    }
    if (M.jobIndex === 5 && !G.save.weapons.shotgun.owned) {
      G.save.weapons.shotgun.owned = true; G.save.weapons.shotgun.ammo = 24;
      if (G.hud) G.hud.showBanner('SHOTGUN UNLOCKED — press 4', 3.5);
    }
    G.save.jobIndex = M.jobIndex + 1;
    G.saveGame();
    startJob(G, M.jobIndex + 1);
  } else {
    setupStage(G);
    if (G.hud) G.hud.showDialogue('MARLOWE', STAGE_LINES[M.lineIdx++ % STAGE_LINES.length], 4);
  }
}

function failJob(G) {
  const M = G.mission;
  if (G.hud) {
    G.hud.showBanner('JOB FAILED — try again', 3);
    G.hud.showDialogue('MARLOWE', 'Marlowe: "Too slow. Run it again, and this time do not stop for coffee."', 5);
  }
  startJob(G, M.jobIndex, true);
}

export function updateMissions(G, dt) {
  const M = G.mission;
  const job = currentJob(G);
  const stage = currentStage(G);
  if (!job || !stage) { M.arrow.visible = false; return; }
  if (job.timer > 0) {
    M.timerLeft -= dt;
    if (M.timerLeft <= 0) { failJob(G); return; }
  }
  const p = G.player.pos;
  const dist = Math.hypot(stage.x - p.x, stage.z - p.z);
  // Arrow above the player points at the objective.
  M.arrow.visible = dist > 7;
  M.arrow.position.set(p.x, 3.4 + Math.sin(G.time * 3) * 0.2, p.z);
  M.arrow.rotation.z = 0;
  M.arrow.rotation.y = Math.atan2(stage.x - p.x, stage.z - p.z);
  M.marker.children[1].rotation.z = G.time * 0.8;

  if (stage.kind === 'go' && dist < 5) completeStage(G);
  else if (stage.kind === 'deliver' && dist < 6 && G.player.car) completeStage(G);
  else if (stage.kind === 'steal' && M.markedCar && G.player.car === M.markedCar) {
    if (job.heatOnSteal) addHeat(G, job.heatOnSteal);
    completeStage(G);
  } else if (stage.kind === 'escape') {
    if (G.garagePoint && Math.hypot(G.garagePoint.x - p.x, G.garagePoint.z - p.z) < 7) M.visitedGarage = true;
    if (M.visitedGarage && G.police.stars === 0) completeStage(G);
  }
}

export function missionInfo(G) {
  const M = G.mission;
  if (M.allDone) {
    return { jobLabel: 'ALL JOBS DONE', title: 'Neon Bay is yours', stageLabel: 'Free roam', objective: 'Cruise the city, Marlowe has no more work', next: '—', timer: '' };
  }
  const job = JOBS[M.jobIndex];
  const stage = job.stages[M.stage];
  let timer = '';
  if (job.timer > 0) {
    const t = Math.max(0, Math.ceil(M.timerLeft));
    timer = Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
  }
  return {
    jobLabel: 'JOB ' + (M.jobIndex + 1) + '/10',
    title: job.title,
    stageLabel: 'STAGE ' + (M.stage + 1) + '/' + job.stages.length,
    objective: stage.text,
    next: 'NEXT: ' + stage.next,
    timer,
  };
}

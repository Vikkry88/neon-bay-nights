// missions.js — 10 story jobs for fixer Marlowe, with markers, timers,
// rewards, dialogue lines and district respect. Jobs run in sequence.
import * as THREE from 'three';

export const JOBS = [
  {
    title: 'First Wheels',
    district: 'Beachfront',
    reward: 500,
    time: 180,
    brief: 'Marlowe: "New face in Neon Bay? Prove it. Grab any car and bring it to the yellow ring by the beach."',
    stages: [
      { text: 'Steal any car (press E beside one)', type: 'enterCar' },
      { text: 'Drive to the yellow ring on the boulevard', type: 'goto', x: -40, z: 196 },
    ],
    done: 'Marlowe: "Clean. The car is yours. More work when you are ready."',
  },
  {
    title: 'Package Run',
    district: 'Downtown',
    reward: 800,
    time: 150,
    brief: 'Marlowe: "A package waits downtown. Pick it up and lose any heat before the drop."',
    stages: [
      { text: 'Pick up the package downtown', type: 'goto', x: -120, z: -120 },
      { text: 'Deliver to the marina drop', type: 'goto', x: 150, z: 140 },
    ],
    done: 'Marlowe: "Delivered. Downtown notices people who deliver."',
  },
  {
    title: 'Hot Ride',
    district: 'Old Town',
    reward: 1200,
    time: 160,
    brief: 'Marlowe: "A collector wants a Palm GT from Old Town. Borrow it. Politely. Fast."',
    stages: [
      { text: 'Find and steal a Palm GT', type: 'stealModel', model: 'Palm GT' },
      { text: 'Deliver it to Bay Garage', type: 'goto', x: 90, z: 78 },
    ],
    done: 'Marlowe: "The collector sends thanks. And cash."',
  },
  {
    title: 'Heat Check',
    district: 'Downtown',
    reward: 1500,
    time: 200,
    brief: 'Marlowe: "Make some noise downtown, then shake the patrol and reach the garage."',
    stages: [
      { text: 'Reach 2 wanted stars downtown', type: 'wanted', stars: 2 },
      { text: 'Lose the police (reach 0 stars)', type: 'loseHeat' },
      { text: 'Return to Bay Garage', type: 'goto', x: 90, z: 78 },
    ],
    done: 'Marlowe: "You run cool under pressure. Good."',
  },
  {
    title: 'Marina Money',
    district: 'Marina',
    reward: 1800,
    time: 170,
    brief: 'Marlowe: "A marina courier is late with my money. Meet them at the pier and bring it back."',
    stages: [
      { text: 'Meet the courier at the pier', type: 'goto', x: -60, z: 240 },
      { text: 'Bring the money to Bay Garage', type: 'goto', x: 90, z: 78 },
    ],
    done: 'Marlowe: "Counted. Every note. The marina respects that."',
  },
  {
    title: 'Beachfront Chase',
    district: 'Beachfront',
    reward: 2200,
    time: 190,
    brief: 'Marlowe: "Race the boulevard end to end before the patrol closes the beach road."',
    stages: [
      { text: 'Hit the west boulevard checkpoint', type: 'goto', x: -200, z: 196 },
      { text: 'Hit the east boulevard checkpoint', type: 'goto', x: 200, z: 196 },
    ],
    done: 'Marlowe: "Fast. The beachfront crowd loves a show."',
  },
  {
    title: 'Old Town Debt',
    district: 'Old Town',
    reward: 2600,
    time: 180,
    brief: 'Marlowe: "An old-town shop owes me. Collect the debt and bring it home."',
    stages: [
      { text: 'Collect the debt in Old Town', type: 'goto', x: 140, z: -130 },
      { text: 'Deliver to Bay Garage', type: 'goto', x: 90, z: 78 },
    ],
    done: 'Marlowe: "Debt settled. Old Town remembers."',
  },
  {
    title: 'Air Support',
    district: 'Downtown',
    reward: 3200,
    time: 240,
    brief: 'Marlowe: "The PD is testing its helicopter. Draw it out, then slip away to the garage."',
    stages: [
      { text: 'Reach 3 wanted stars (helicopter responds)', type: 'wanted', stars: 3 },
      { text: 'Escape to Bay Garage', type: 'goto', x: 90, z: 78 },
    ],
    done: 'Marlowe: "You outran the eye in the sky. Impressive."',
  },
  {
    title: 'Grand Tour',
    district: 'Marina',
    reward: 4000,
    time: 260,
    brief: 'Marlowe: "Four districts, four drops, one night. Show me Neon Bay is yours."',
    stages: [
      { text: 'Drop 1: Downtown', type: 'goto', x: -120, z: -120 },
      { text: 'Drop 2: Old Town', type: 'goto', x: 140, z: -130 },
      { text: 'Drop 3: Beachfront', type: 'goto', x: 0, z: 196 },
      { text: 'Drop 4: Marina', type: 'goto', x: 150, z: 140 },
    ],
    done: 'Marlowe: "The whole bay saw you tonight."',
  },
  {
    title: 'Neon Bay Nights',
    district: 'Beachfront',
    reward: 5000,
    time: 300,
    brief: 'Marlowe: "Last job. Maximum heat, one clean escape. Finish it and the bay is yours."',
    stages: [
      { text: 'Reach 4 wanted stars', type: 'wanted', stars: 4 },
      { text: 'Survive and reach Bay Garage', type: 'goto', x: 90, z: 78 },
    ],
    done: 'Marlowe: "Neon Bay Nights. You earned the name."',
  },
];

export function makeMarker() {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(3.2, 4.1, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd94d, transparent: true, opacity: 0.95, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  group.add(ring);
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(3.6, 3.6, 22, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd94d, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false }),
  );
  pillar.position.y = 11;
  group.add(pillar);
  const beacon = new THREE.PointLight(0xffd94d, 60, 30);
  beacon.position.y = 3;
  group.add(beacon);
  return group;
}

export function makeDirectionArrow() {
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.55, 1.7, 10),
    new THREE.MeshBasicMaterial({ color: 0xffd94d }),
  );
  cone.rotation.x = Math.PI / 2;
  return cone;
}

export class MissionRunner {
  constructor(scene) {
    this.scene = scene;
    this.marker = makeMarker();
    this.arrow = makeDirectionArrow();
    scene.add(this.marker);
    scene.add(this.arrow);
    this.jobIndex = 0;
    this.stageIndex = 0;
    this.timer = 0;
    this.active = false;
    this.dialogue = '';
    this.dialogueTimer = 0;
  }

  job() {
    return JOBS[this.jobIndex] || null;
  }

  stage() {
    const j = this.job();
    return j ? j.stages[this.stageIndex] || null : null;
  }

  start(jobIndex) {
    this.jobIndex = Math.min(jobIndex, JOBS.length - 1);
    this.stageIndex = 0;
    const j = this.job();
    this.timer = j ? j.time : 0;
    this.active = !!j;
    this.dialogue = j ? j.brief : '';
    this.dialogueTimer = 9;
    this.placeMarker();
  }

  placeMarker() {
    const s = this.stage();
    if (s && s.type === 'goto') {
      this.marker.visible = true;
      this.marker.position.set(s.x, 0, s.z);
    } else {
      this.marker.visible = false;
    }
  }

  targetPos() {
    const s = this.stage();
    if (s && s.type === 'goto') return new THREE.Vector3(s.x, 0, s.z);
    return null;
  }

  // Returns 'stage', 'job', 'failed' or null.
  update(dt, ctx) {
    if (this.dialogueTimer > 0) this.dialogueTimer -= dt;
    if (!this.active) {
      this.marker.visible = false;
      this.arrow.visible = false;
      return null;
    }
    this.timer -= dt;
    if (this.timer <= 0) {
      this.dialogue = 'Marlowe: "Too slow. The job is burned. Try again."';
      this.dialogueTimer = 7;
      this.start(this.jobIndex);
      return 'failed';
    }
    const s = this.stage();
    if (!s) return null;
    let done = false;
    if (s.type === 'enterCar') done = !!ctx.inCar;
    else if (s.type === 'goto') done = ctx.playerPos.distanceTo(new THREE.Vector3(s.x, 0, s.z)) < 5.2;
    else if (s.type === 'stealModel') done = !!ctx.inCar && ctx.carModelName === s.model;
    else if (s.type === 'wanted') done = ctx.wanted >= s.stars;
    else if (s.type === 'loseHeat') done = ctx.wanted === 0;
    // pulse the marker + aim the arrow
    const pulse = 1 + Math.sin(performance.now() * 0.004) * 0.07;
    this.marker.scale.set(pulse, 1, pulse);
    const target = this.targetPos();
    if (target) {
      this.arrow.visible = true;
      this.arrow.position.set(ctx.playerPos.x, 3.4 + Math.sin(performance.now() * 0.005) * 0.25, ctx.playerPos.z);
      this.arrow.lookAt(target.x, this.arrow.position.y, target.z);
      this.arrow.rotateX(Math.PI / 2);
    } else {
      this.arrow.visible = false;
    }
    if (!done) return null;
    this.stageIndex += 1;
    const j = this.job();
    if (this.stageIndex >= j.stages.length) {
      this.dialogue = j.done;
      this.dialogueTimer = 9;
      this.active = false;
      this.marker.visible = false;
      this.arrow.visible = false;
      return 'job';
    }
    this.dialogue = `Marlowe: "${this.stage().text}."`;
    this.dialogueTimer = 6;
    this.placeMarker();
    return 'stage';
  }

  nextJob() {
    const next = this.jobIndex + 1;
    if (next >= JOBS.length) {
      this.active = false;
      this.dialogue = 'Marlowe: "All 10 jobs done. Neon Bay is yours. Free roam, anytime."';
      this.dialogueTimer = 10;
      return false;
    }
    this.start(next);
    return true;
  }
}

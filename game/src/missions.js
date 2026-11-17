// Missions and story for Neon Bay Nights. Five jobs from the fixer Marla Voss, unlocked in
// order; each is a list of steps the player works through. A step is one clear thing to do:
// get in a car, reach a point, wait somewhere, or lose the police. The runner only reads
// and nudges the world state — the world owns the simulation and the helpers it passes in.

import { CAR } from './config.js';

export const MISSION_DEFS = [
  {
    id: 'm1',
    name: 'First Wheels',
    giver: 'Marla Voss',
    brief: 'You need wheels before you can work. Steal any car on the street, then bring it to my garage.',
    reward: 150,
    steps: [
      { kind: 'car', text: 'Steal a car — walk up to one and press E' },
      { kind: 'driveTo', x: 2200, y: 1000, r: 90, text: 'Drive to Marla\u2019s garage' },
    ],
  },
  {
    id: 'm2',
    name: 'Sunset Run',
    giver: 'Marla Voss',
    brief: 'A package for the Salt Air bar, down on the beach. The buyer does not wait. Get it there in 90 seconds.',
    reward: 300,
    timeLimit: 90,
    steps: [
      // A pickup completes the moment the player reaches its marker: making the
      // player sit still for a second at a garage they just drove through adds
      // nothing, and a dwell here can only strand the job on a timing edge.
      { kind: 'pickup', x: 2200, y: 1000, r: 90, dwell: 0, text: 'Pick up the package at the garage' },
      { kind: 'driveTo', x: 3050, y: 2430, r: 100, text: 'Deliver to the Salt Air bar on the beach' },
    ],
  },
  {
    id: 'm3',
    name: 'The Getaway',
    giver: 'Marla Voss',
    brief: 'Rico botched a job and the Bay PD is on him. Pick him up, lose the heat, and get him to the safehouse.',
    reward: 450,
    steps: [
      { kind: 'pickup', x: 1000, y: 1800, r: 80, dwell: 0, text: 'Pick up Rico — two of his rivals are waiting there' },
      { kind: 'lose', text: 'Lose the police — get your wanted level to zero' },
      { kind: 'driveTo', x: 600, y: 2200, r: 90, text: 'Drop Rico at the safehouse' },
    ],
  },
  {
    id: 'm4',
    name: 'Repo Man',
    giver: 'Marla Voss',
    brief: 'A yellow coupe, parked up on Bayview Row. It is mine by paperwork and yours by hand. Bring it to the garage in one piece.',
    reward: 600,
    steps: [
      { kind: 'targetCar', x: 2600, y: 1400, text: 'Steal the marked yellow coupe' },
      { kind: 'deliver', x: 2200, y: 1000, r: 90, text: 'Deliver the coupe to the garage — keep it above 30% condition' },
    ],
  },
  {
    id: 'm5',
    name: 'The Bay Trust Job',
    giver: 'Marla Voss',
    brief: 'The big one. Hit the Bay Trust vault, grab the cash, and vanish. The whole city will be looking for you.',
    reward: 1000,
    steps: [
      { kind: 'grab', x: 1800, y: 600, r: 90, hold: 6, text: 'Hold at the Bay Trust vault — grab the cash (6s)' },
      { kind: 'lose', text: 'Lose the police — get your wanted level to zero' },
      { kind: 'driveTo', x: 600, y: 2200, r: 90, text: 'Escape to the safehouse with the money' },
    ],
  },
];

function dist(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

export function createMissionRunner() {
  let active = null; // { def, step, timer, dwell, alarmRaised, rivalsSpawned }
  let lastCompleted = null;

  function start(def, helpers) {
    active = { def, step: 0, timer: 0, dwell: 0, alarmRaised: false, rivalsSpawned: false };
    helpers.message(`${def.giver}: ${def.name} — ${def.steps[0].text}`);
    if (def.id === 'm4') helpers.spawnTargetCar(2600, 1400);
    return active;
  }

  function stepDone(state, step, helpers) {
    const player = state.player;
    const pos = player.car ? player.car : player;
    switch (step.kind) {
      case 'car':
        return player.car !== null;
      case 'goto':
      case 'driveTo':
        // Reaching the marker counts whether the player drove or walked the last
        // stretch: a car that blows up a block short of the safehouse must not
        // strand the whole job — the player still had to get there.
        return dist(pos.x, pos.y, step.x, step.y) < step.r;
      case 'pickup':
      case 'grab': {
        if (dist(pos.x, pos.y, step.x, step.y) >= step.r) return false;
        if (step.kind === 'grab' && !active.alarmRaised) {
          active.alarmRaised = true;
          helpers.addWanted(3);
          helpers.spawnEnemies([
            { x: step.x - 150, y: step.y - 110 },
            { x: step.x + 150, y: step.y - 110 },
            { x: step.x, y: step.y + 150 },
          ]);
          helpers.message('Alarm! Bay Trust security is on you — grab the cash and run!');
        }
        return true; // Dwell handled by the caller through active.dwell.
      }
      case 'targetCar':
        return player.car !== null && player.car === state.targetCar;
      case 'deliver':
        return player.car !== null && player.car === state.targetCar && dist(pos.x, pos.y, step.x, step.y) < step.r;
      case 'lose':
        return state.wanted === 0;
      default:
        return false;
    }
  }

  /**
   * Advance the active mission one step. Returns 'step' when a step finished, 'complete'
   * when the last step finished, 'fail' when the mission failed, or null.
   */
  function update(state, dt, helpers) {
    if (!active) return null;
    const def = active.def;
    active.timer += dt;
    if (def.timeLimit && active.timer > def.timeLimit) {
      active = null;
      helpers.clearTargetCar();
      return 'fail';
    }
    // m4: wreck the coupe below 30% condition and the job is blown.
    if (def.id === 'm4' && active.step === 1 && state.player.car === state.targetCar && state.player.car.health <= CAR.health * 0.3) {
      active = null;
      helpers.clearTargetCar();
      return 'fail';
    }
    const step = def.steps[active.step];
    // Dwell steps (pickup / grab) need the player to stay in the radius.
    if ((step.kind === 'pickup' || step.kind === 'grab') && stepDone(state, step, helpers)) {
      const need = step.kind === 'grab' ? step.hold : step.dwell;
      active.dwell += dt;
      if (active.dwell < need) return null;
    } else if (!stepDone(state, step, helpers)) {
      // Dwell progress is kept even if the player is shoved out of the radius for a
      // moment (a police ram, a scrape): a pickup or a grab is progress, not a timer
      // that a single bump should zero.
      // m3: once Rico is picked up, the heat arrives and his rivals show up.
      if (def.id === 'm3' && active.step === 0 && !active.rivalsSpawned) {
        // Rivals spawn the moment the player gets close to Rico.
        const pos = state.player.car ? state.player.car : state.player;
        if (dist(pos.x, pos.y, 1000, 1800) < 260) {
          active.rivalsSpawned = true;
          helpers.spawnEnemies([
            { x: 940, y: 1740 },
            { x: 1060, y: 1860 },
          ]);
          helpers.addWanted(2);
          helpers.message('Rico\u2019s rivals opened fire! Lose the cops after you grab him.');
        }
      }
      return null;
    }
    // Step finished.
    active.step += 1;
    active.dwell = 0;
    if (def.id === 'm4' && active.step === 1) helpers.message('Coupe secured — now get it to the garage in one piece.');
    if (active.step >= def.steps.length) {
      const done = active;
      active = null;
      lastCompleted = done.def;
      helpers.clearTargetCar();
      return 'complete';
    }
    // A "lose the police" step gets a how-to, not just a goal: new players stall here.
    if (def.steps[active.step].kind === 'lose') {
      helpers.message('Lose the cops: drive flat out down a long straight — stars fade once no cruiser is close.');
    } else {
      helpers.message(def.steps[active.step].text);
    }
    return 'step';
  }

  function objective() {
    if (!active) return null;
    return { name: active.def.name, text: active.def.steps[active.step].text, step: active.step, total: active.def.steps.length };
  }

  function target() {
    if (!active) return null;
    const step = active.def.steps[active.step];
    if (typeof step.x === 'number' && typeof step.y === 'number') return { x: step.x, y: step.y };
    if (step.kind === 'targetCar') return { x: 2600, y: 1400 };
    return null;
  }

  return {
    get active() { return active; },
    get lastCompleted() { return lastCompleted; },
    start,
    update,
    objective,
    target,
    /** The next mission the player has not finished, or null when all are done. */
    nextAvailable(doneIds) {
      for (const def of MISSION_DEFS) if (!doneIds.includes(def.id)) return def;
      return null;
    },
  };
}

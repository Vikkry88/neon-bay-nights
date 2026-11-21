// Neon Bay Nights — fixer missions. Every target sits on a street (car-reachable).
// The banner is stage-aware: it always names the current step.
import { snapToStreet, randomStreetPoint } from './city.js';

export const MISSIONS = [
  { id: 'package', title: 'Night Package', pay: 300 },
  { id: 'wheels', title: 'Hot Wheels', pay: 400 },
  { id: 'drops', title: 'Cash Drops', pay: 500 },
  { id: 'heat', title: 'Lose the Heat', pay: 450 },
  { id: 'courier', title: 'Bay Courier', pay: 650 },
];

function ensureTargets(state, city, rng) {
  if (state._targets && state._targetsFor === state.missionIdx) return state._targets;
  const pp = state.player.inCar || state.player;
  const near = { x: pp.x || city.garage.x, y: pp.y || city.garage.y };
  const a = randomStreetPoint(city, rng, near, 500, 1400);
  const b = randomStreetPoint(city, rng, near, 700, 1800);
  const c = randomStreetPoint(city, rng, near, 600, 1600);
  state._targets = { a: snapToStreet(city, a.x, a.y), b: snapToStreet(city, b.x, b.y), c: snapToStreet(city, c.x, c.y) };
  state._targetsFor = state.missionIdx;
  // Mission 2 needs a marked car: pick the nearest parked car and flag it
  // (never the car the player is already driving).
  if (state.missionIdx === 1) {
    let best = null;
    let bd = 1e9;
    for (const car of state.world.cars) {
      if (car.police || car.dead) continue;
      if (state.player.inCar === car) continue;
      const d = Math.hypot(car.x - near.x, car.y - near.y);
      if (d < bd) { bd = d; best = car; }
    }
    if (best) {
      best.missionCar = true;
      state._targets.carId = best.id;
      state._targets.a = snapToStreet(city, best.x, best.y);
    }
  }
  return state._targets;
}

export function missionTarget(state, city) {
  if (state.missionIdx >= MISSIONS.length) return null;
  const t = state._targets;
  if (!t) return { x: city.garage.x, y: city.garage.y, label: 'GARAGE' };
  const idx = state.missionIdx;
  const stage = state.missionStage;
  if (idx === 0) return stage === 0 ? { ...t.a, label: 'PACKAGE' } : { x: city.garage.x, y: city.garage.y, label: 'GARAGE' };
  if (idx === 1) {
    if (stage === 0) {
      const car = state.world.cars.find((c) => c.id === t.carId);
      if (car) return { x: car.x, y: car.y, label: 'TARGET CAR' };
      return { ...t.a, label: 'TARGET CAR' };
    }
    return { x: city.garage.x, y: city.garage.y, label: 'GARAGE' };
  }
  if (idx === 2) {
    const pts = [t.a, t.b, t.c];
    const p = pts[Math.min(stage, 2)];
    return { ...p, label: 'CASH ' + (Math.min(stage, 2) + 1) + '/3' };
  }
  if (idx === 3) return { ...t.b, label: 'HIDEOUT' };
  if (idx === 4) return stage === 0 ? { ...t.a, label: 'PICKUP' } : { ...t.b, label: 'DROP-OFF' };
  return { x: city.garage.x, y: city.garage.y, label: 'GARAGE' };
}

export function missionBanner(state) {
  if (state.missionIdx >= MISSIONS.length) return 'ALL FIXER JOBS DONE — free roam Neon Bay!';
  const m = MISSIONS[state.missionIdx];
  const n = state.missionIdx + 1;
  if (state.missionIdx === 0) {
    return state.missionStage === 0
      ? 'MISSION ' + n + '/5 "' + m.title + '" — Step 1/2: pick up the package (gold marker)'
      : 'MISSION ' + n + '/5 "' + m.title + '" — Step 2/2: deliver it to the GARAGE yellow ring';
  }
  if (state.missionIdx === 1) {
    return state.missionStage === 0
      ? 'MISSION ' + n + '/5 "' + m.title + '" — Step 1/2: steal the marked car (press E beside it)'
      : 'MISSION ' + n + '/5 "' + m.title + '" — Step 2/2: drive it into the GARAGE yellow ring';
  }
  if (state.missionIdx === 2) {
    return 'MISSION ' + n + '/5 "' + m.title + '" — collect cash drop ' + (Math.min(state.missionStage, 2) + 1) + ' of 3';
  }
  if (state.missionIdx === 3) {
    return 'MISSION ' + n + '/5 "' + m.title + '" — reach the hideout and lose your wanted stars';
  }
  return state.missionStage === 0
    ? 'MISSION ' + n + '/5 "' + m.title + '" — Step 1/2: pick up the courier parcel'
    : 'MISSION ' + n + '/5 "' + m.title + '" — Step 2/2: deliver the parcel to the drop-off';
}

function completeMission(state, announce, sfx) {
  const m = MISSIONS[state.missionIdx];
  state.money += m.pay;
  sfx.mission();
  sfx.cash();
  announce('Mission complete: "' + m.title + '"  +$' + m.pay + '  (balance $' + Math.floor(state.money) + ')');
  state.missionIdx++;
  state.missionStage = 0;
  state.cashGot = 0;
  state._targets = null;
  state._targetsFor = -1;
  for (const car of state.world.cars) car.missionCar = false;
  if (state.missionIdx >= MISSIONS.length) announce('All 5 fixer jobs done! Neon Bay is yours. Free roam.');
}

export function advanceMission(state, city, dt, announce, sfx) {
  if (state.missionIdx >= MISSIONS.length) return;
  ensureTargets(state, city, state.rng);
  const pp = state.player.inCar || state.player;
  const target = missionTarget(state, city);
  if (!target) return;
  const dist = Math.hypot(target.x - pp.x, target.y - pp.y);
  const idx = state.missionIdx;

  if (idx === 0) {
    if (state.missionStage === 0 && dist < 42) {
      state.missionStage = 1;
      sfx.pickup();
      announce('Package secured. Now deliver it to the GARAGE (yellow ring).');
    } else if (state.missionStage === 1 && dist < 52) {
      completeMission(state, announce, sfx);
    }
  } else if (idx === 1) {
    if (state.missionStage === 0) {
      const car = state.world.cars.find((c) => c.id === state._targets.carId);
      if (car && state.player.inCar === car) {
        state.missionStage = 1;
        announce('You have the target car. Deliver it to the GARAGE yellow ring.');
      } else if (dist < 60 && !state.player.inCar) {
        announce('That is the target car — press E to steal it.');
      }
    } else if (state.missionStage === 1 && dist < 56 && state.player.inCar && state.player.inCar.id === state._targets.carId) {
      completeMission(state, announce, sfx);
    }
  } else if (idx === 2) {
    if (dist < 44) {
      state.money += 40;
      sfx.cash();
      state.cashGot++;
      if (state.missionStage >= 2) completeMission(state, announce, sfx);
      else {
        state.missionStage++;
        announce('Cash drop ' + state.cashGot + '/3 collected (+$40). Next marker is up.');
      }
    }
  } else if (idx === 3) {
    // Lose the heat: reach hideout area and stay unseen until stars clear.
    if (state.wanted === 0 && dist < 700) state.wantedHeat = Math.max(state.wantedHeat, 45);
    if (dist < 90) {
      state.escapeTimer += dt;
      if (state.escapeTimer > 1 && state.wanted > 0) announce('Hideout reached — stay out of sight until the stars fade…');
      if (state.wanted === 0 && state.escapeTimer > 2) {
        state.escapeTimer = 0;
        completeMission(state, announce, sfx);
      }
    } else {
      state.escapeTimer = 0;
    }
  } else if (idx === 4) {
    if (state.missionStage === 0 && dist < 42) {
      state.missionStage = 1;
      sfx.pickup();
      announce('Parcel on board. Drive it to the drop-off marker.');
    } else if (state.missionStage === 1 && dist < 48) {
      completeMission(state, announce, sfx);
    }
  }
}

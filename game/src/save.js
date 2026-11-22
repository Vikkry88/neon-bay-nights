// localStorage save: money, story progress, district respect, radio station
// and owned weapons. Loaded defensively; a corrupt save falls back to fresh.

import { SAVE_KEY, DISTRICTS } from './config.js';

export function freshSave() {
  const respect = {};
  for (const d of DISTRICTS) respect[d.id] = 0;
  return {
    money: 250,
    missionIndex: 0,       // next job to run (0..10); 10 = story complete
    respect,
    radio: 'neonfm',
    weapons: ['fists'],
    ammo: { pistol: 0, smg: 0, shotgun: 0 },
    bestWanted: 0,
    jobsDone: 0,
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return freshSave();
    const parsed = JSON.parse(raw);
    const base = freshSave();
    return {
      money: Number(parsed.money) || base.money,
      missionIndex: Math.min(10, Math.max(0, Number(parsed.missionIndex) || 0)),
      respect: { ...base.respect, ...(parsed.respect || {}) },
      radio: typeof parsed.radio === 'string' ? parsed.radio : base.radio,
      weapons: Array.isArray(parsed.weapons) && parsed.weapons.length ? parsed.weapons : base.weapons,
      ammo: { ...base.ammo, ...(parsed.ammo || {}) },
      bestWanted: Number(parsed.bestWanted) || 0,
      jobsDone: Number(parsed.jobsDone) || 0,
    };
  } catch {
    return freshSave();
  }
}

export function storeSave(save) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Storage full or blocked: play on without saving.
  }
}

export function wipeSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}

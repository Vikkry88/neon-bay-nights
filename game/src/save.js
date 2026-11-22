// save.js — localStorage persistence for Neon Bay Nights.
// Stores money, mission progress, district respect, weapons and settings.
const KEY = 'neon-bay-nights-save-v1';

export function defaultSave() {
  return {
    money: 250,
    missionIndex: 0,
    respect: { Downtown: 0, Beachfront: 0, 'Old Town': 0, Marina: 0 },
    weapons: { pistol: { owned: true, ammo: 60 }, smg: { owned: false, ammo: 0 }, shotgun: { owned: false, ammo: 0 } },
    health: 100,
    armor: 25,
    radio: 'Neon FM',
    muted: false,
    clockMinutes: 17 * 60 + 40,
    jobsDone: 0,
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw);
    const base = defaultSave();
    return {
      ...base,
      ...parsed,
      respect: { ...base.respect, ...(parsed.respect || {}) },
      weapons: {
        pistol: { ...base.weapons.pistol, ...(parsed.weapons?.pistol || {}) },
        smg: { ...base.weapons.smg, ...(parsed.weapons?.smg || {}) },
        shotgun: { ...base.weapons.shotgun, ...(parsed.weapons?.shotgun || {}) },
      },
    };
  } catch {
    return defaultSave();
  }
}

export function writeSave(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // storage may be unavailable; the game still runs
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

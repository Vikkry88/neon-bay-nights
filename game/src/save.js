// save.js — localStorage persistence for Neon Bay Nights.
// Stores money, mission progress, district respect, weapons/ammo and radio.
const SAVE_KEY = 'neon-bay-nights-save-v1';

export function defaultSave() {
  return {
    money: 250,
    jobIndex: 0,
    respect: { Downtown: 0, Beachfront: 0, 'Old Town': 0, Marina: 0 },
    weapons: {
      fists: { owned: true, ammo: Infinity },
      pistol: { owned: true, ammo: 60 },
      smg: { owned: false, ammo: 0 },
      shotgun: { owned: false, ammo: 0 },
    },
    radio: 1,
    muted: false,
    jobsDone: 0,
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw);
    const base = defaultSave();
    const merged = { ...base, ...parsed };
    merged.respect = { ...base.respect, ...(parsed.respect || {}) };
    merged.weapons = { ...base.weapons, ...(parsed.weapons || {}) };
    for (const key of Object.keys(base.weapons)) {
      merged.weapons[key] = { ...base.weapons[key], ...(merged.weapons[key] || {}) };
      if (key === 'fists') merged.weapons[key].ammo = Infinity;
    }
    return merged;
  } catch (err) {
    return defaultSave();
  }
}

export function writeSave(save) {
  try {
    const copy = JSON.parse(JSON.stringify(save, (k, v) => (v === Infinity ? 'INF' : v)));
    if (copy.weapons && copy.weapons.fists) copy.weapons.fists.ammo = 'INF';
    localStorage.setItem(SAVE_KEY, JSON.stringify(copy));
  } catch (err) {
    // Storage may be unavailable (private mode); the game still plays.
  }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (err) { /* ignore */ }
}

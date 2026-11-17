// Save data in localStorage: cash earned, missions completed, and the best cash total.
// Everything else (position, wanted level, traffic) is a fresh start each visit.

import { BEST_KEY, SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return { money: 0, done: [] };
    const parsed = JSON.parse(raw);
    return {
      money: Number.isFinite(parsed.money) ? parsed.money : 0,
      done: Array.isArray(parsed.done) ? parsed.done.filter((id) => typeof id === 'string') : [],
    };
  } catch {
    return { money: 0, done: [] };
  }
}

export function writeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

export function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

export function writeBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // See writeSave.
  }
}

/** Wipe the save (used after a corrupted or out-of-date save is detected). */
export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
    window.localStorage.removeItem(BEST_KEY);
  } catch {
    // See writeSave.
  }
}

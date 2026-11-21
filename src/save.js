// localStorage save: money + completed missions.
import { SAVE_KEY } from './config.js';
export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { money: 250, done: [] };
    const s = JSON.parse(raw);
    return { money: Number(s.money) || 250, done: Array.isArray(s.done) ? s.done : [] };
  } catch { return { money: 250, done: [] }; }
}
export function writeSave(money, done) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ money, done })); } catch { /* private mode */ }
}
export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } }

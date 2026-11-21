// Neon Bay Nights — localStorage save.
const KEY = 'neon-bay-nights-save-v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function storeSave(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      money: Math.floor(state.money),
      missionIdx: state.missionIdx,
      health: Math.floor(state.health),
      savedAt: Date.now(),
    }));
  } catch (e) {
    // Storage may be unavailable (private mode); the game continues unsaved.
  }
}

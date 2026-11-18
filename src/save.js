// Neon Bay Nights — save.js
// One job: persist progress (money, missions done) to localStorage.
(function () {
  'use strict';

  const NBN = window.NBN;
  const KEY = 'neon-bay-nights-save-v1';

  function load() {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (typeof data !== 'object' || data === null) return null;
      return {
        money: typeof data.money === 'number' ? data.money : 0,
        missionsDone: Array.isArray(data.missionsDone) ? data.missionsDone.filter((n) => typeof n === 'number') : [],
        bestWanted: typeof data.bestWanted === 'number' ? data.bestWanted : 0,
      };
    } catch (err) {
      return null;
    }
  }

  function save(state) {
    try {
      const data = {
        money: Math.floor(state.money || 0),
        missionsDone: (state.missionsDone || []).slice(),
        bestWanted: state.bestWanted || 0,
      };
      window.localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (err) {
      return false;
    }
  }

  function clear() {
    try {
      window.localStorage.removeItem(KEY);
    } catch (err) { /* storage unavailable; play on without it */ }
  }

  NBN.save = { load, save, clear };
})();

// Neon Bay Nights — missions.js
// One job: the story — Marla Voss's five jobs, in order, with objectives,
// markers, timers, rewards and fail states.
(function () {
  'use strict';

  const NBN = window.NBN;
  const CFG = NBN.CFG;

  let M = null; // mission state

  function fresh() {
    return {
      index: 0, // next mission to start (0-based into NBN.MISSIONS)
      active: null, // {def, stage, timer, target:{x,y,label}, cash, rico}
      banner: null, // {title, sub, t} shown on start/complete
      failed: null, // {title, reason} for the fail screen
      completedFlash: null,
    };
  }

  function startMission(i) {
    const def = NBN.MISSIONS[i];
    const S = NBN.world.getState();
    const m = { def, stage: 0, timer: def.timeLimit || 0, target: null, cash: false, rico: false, guards: 0 };
    // Every target carries its beacon colour, so the ring, the minimap dot
    // and the mission text all agree: the garage ring is yellow because the
    // job says "yellow garage marker"; the safehouse ring is green because
    // its zone is green. No more pink ring under a "yellow marker" order.
    if (i === 0) m.target = { x: NBN.PLACES.garage.x, y: NBN.PLACES.garage.y, label: 'Garage', color: '#ffe14d' };
    if (i === 1) m.target = { x: NBN.PLACES.saltAirBar.x, y: NBN.PLACES.saltAirBar.y, label: 'Salt Air bar', color: '#22e6ff' };
    if (i === 2) m.target = { x: NBN.PLACES.ricoPickup.x, y: NBN.PLACES.ricoPickup.y, label: 'Pick up Rico', color: '#5cb8ff' };
    if (i === 3) m.target = { x: NBN.PLACES.coupeLot.x, y: NBN.PLACES.coupeLot.y, label: 'Yellow coupe', color: '#ffe14d' };
    if (i === 4) m.target = { x: NBN.PLACES.vault.x, y: NBN.PLACES.vault.y, label: 'Bay Trust vault', color: '#ffe14d' };
    M.active = m;
    M.banner = { title: `Mission ${def.id}: ${def.name}`, sub: def.brief, t: 4.5 };
    NBN.world.say(NBN.MISSION_INTRO + def.brief, 5);
    NBN.audio.missionStart();
    if (i === 4) {
      // Vault guards on duty.
      const v = NBN.PLACES.vault;
      S.guards.push(
        { x: v.x - 60, y: v.y - 40, hp: 50, shootCd: 1 },
        { x: v.x + 60, y: v.y + 40, hp: 50, shootCd: 1.4 },
        { x: v.x, y: v.y + 70, hp: 50, shootCd: 1.8 },
      );
      NBN.world.addWanted(1);
    }
  }

  function completeMission() {
    const S = NBN.world.getState();
    const m = M.active;
    const def = m.def;
    S.player.money += def.reward;
    if (!S.missionsDone.includes(def.id)) S.missionsDone.push(def.id);
    NBN.world.addFloat(S.player.x, S.player.y - 40, `+$${def.reward}`, '#7CFF6B');
    NBN.audio.cash();
    NBN.audio.missionDone();
    M.banner = { title: 'Mission complete', sub: `${def.name} — $${def.reward} earned.`, t: 4 };
    M.completedFlash = def.name;
    M.active = null;
    M.index++;
    S.guards.length = 0;
    NBN.save.save(S);
    if (M.index < NBN.MISSIONS.length) {
      NBN.world.say(`Job done. Call Marla when you're ready for the next one — press Enter.`, 5);
    } else {
      NBN.world.say('All five jobs done. Neon Bay is yours, driver.', 6);
    }
  }

  function failMission(reason) {
    const S = NBN.world.getState();
    M.failed = { title: M.active ? M.active.def.name : 'Mission failed', reason };
    M.active = null;
    S.guards.length = 0;
    NBN.audio.fail();
  }

  function atTarget(r) {
    const S = NBN.world.getState();
    const t = M.active.target;
    return t && NBN.dist(S.player.x, S.player.y, t.x, t.y) < r;
  }

  function update(dt) {
    const S = NBN.world.getState();
    if (!S || S.over) return;
    if (M.banner) {
      M.banner.t -= dt;
      if (M.banner.t <= 0) M.banner = null;
    }
    if (M.failed) return;
    const m = M.active;
    if (!m) return;
    const p = S.player;

    // Timed missions.
    if (m.def.timeLimit) {
      m.timer -= dt;
      if (m.timer <= 0) {
        failMission('Out of time — the package never made it to the Salt Air.');
        return;
      }
    }

    if (m.def.id === 1) {
      // Steal any car, bring it to the garage.
      if (m.stage === 0 && p.inCar) {
        m.stage = 1;
        NBN.world.say('Good wheels. Now get it to the garage.');
      }
      if (m.stage === 1 && p.inCar && atTarget(70)) completeMission();
    } else if (m.def.id === 2) {
      // Deliver to the Salt Air bar in 90 seconds.
      if (atTarget(70)) completeMission();
    } else if (m.def.id === 3) {
      // Pick up Rico, lose the cops, reach the safehouse.
      if (m.stage === 0) {
        if (atTarget(60)) {
          m.stage = 1;
          m.rico = true;
          m.target = { x: NBN.PLACES.safehouse.x, y: NBN.PLACES.safehouse.y, label: 'Safehouse', color: '#7CFF6B' };
          NBN.world.addWanted(3);
          NBN.world.say('Rico: "Go go go! Lose them first, then the safehouse."');
          NBN.audio.sirenBlip();
        }
      } else if (m.stage === 1) {
        if (p.wanted === 0 && atTarget(70)) completeMission();
        else if (atTarget(70) && p.wanted > 0) NBN.world.say('Too hot — lose the cops before the safehouse!');
      }
    } else if (m.def.id === 4) {
      // Steal the yellow coupe, deliver in one piece.
      const coupe = S.cars.find((c) => c.coupe);
      if (m.stage === 0) {
        if (p.inCar && p.inCar.coupe) {
          m.stage = 1;
          m.target = { x: NBN.PLACES.garage.x, y: NBN.PLACES.garage.y, label: 'Garage', color: '#ffe14d' };
          NBN.world.say('That is the one. Treat her gently — the garage, in one piece.');
        }
      } else if (m.stage === 1) {
        if (!p.inCar || !p.inCar.coupe) {
          // Left the coupe behind — still recoverable.
          if (coupe && NBN.dist(p.x, p.y, coupe.x, coupe.y) > 200) NBN.world.say('You left the coupe — get back in it.');
        }
        if (p.inCar && p.inCar.coupe) {
          if (p.inCar.health < 30) {
            failMission('The coupe came back wrecked — below 30% condition. Job blown.');
            return;
          }
          if (atTarget(70)) completeMission();
        }
      }
    } else if (m.def.id === 5) {
      // Grab the vault cash, lose the whole Bay PD, escape.
      if (m.stage === 0) {
        if (atTarget(70)) {
          m.stage = 1;
          m.cash = true;
          m.target = { x: NBN.PLACES.safehouse.x, y: NBN.PLACES.safehouse.y, label: 'Safehouse', color: '#7CFF6B' };
          NBN.world.addWanted(4);
          NBN.world.say('Cash in hand! Now lose the whole Bay PD and reach the safehouse.');
          NBN.audio.cash();
        }
      } else if (m.stage === 1) {
        if (p.wanted === 0 && atTarget(70)) completeMission();
        else if (atTarget(70) && p.wanted > 0) NBN.world.say('Too hot — lose every cop before the safehouse!');
      }
    }
  }

  function tryStartNext() {
    if (M.active || M.failed) return false;
    if (M.index >= NBN.MISSIONS.length) return false;
    startMission(M.index);
    return true;
  }

  function retryFailed() {
    if (!M.failed) return false;
    M.failed = null;
    startMission(M.index);
    return true;
  }

  function skipToNextAfterFail() {
    // After a fail, the player can retry the same job (retryFailed) — this
    // helper exists for the fail screen's "retry" path only.
    return retryFailed();
  }

  function initFromSave(save) {
    M = fresh();
    const done = save ? save.missionsDone : [];
    // Resume at the first unfinished mission.
    M.index = 0;
    while (M.index < NBN.MISSIONS.length && done.includes(NBN.MISSIONS[M.index].id)) M.index++;
  }

  function getState() {
    return M;
  }

  NBN.missions = {
    initFromSave, update, tryStartNext, retryFailed, skipToNextAfterFail, getState,
  };
})();

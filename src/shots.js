// Neon Bay Nights — shots.js
// One job: staged scenes for the four screenshots (?shot=1..4).
// Each shot sets the world up so one frame shows a different system:
// 1 — the city on foot; 2 — a driving chase with wanted stars, minimap and
// an objective; 3 — a mission in progress; 4 — police closing in.
(function () {
  'use strict';

  const NBN = window.NBN;

  function applyShot(n) {
    const S = NBN.world.getState();
    const M = NBN.missions.getState();
    const p = S.player;
    if (n === 1) {
      // On foot in the city, daytime, no heat.
      p.x = 1200;
      p.y = 1000;
      p.angle = Math.PI / 4;
      p.inCar = null;
      p.wanted = 0;
      NBN.world.say('Welcome to Neon Bay — steal a car, find work, stay free.', 6);
    } else if (n === 2) {
      // Driving chase: player in a car, wanted 3, cops behind, mission 2 live.
      const car = NBN.world.nearestCar(100000) || S.cars[0];
      p.inCar = car;
      car.kind = 'player';
      car.ai = false;
      car.speed = 320;
      car.x = 1500;
      car.y = 1200;
      car.angle = 0;
      p.x = car.x;
      p.y = car.y;
      p.angle = 0;
      p.wanted = 3;
      p.lastCrime = S.time;
      for (let i = 0; i < 3; i++) {
        const c = NBN.world.makeCar(car.x - 120 - i * 70, car.y + 60 + i * 40, 0, 'police', '#1c2a4a');
        c.speed = 300;
        S.cars.push(c);
      }
      M.index = 1;
      M.active = null;
      NBN.missions.tryStartNext();
    } else if (n === 3) {
      // Mission in progress: Sunset Run, package on board, beach ahead.
      const car = S.cars.find((c) => c.kind === 'parked') || S.cars[0];
      p.inCar = car;
      car.kind = 'player';
      car.ai = false;
      car.speed = 260;
      car.x = 2300;
      car.y = 1600;
      car.angle = 0;
      p.x = car.x;
      p.y = car.y;
      p.angle = 0;
      M.index = 1;
      M.active = null;
      NBN.missions.tryStartNext();
      if (M.active) M.active.timer = 62;
    } else if (n === 4) {
      // Police after the player on foot: wanted 4, cruisers and a foot cop.
      p.x = 1600;
      p.y = 1800;
      p.angle = -Math.PI / 2;
      p.inCar = null;
      p.wanted = 4;
      p.lastCrime = S.time;
      for (let i = 0; i < 3; i++) {
        const c = NBN.world.makeCar(p.x + 140 + i * 80, p.y - 60 + i * 50, Math.PI, 'police', '#1c2a4a');
        c.speed = 200;
        S.cars.push(c);
      }
      S.cops.push({ x: p.x + 90, y: p.y + 70, angle: 0, stun: 0, arrest: 0 });
      NBN.world.say('The whole Bay PD is on you — run!', 6);
    }
  }

  function shotParam() {
    try {
      const q = new URLSearchParams(window.location.search);
      const n = parseInt(q.get('shot') || '', 10);
      return n >= 1 && n <= 4 ? n : 0;
    } catch (err) {
      return 0;
    }
  }

  NBN.shots = { applyShot, shotParam };
})();

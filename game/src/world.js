// Neon Bay Nights — world.js
// One job: the living simulation — player, cars, traffic AI, pedestrians,
// police, wanted level, combat, particles and explosions.
(function () {
  'use strict';

  const NBN = window.NBN;
  const CFG = NBN.CFG;

  const CAR_COLORS = ['#d94f3d', '#3d7ad9', '#e8c33d', '#7a3dd9', '#3dd9a0', '#d9d9d9', '#2e2e38', '#e07a2e'];
  const MAX_TRAFFIC = CFG.TRAFFIC_MAX;
  const MAX_PEDS = 22;

  let S = null; // world state

  function makeCar(x, y, angle, kind, color) {
    return {
      x, y, angle, speed: 0, kind, color: color || NBN.pick(CAR_COLORS),
      health: 100, dir: 0, street: 0, turnAt: 0, stopped: false, ramCd: 0, crashCd: 0,
      backoff: 0, stuckT: 0,
      siren: kind === 'police', ai: kind === 'traffic' || kind === 'police',
    };
  }

  function newState(save) {
    const p = NBN.PLACES.spawnPark;
    return {
      time: 0,
      player: {
        x: p.x, y: p.y, angle: -Math.PI / 2, speed: 0,
        health: CFG.PLAYER_HEALTH, money: save ? save.money : 0,
        wanted: 0, inCar: null, invuln: CFG.SPAWN_INVULN_SECONDS,
        ammo: 0, hasPistol: false, punchCd: 0, carCd: 0, lastHit: {},
        quietTime: 0, lastCrime: -99, sprinting: false,
      },
      cars: [],
      peds: [],
      cops: [],
      guards: [],
      bullets: [],
      particles: [],
      floats: [], // floating text {x,y,txt,life,color}
      flash: 0, // red damage vignette 0..1
      shake: 0,
      ramGate: -99, // time of the last police ram (any cruiser): one ram per gate
      missionsDone: save ? save.missionsDone.slice() : [],
      bestWanted: save ? save.bestWanted : 0,
      over: null, // 'wasted' | 'busted' | null
      pistolTaken: false,
      message: '',
      messageT: 0,
    };
  }

  function init(save) {
    S = newState(save);
    // Parked cars around the city, plus two near spawn so the first steal
    // (mission 1) is a short walk, not a blind hunt across the city.
    for (let i = 0; i < CFG.PARKED_CARS; i++) {
      const spot = randomRoadSpot();
      S.cars.push(makeCar(spot.x, spot.y, spot.angle, 'parked'));
    }
    for (let i = 0; i < 2; i++) {
      const spot = nearSpawnSpot();
      S.cars.push(makeCar(spot.x, spot.y, spot.angle, 'parked'));
    }
    // The marked yellow coupe for mission 4, parked in its lot.
    const coupe = makeCar(NBN.PLACES.coupeLot.x, NBN.PLACES.coupeLot.y, Math.PI / 2, 'parked', '#ffd21f');
    coupe.coupe = true;
    S.cars.push(coupe);
    for (let i = 0; i < MAX_TRAFFIC; i++) spawnTrafficCar(true);
    for (let i = 0; i < MAX_PEDS; i++) spawnPed(true);
    return S;
  }

  function randomRoadSpot() {
    for (let tries = 0; tries < 40; tries++) {
      const gx = NBN.randInt(0, 7) * CFG.GRID;
      const gy = NBN.randInt(0, 7) * CFG.GRID;
      const horizontal = NBN.rng() < 0.5;
      const x = horizontal ? gx + NBN.rand(-120, 120) : gx + (NBN.rng() < 0.5 ? -20 : 20);
      const y = horizontal ? gy + (NBN.rng() < 0.5 ? -20 : 20) : gy + NBN.rand(-120, 120);
      if (NBN.city.clearOfBuildings(x, y, 30) && NBN.dist(x, y, S.player.x, S.player.y) > 200) {
        return { x, y, angle: horizontal ? (y < gy ? 0 : Math.PI) : (x < gx ? Math.PI / 2 : -Math.PI / 2) };
      }
    }
    return { x: 1200, y: 1200, angle: 0 };
  }

  // A road spot close to the spawn park (for the two starter parked cars).
  function nearSpawnSpot() {
    const p = NBN.PLACES.spawnPark;
    for (let tries = 0; tries < 30; tries++) {
      const spot = randomRoadSpot();
      if (NBN.dist(spot.x, spot.y, p.x, p.y) < 650) return spot;
    }
    return { x: 420, y: 1000, angle: 0 };
  }

  function spawnTrafficCar(anywhere) {
    // Replacement cars spawn near the player (550–1100px away) so the streets
    // around them stay busy; the initial batch may spawn anywhere.
    let spot = randomRoadSpot();
    if (!anywhere) {
      for (let tries = 0; tries < 12; tries++) {
        const cand = randomRoadSpot();
        const d = NBN.dist(cand.x, cand.y, S.player.x, S.player.y);
        spot = cand;
        if (d > 550 && d < 1100) break;
      }
    }
    const c = makeCar(spot.x, spot.y, spot.angle, 'traffic');
    // Align to a street lane and pick a heading.
    const gx = Math.round(c.x / CFG.GRID) * CFG.GRID;
    const gy = Math.round(c.y / CFG.GRID) * CFG.GRID;
    if (Math.abs(c.x - gx) < Math.abs(c.y - gy)) {
      c.street = gx;
      c.dir = NBN.rng() < 0.5 ? 1 : 3; // south / north along x=gx
      c.angle = c.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
      c.y = gy + NBN.rand(-140, 140);
      c.x = gx + (c.dir === 1 ? -20 : 20);
    } else {
      c.street = gy;
      c.dir = NBN.rng() < 0.5 ? 0 : 2; // east / west along y=gy
      c.angle = c.dir === 0 ? 0 : Math.PI;
      c.x = gx + NBN.rand(-140, 140);
      c.y = gy + (c.dir === 0 ? 20 : -20);
    }
    c.speed = NBN.rand(90, 150);
    if (!anywhere && NBN.dist(c.x, c.y, S.player.x, S.player.y) < 500) return;
    S.cars.push(c);
  }

  function spawnPed(anywhere) {
    for (let tries = 0; tries < 20; tries++) {
      const x = NBN.rand(200, CFG.WORLD - 400);
      const y = NBN.rand(200, CFG.WORLD - 200);
      if (!NBN.city.onRoad(x, y) && NBN.city.clearOfBuildings(x, y, 16) && NBN.dist(x, y, S.player.x, S.player.y) > 150) {
        S.peds.push({
          x, y, angle: NBN.rand(0, Math.PI * 2), speed: NBN.rand(35, 60),
          panic: 0, color: NBN.pick(['#e8e8e8', '#ff9d5c', '#5cb8ff', '#ff5c8a', '#9dff5c']),
          walkT: NBN.rand(2, 6),
        });
        return;
      }
    }
  }

  // ---------------------------------------------------------------- player

  function say(txt, seconds) {
    S.message = txt;
    S.messageT = seconds || 3;
  }

  function addWanted(n) {
    const p = S.player;
    if (p.wanted >= 5) return;
    p.wanted = Math.min(5, p.wanted + n);
    p.lastCrime = S.time;
    p.quietTime = 0;
    if (p.wanted > S.bestWanted) S.bestWanted = p.wanted;
    if (p.wanted > 0) NBN.audio.sirenBlip();
  }

  function damagePlayer(amount, source) {
    const p = S.player;
    if (p.invuln > 0 || S.over) return;
    const now = S.time;
    if (now - (p.lastHit[source] || -99) < CFG.HIT_COOLDOWN) return;
    p.lastHit[source] = now;
    p.health = Math.max(0, p.health - amount);
    S.flash = 1;
    S.shake = Math.max(S.shake, 6);
    if (p.health <= 0) {
      S.over = 'wasted';
      NBN.audio.explosion();
      spawnBurst(p.x, p.y, '#ff3b30', 26);
    }
  }

  function healTick(dt) {
    const p = S.player;
    if (p.wanted === 0 && p.health > 0 && p.health < CFG.PLAYER_HEALTH) {
      p.health = Math.min(CFG.PLAYER_HEALTH, p.health + dt * 2.5);
    }
  }

  function nearestCar(maxDist) {
    let best = null;
    let bd = maxDist;
    for (const c of S.cars) {
      if (c.kind === 'police' && c.ai) continue;
      const d = NBN.dist(S.player.x, S.player.y, c.x, c.y);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  function stealCar() {
    const p = S.player;
    if (p.inCar) return false;
    const car = nearestCar(CFG.STEAL_RADIUS);
    if (!car) return false;
    car.kind = 'player';
    car.ai = false;
    car.speed = 0;
    p.inCar = car;
    p.x = car.x;
    p.y = car.y;
    addWanted(1); // stealing a car is a crime — the Bay PD notices
    if (car.coupe) say('Nice — the yellow coupe. Get it to the garage in one piece!');
    NBN.audio.pickup();
    return true;
  }

  function exitCar() {
    const p = S.player;
    if (!p.inCar) return;
    const car = p.inCar;
    const side = car.angle + Math.PI / 2;
    p.x = car.x + Math.cos(side) * 34;
    p.y = car.y + Math.sin(side) * 34;
    if (NBN.city.hitBuilding(p.x, p.y, 14)) {
      p.x = car.x - Math.cos(side) * 34;
      p.y = car.y - Math.sin(side) * 34;
    }
    p.angle = car.angle;
    p.inCar = null;
    car.speed = 0;
  }

  function punch() {
    const p = S.player;
    if (p.inCar || p.punchCd > 0 || S.over) return;
    p.punchCd = 0.35;
    NBN.audio.punch();
    const ax = p.x + Math.cos(p.angle) * 30;
    const ay = p.y + Math.sin(p.angle) * 30;
    for (const g of S.guards) {
      if (g.hp > 0 && NBN.dist(ax, ay, g.x, g.y) < 34) {
        g.hp -= CFG.PUNCH_DAMAGE;
        spawnBurst(g.x, g.y, '#ffe14d', 6);
        if (g.hp <= 0) addWanted(1);
      }
    }
    for (const c of S.cops) {
      if (NBN.dist(ax, ay, c.x, c.y) < 34) {
        c.stun = 1.2;
        spawnBurst(c.x, c.y, '#ffe14d', 6);
      }
    }
  }

  function shoot() {
    const p = S.player;
    // punchCd is the fire-rate gate: one shot per 0.28s, whether the trigger
    // is a Space press or a held mouse button.
    if (p.inCar || !p.hasPistol || p.ammo <= 0 || p.punchCd > 0 || S.over) return;
    p.ammo--;
    p.punchCd = 0.28;
    NBN.audio.gunshot();
    addWanted(1);
    const a = p.angle;
    S.bullets.push({
      x: p.x + Math.cos(a) * 22, y: p.y + Math.sin(a) * 22,
      vx: Math.cos(a) * 640, vy: Math.sin(a) * 640, life: 0.9, from: 'player',
    });
    // Muzzle flash at the gun tip so the shot is unmistakable.
    spawnBurst(p.x + Math.cos(a) * 26, p.y + Math.sin(a) * 26, '#ffe14d', 4);
    S.shake = Math.max(S.shake, 2);
  }

  // ---------------------------------------------------------------- particles

  function spawnBurst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = NBN.rand(0, Math.PI * 2);
      const sp = NBN.rand(40, 260);
      S.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: NBN.rand(0.3, 0.8), max: 0.8, color, size: NBN.rand(2, 5) });
    }
  }

  function explodeCar(car) {
    spawnBurst(car.x, car.y, '#ff7a2e', 30);
    spawnBurst(car.x, car.y, '#3c3f4a', 18);
    spawnBurst(car.x, car.y, '#ffe14d', 12);
    S.shake = Math.max(S.shake, 12);
    NBN.audio.explosion();
    if (S.player.inCar === car) {
      S.player.inCar = null;
      damagePlayer(20, 'explosion');
      S.player.invuln = Math.max(S.player.invuln, 1);
    }
    S.cars.splice(S.cars.indexOf(car), 1);
    addWanted(1);
  }

  function addFloat(x, y, txt, color) {
    S.floats.push({ x, y, txt, life: 1.4, color: color || '#ffe14d' });
  }

  // ---------------------------------------------------------------- traffic

  function lightAt(x, y) {
    // Nearest traffic light to this intersection approach.
    let best = null;
    let bd = 1e9;
    for (const l of NBN.city.lights) {
      const d = NBN.dist(x, y, l.x, l.y);
      if (d < bd) { bd = d; best = l; }
    }
    return bd < 120 ? best : null;
  }

  function updateTrafficCar(c, dt) {
    const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]]; // E S W N
    const d = dirs[c.dir];
    // Next intersection ahead along the street.
    const along = c.dir === 0 ? c.x : c.dir === 2 ? -c.x : c.dir === 1 ? c.y : -c.y;
    const nextGrid = (Math.floor(along / CFG.GRID) + 1) * CFG.GRID;
    const distToNext = nextGrid - along;
    let target = NBN.rand(120, 150);
    // Stop at a red light.
    if (distToNext < 90 && distToNext > 0) {
      const ix = c.dir === 0 || c.dir === 2 ? nextGrid : c.street;
      const iy = c.dir === 1 || c.dir === 3 ? nextGrid : c.street;
      const light = lightAt(ix, iy);
      if (light) {
        const ewGreen = NBN.city.lightGreen(light, S.time);
        const myGreen = (c.dir === 0 || c.dir === 2) ? ewGreen : !ewGreen;
        if (!myGreen) target = 0;
      }
    }
    // Don't rear-end the car ahead.
    for (const o of S.cars) {
      if (o === c || o.kind === 'parked') continue;
      const dd = NBN.dist(c.x, c.y, o.x, o.y);
      if (dd < 60 && Math.abs(NBN.angleDiff(c.angle, NBN.angleTo(c.x, c.y, o.x, o.y))) < 0.6) target = 0;
    }
    c.speed = NBN.lerp(c.speed, target, Math.min(1, dt * 2));
    if (c.speed > 2) {
      c.x += d[0] * c.speed * dt;
      c.y += d[1] * c.speed * dt;
      c.angle = Math.atan2(d[1], d[0]);
    }
    // At the intersection: maybe turn.
    if (distToNext <= 4) {
      const r = NBN.rng();
      if (r < 0.35) {
        // Turn left or right.
        c.dir = (c.dir + (NBN.rng() < 0.5 ? 1 : 3)) % 4;
        c.street = c.dir === 0 || c.dir === 2 ? c.y : c.x;
        // Snap onto the new lane.
        const nd = dirs[c.dir];
        if (c.dir === 0) c.y = c.street + 20;
        if (c.dir === 2) c.y = c.street - 20;
        if (c.dir === 1) c.x = c.street - 20;
        if (c.dir === 3) c.x = c.street + 20;
        c.angle = Math.atan2(nd[1], nd[0]);
      } else {
        c.street = c.dir === 0 || c.dir === 2 ? c.y : c.x;
      }
    }
    // Keep inside the world; loop back to the other side.
    if (c.x < 40 || c.x > CFG.WORLD - 60 || c.y < 40 || c.y > CFG.WORLD - 40) {
      const i = S.cars.indexOf(c);
      if (i >= 0) S.cars.splice(i, 1);
      spawnTrafficCar(false);
      return;
    }
    // Stuck recovery: a car that has not moved for 8 seconds is in a jam that
    // will never clear (deadlocked queue, abandoned player car, bad light) —
    // respawn it on a fresh street instead of sitting there for minutes.
    if (c.speed < 5) c.stuckT += dt;
    else c.stuckT = 0;
    if (c.stuckT > 8) {
      const i = S.cars.indexOf(c);
      if (i >= 0) S.cars.splice(i, 1);
      spawnTrafficCar(false);
    }
  }

  // Push overlapping traffic cars apart so two cars can never sit inside each
  // other at an intersection after a turn.
  function separateTraffic() {
    const list = S.cars.filter((c) => c.kind === 'traffic');
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.01 && d < 44) {
          const push = (44 - d) / 2;
          const ux = dx / d;
          const uy = dy / d;
          a.x -= ux * push;
          a.y -= uy * push;
          b.x += ux * push;
          b.y += uy * push;
        }
      }
    }
  }

  // ---------------------------------------------------------------- police

  function policeCount() {
    return S.cars.filter((c) => c.kind === 'police').length;
  }

  function wantedPoliceTarget() {
    return Math.min(S.player.wanted, 4);
  }

  function spawnPoliceCar() {
    const p = S.player;
    const a = NBN.rand(0, Math.PI * 2);
    const spot = NBN.city.nearestRoadPoint(p.x + Math.cos(a) * 700, p.y + Math.sin(a) * 700);
    const c = makeCar(spot.x, spot.y, 0, 'police', '#1c2a4a');
    c.speed = 200;
    S.cars.push(c);
    NBN.audio.sirenBlip();
  }

  function updatePoliceCar(c, dt) {
    const p = S.player;
    const d = NBN.dist(c.x, c.y, p.x, p.y);
    const wantAngle = NBN.angleTo(c.x, c.y, p.x, p.y);
    // A cruiser may NEVER rest on top of the on-foot player: keep a gap.
    if (!p.inCar && d < CFG.COP_CAR_MIN_DIST_ON_FOOT) {
      const push = NBN.angleTo(p.x, p.y, c.x, c.y);
      c.x = p.x + Math.cos(push) * CFG.COP_CAR_MIN_DIST_ON_FOOT;
      c.y = p.y + Math.sin(push) * CFG.COP_CAR_MIN_DIST_ON_FOOT;
      c.speed = Math.max(0, c.speed - 300 * dt);
      return;
    }
    // Backing off after a ram: reverse away from the player, no chase, no ram.
    // This is what stops a cruiser pinning the player's car after it hits.
    if (c.backoff > 0) {
      c.backoff -= dt;
      c.speed = NBN.lerp(c.speed, -150, Math.min(1, dt * 3));
      const bx = c.x + Math.cos(c.angle) * c.speed * dt;
      const by = c.y + Math.sin(c.angle) * c.speed * dt;
      if (!NBN.city.hitBuilding(bx, c.y, 20)) c.x = bx;
      if (!NBN.city.hitBuilding(c.x, by, 20)) c.y = by;
      return;
    }
    if (c.ramCd > 0) c.ramCd -= dt;
    // One ram at a time, across ALL cruisers: this cruiser may ram only when
    // its own cooldown is up AND no cruiser has rammed in the last gate window.
    const ramReady = c.ramCd <= 0 && (S.time - S.ramGate) >= CFG.RAM_GATE_SECONDS;
    const diff = NBN.angleDiff(c.angle, wantAngle);
    c.angle += NBN.clamp(diff, -2.4 * dt, 2.4 * dt);
    // A cruiser that may not ram yet holds at a distance instead of pushing
    // into the player's car — so two cruisers can never pin it at once.
    const target = (p.inCar && d < CFG.RAM_HOLD_DIST && !ramReady) ? 0
      : d > 260 ? 330 : d > 90 ? 260 : 120;
    c.speed = NBN.lerp(c.speed, target, Math.min(1, dt * 1.5));
    const nx = c.x + Math.cos(c.angle) * c.speed * dt;
    const ny = c.y + Math.sin(c.angle) * c.speed * dt;
    // Slide along buildings: axis-separated, like the player.
    const r = 20;
    if (!NBN.city.hitBuilding(nx, c.y, r)) c.x = nx;
    if (!NBN.city.hitBuilding(c.x, ny, r)) c.y = ny;
    // Ram the player's car: a shove, not a shredder. One ram per gate across
    // all cruisers, then this cruiser backs off instead of chain-ramming.
    // A ram hurts the CAR only — the driver is shielded inside it. The car
    // is the stakes: lose it and you are on foot with the whole Bay PD.
    if (p.inCar && d < 52 && ramReady) {
      S.ramGate = S.time;
      c.ramCd = CFG.RAM_COOLDOWN;
      c.backoff = CFG.RAM_BACKOFF_SECONDS;
      const car = p.inCar;
      car.health = Math.max(0, car.health - CFG.RAM_CAR_DAMAGE);
      spawnBurst(car.x, car.y, '#ffe14d', 5);
      if (car.health <= 0) explodeCar(car);
      c.speed = -150;
    }
    // Foot cop steps out when the player is on foot and wanted is high.
    if (!p.inCar && S.player.wanted >= 2 && d < 200 && S.cops.length < S.player.wanted && NBN.rng() < dt * 0.5) {
      S.cops.push({ x: c.x + 30, y: c.y + 30, angle: 0, stun: 0, arrest: 0 });
      say('A foot cop is on you — run!');
    }
  }

  function updateCop(c, dt) {
    const p = S.player;
    if (c.stun > 0) {
      c.stun -= dt;
      return;
    }
    if (p.inCar) {
      // Cops give up chasing a car; they jog back toward their cruiser.
      c.arrest = 0;
      return;
    }
    const d = NBN.dist(c.x, c.y, p.x, p.y);
    const a = NBN.angleTo(c.x, c.y, p.x, p.y);
    c.angle = a;
    const sp = 205;
    NBN.city.moveCircle(c, Math.cos(a) * sp * dt, Math.sin(a) * sp * dt, 12);
    if (d < 30) {
      c.arrest += dt;
      if (c.arrest >= CFG.ARREST_SECONDS) {
        S.over = 'busted';
        NBN.audio.fail();
      }
    } else {
      c.arrest = Math.max(0, c.arrest - dt * 2);
    }
  }

  // ---------------------------------------------------------------- peds

  function updatePed(pd, dt) {
    const p = S.player;
    // Panic: gunfire, or a fast car close by.
    if (p.inCar && p.inCar.speed > 120 && NBN.dist(pd.x, pd.y, p.x, p.y) < 130) pd.panic = 1.5;
    if (pd.panic > 0) {
      pd.panic -= dt;
      const a = NBN.angleTo(p.x, p.y, pd.x, pd.y);
      NBN.city.moveCircle(pd, Math.cos(a) * 150 * dt, Math.sin(a) * 150 * dt, 10);
      return;
    }
    pd.walkT -= dt;
    if (pd.walkT <= 0) {
      pd.walkT = NBN.rand(2, 6);
      pd.angle = NBN.rand(0, Math.PI * 2);
    }
    NBN.city.moveCircle(pd, Math.cos(pd.angle) * pd.speed * dt, Math.sin(pd.angle) * pd.speed * dt, 10);
    // A car hitting a pedestrian is a crime — and capped damage to the player.
    if (p.inCar && p.inCar.speed > 60 && NBN.dist(pd.x, pd.y, p.x, p.y) < 26) {
      pd.panic = 2;
      damagePlayer(CFG.TRAFFIC_HIT_DAMAGE, 'ped');
      addWanted(1);
      spawnBurst(pd.x, pd.y, '#ff5c5c', 8);
      pd.x += Math.cos(p.inCar.angle) * 30;
      pd.y += Math.sin(p.inCar.angle) * 30;
    }
    if (NBN.dist(pd.x, pd.y, p.x, p.y) > 900) {
      const i = S.peds.indexOf(pd);
      if (i >= 0) S.peds.splice(i, 1);
      spawnPed(false);
    }
  }

  // ---------------------------------------------------------------- player update

  function updatePlayer(dt) {
    const p = S.player;
    const inp = NBN.input;
    if (p.invuln > 0) p.invuln -= dt;
    if (p.punchCd > 0) p.punchCd -= dt;
    if (p.carCd > 0) p.carCd -= dt;
    if (S.over) return;

    // Mouse aim on foot.
    if (!p.inCar && NBN.canvas) {
      const cam = NBN.camera;
      const wx = cam.x + inp.mouse.x - NBN.canvas.width / 2;
      const wy = cam.y + inp.mouse.y - NBN.canvas.height / 2;
      if (NBN.dist(p.x, p.y, wx, wy) > 20) p.angle = NBN.angleTo(p.x, p.y, wx, wy);
    }

    // E is NOT a toggle: after stealing or exiting, E is dead for a beat so a
    // quick double-press cannot steal and then instantly throw you back out.
    if (inp.hit('KeyE') && p.carCd <= 0) {
      if (p.inCar) {
        exitCar();
        p.carCd = CFG.ENTER_COOLDOWN;
      } else if (stealCar()) {
        p.carCd = CFG.ENTER_COOLDOWN;
      }
    }
    if (inp.hit('Space')) {
      if (p.hasPistol && p.ammo > 0) shoot();
      else punch();
    }
    // Mouse click shoots too (hold to keep firing, rate-limited by punchCd) —
    // the pistol aims at the mouse on foot, so a click must do something.
    if (NBN.input.mouse.down && !p.inCar && p.hasPistol) shoot();

    if (p.inCar) {
      const car = p.inCar;
      const ax = inp.axis();
      // Arcade driving: W/S throttle, A/D steer (stronger at speed).
      const forward = -ax.y; // W = up = forward
      const steer = ax.x;
      if (forward > 0) car.speed = Math.min(CFG.CAR_MAX_SPEED, car.speed + CFG.CAR_ACCEL * dt);
      else if (forward < 0) car.speed = Math.max(-CFG.CAR_REVERSE_MAX, car.speed - CFG.CAR_ACCEL * 0.8 * dt);
      else car.speed = NBN.lerp(car.speed, 0, Math.min(1, dt * 1.2));
      const turnRate = CFG.CAR_TURN * NBN.clamp(Math.abs(car.speed) / 200, 0.15, 1);
      car.angle += steer * turnRate * dt * (car.speed >= 0 ? 1 : -1);
      const dx = Math.cos(car.angle) * car.speed * dt;
      const dy = Math.sin(car.angle) * car.speed * dt;
      // Axis-separated slide: the car glides along walls and corners.
      const r = 20;
      const nx = car.x + dx;
      if (!NBN.city.hitBuilding(nx, car.y, r) && !NBN.city.inWater(nx, car.y) && nx > r && nx < CFG.WORLD - r) car.x = nx;
      else if (Math.abs(car.speed) > 60) {
        car.speed *= 0.6;
        spawnBurst(car.x, car.y, '#cfd2d8', 3);
      }
      const ny = car.y + dy;
      if (!NBN.city.hitBuilding(car.x, ny, r) && !NBN.city.inWater(car.x, ny) && ny > r && ny < CFG.WORLD - r) car.y = ny;
      else if (Math.abs(car.speed) > 60) {
        car.speed *= 0.6;
        spawnBurst(car.x, car.y, '#cfd2d8', 3);
      }
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      p.speed = car.speed;
      // Crash into traffic at speed: capped damage, both cars hurt, and
      // rate-limited so one overlap cannot shred a car in a few frames.
      if (car.crashCd > 0) car.crashCd -= dt;
      for (const o of S.cars) {
        // Police contact is the ram logic's job, not a crash: reversing into a
        // cruiser that is already ramming you must not shred your car.
        if (o === car || o.kind === 'parked' || o.kind === 'police') continue;
        if (car.crashCd <= 0 && NBN.dist(car.x, car.y, o.x, o.y) < 44 && Math.abs(car.speed) > 120) {
          car.crashCd = 0.8;
          damagePlayer(CFG.TRAFFIC_HIT_DAMAGE, 'crash');
          car.health = Math.max(0, car.health - 8);
          o.health = Math.max(0, o.health - 12);
          car.speed *= 0.4;
          spawnBurst(car.x, car.y, '#ffe14d', 8);
          if (o.health <= 0) explodeCar(o);
          if (car.health <= 0) { explodeCar(car); break; }
        }
      }
      NBN.audio.setEngine(Math.abs(car.speed) / CFG.CAR_MAX_SPEED, true);
    } else {
      const ax = inp.axis();
      const sprint = inp.down('ShiftLeft') || inp.down('ShiftRight');
      const sp = CFG.WALK_SPEED * (sprint ? CFG.SPRINT_MULT : 1);
      p.sprinting = sprint && (ax.x !== 0 || ax.y !== 0);
      const len = Math.hypot(ax.x, ax.y) || 1;
      const dx = (ax.x / len) * sp * dt * (ax.x || ax.y ? 1 : 0);
      const dy = (ax.y / len) * sp * dt * (ax.x || ax.y ? 1 : 0);
      NBN.city.moveCircle(p, dx, dy, CFG.PLAYER_RADIUS);
      p.speed = (ax.x || ax.y) ? sp : 0;
      NBN.audio.setEngine(0, false);
    }

    // Pistol pickup by the garage.
    if (!S.pistolTaken && !p.inCar && NBN.dist(p.x, p.y, NBN.PLACES.pistolPickup.x, NBN.PLACES.pistolPickup.y) < 34) {
      S.pistolTaken = true;
      p.hasPistol = true;
      p.ammo = 24;
      say('Picked up a pistol — 24 rounds. Space to shoot.');
      NBN.audio.pickup();
    }

    // Wanted decay: stay quiet and out of sight, stars fade.
    if (p.wanted > 0 && S.time - p.lastCrime > 6) {
      let copNear = false;
      for (const c of S.cars) if (c.kind === 'police' && NBN.dist(c.x, c.y, p.x, p.y) < 320) copNear = true;
      if (!copNear) {
        p.quietTime += dt;
        if (p.quietTime >= CFG.WANTED_DECAY_SECONDS) {
          p.wanted--;
          p.quietTime = 0;
          say(p.wanted > 0 ? `Heat cooling off — ${p.wanted} star${p.wanted > 1 ? 's' : ''} left.` : 'You are clean. The Bay PD lost you.');
        }
      } else {
        p.quietTime = 0;
      }
    }
    healTick(dt);
  }

  // ---------------------------------------------------------------- bullets / guards

  function updateBullets(dt) {
    for (let i = S.bullets.length - 1; i >= 0; i--) {
      const b = S.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let dead = b.life <= 0 || NBN.city.hitBuilding(b.x, b.y, 2);
      if (dead && b.life > 0) spawnBurst(b.x, b.y, '#ffe14d', 3);
      if (!dead && b.from === 'player') {
        for (const g of S.guards) {
          if (g.hp > 0 && NBN.dist(b.x, b.y, g.x, g.y) < 18) {
            g.hp -= 25;
            spawnBurst(g.x, g.y, '#ff5c5c', 6);
            if (g.hp <= 0) addWanted(1);
            dead = true;
            break;
          }
        }
        for (const c of S.cops) {
          if (NBN.dist(b.x, b.y, c.x, c.y) < 16) {
            c.stun = 1.5;
            spawnBurst(c.x, c.y, '#ff5c5c', 6);
            dead = true;
            break;
          }
        }
      }
      if (!dead && b.from === 'guard') {
        const p = S.player;
        if (!p.inCar && NBN.dist(b.x, b.y, p.x, p.y) < 16) {
          damagePlayer(CFG.BULLET_DAMAGE, 'bullet');
          dead = true;
        }
        if (p.inCar && NBN.dist(b.x, b.y, p.x, p.y) < 26) {
          p.inCar.health = Math.max(0, p.inCar.health - 3);
          dead = true;
        }
      }
      if (dead) S.bullets.splice(i, 1);
    }
  }

  function updateGuards(dt) {
    const p = S.player;
    for (const g of S.guards) {
      if (g.hp <= 0) continue;
      g.shootCd -= dt;
      const d = NBN.dist(g.x, g.y, p.x, p.y);
      if (d < 420 && g.shootCd <= 0) {
        g.shootCd = 1.1;
        const a = NBN.angleTo(g.x, g.y, p.x, p.y);
        S.bullets.push({ x: g.x, y: g.y, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, life: 1.2, from: 'guard' });
        NBN.audio.gunshot();
      }
    }
  }

  // ---------------------------------------------------------------- main update

  function update(dt) {
    if (!S) return;
    S.time += dt;
    if (S.messageT > 0) S.messageT -= dt;
    if (S.flash > 0) S.flash = Math.max(0, S.flash - dt * 2.2);
    if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 26);

    updatePlayer(dt);
    NBN.missions.update(dt);

    for (let i = S.cars.length - 1; i >= 0; i--) {
      const c = S.cars[i];
      if (c.kind === 'traffic') updateTrafficCar(c, dt);
      else if (c.kind === 'police') updatePoliceCar(c, dt);
    }
    // Police reinforcements while wanted.
    if (S.player.wanted > 0 && policeCount() < wantedPoliceTarget() && NBN.rng() < dt * 0.8) spawnPoliceCar();
    // Cops leave when the heat is gone.
    if (S.player.wanted === 0) {
      for (let i = S.cars.length - 1; i >= 0; i--) {
        if (S.cars[i].kind === 'police') S.cars.splice(i, 1);
      }
      S.cops.length = 0;
    }
    for (const c of S.cops) updateCop(c, dt);
    for (let i = S.peds.length - 1; i >= 0; i--) updatePed(S.peds[i], dt);
    updateBullets(dt);
    updateGuards(dt);

    // Traffic / ped top-up.
    const trafficN = S.cars.filter((c) => c.kind === 'traffic').length;
    if (trafficN < MAX_TRAFFIC && NBN.rng() < dt * CFG.TRAFFIC_TOPUP) spawnTrafficCar(false);
    if (S.peds.length < MAX_PEDS && NBN.rng() < dt * 0.5) spawnPed(false);
    separateTraffic();

    for (let i = S.particles.length - 1; i >= 0; i--) {
      const pt = S.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.98;
      pt.vy *= 0.98;
      pt.life -= dt;
      if (pt.life <= 0) S.particles.splice(i, 1);
    }
    for (let i = S.floats.length - 1; i >= 0; i--) {
      const f = S.floats[i];
      f.y -= 30 * dt;
      f.life -= dt;
      if (f.life <= 0) S.floats.splice(i, 1);
    }
    NBN.audio.setSiren(S.player.wanted > 0);
  }

  function getState() {
    return S;
  }

  NBN.world = {
    init, update, getState, say, addWanted, damagePlayer, stealCar, exitCar,
    punch, shoot, spawnBurst, explodeCar, addFloat, spawnPoliceCar,
    nearestCar, makeCar,
  };
})();

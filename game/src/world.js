// The game's rules and state, with no drawing and no browser in it: the player on foot and
// in cars, traffic, pedestrians, police, enemies, bullets, particles, the wanted level, the
// missions and the money. step() advances one fixed step and returns what happened as bit
// flags, so the caller can react without the world knowing about screens or sound. The
// audio object passed in is only a set of named sound calls.
//
// Fairness rules that matter most (learned from playtesting): the wanted level must be
// losable — stars fade once no cop is close, and a cruiser that falls behind gives up —
// and crash damage must sting without grinding a car to scrap on one long drive, or the
// Repo Man job becomes unwinnable. Health also creeps back after a quiet spell on foot,
// so a long chase does not end in a cheap death.

import {
  BEACH, CAR, ENEMY, PALETTE, PARKED, PEDS, PISTOL, PLAYER, POLICE, ROAD_HALF, ROAD_X, ROAD_Y,
  SPAWN, STEAL_RADIUS, TRAFFIC, WANTED, WORLD,
} from './config.js';
import { createCity, hitsBuilding, lightState, nearestRoad, onRoad, resolveBuildingCollision } from './city.js';
import { createMissionRunner, MISSION_DEFS } from './missions.js';

export const EVENT_STEP = 1;
export const EVENT_MISSION_COMPLETE = 2;
export const EVENT_MISSION_FAIL = 4;
export const EVENT_WASTED = 8;
export const EVENT_BUSTED = 16;
export const EVENT_CASH = 32;

const TAU = Math.PI * 2;

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function dist(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}
function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
function pickColor(random, list) { return list[Math.floor(random() * list.length)]; }

function makeCar(x, y, angle, color, kind) {
  return {
    x, y, angle, speed: 0, health: CAR.health, color, kind,
    axis: 'v', line: x, dir: 1, lane: 14, lightStop: false,
    turnCooldown: 0, dead: false, smoke: 0, bump: 0, farTime: 0,
  };
}

export function createWorld(random, save) {
  const city = createCity(random);
  const missions = createMissionRunner();
  const state = {
    city,
    time: 0,
    money: save.money,
    done: [...save.done],
    wanted: 0,
    wantedTimer: 0,
    crimeCooldown: 0,
    player: null,
    cars: [],
    peds: [],
    policeCars: [],
    footCops: [],
    enemies: [],
    bullets: [],
    particles: [],
    pickups: [],
    targetCar: null,
    camera: { x: SPAWN.x, y: SPAWN.y },
    shake: 0,
    message: { text: '', until: 0 },
    mission: missions,
    spawnProtect: 0,
    policeSpawnTimer: 0,
    trafficSpawnTimer: 0,
    lastHurt: -999,
    over: null, // 'wasted' | 'busted'
  };

  function showMessage(text, seconds) {
    state.message = { text, until: state.time + (seconds || 4) };
  }

  function addParticles(x, y, n, color, speed, life) {
    for (let i = 0; i < n; i += 1) {
      const a = random() * TAU;
      const s = (0.3 + random() * 0.7) * speed;
      state.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: life * (0.5 + random() * 0.5), maxLife: life, color, size: 2 + random() * 4,
      });
    }
  }

  function hurtPlayer(amount) {
    const p = state.player;
    if (!p || p.invulnerable > 0 || state.over) return;
    p.health -= amount;
    p.invulnerable = Math.max(p.invulnerable, 0.6);
    state.lastHurt = state.time;
    if (p.health <= 0) state.over = 'wasted';
  }

  function addWanted(n) {
    if (state.over) return;
    state.wanted = clamp(state.wanted + n, 0, WANTED.max);
    state.wantedTimer = 0;
  }

  function addCrime(n) {
    if (state.crimeCooldown > 0 || state.over) return;
    state.crimeCooldown = 2;
    addWanted(n);
  }

  function spawnTrafficCar() {
    // New cars drive in from a map edge: vertical roads enter from the north edge
    // (the streets end at the beach in the south, so nothing spawns out of the sea),
    // horizontal roads from the west or east edge.
    const vertical = random() < 0.5;
    const line = vertical ? ROAD_X[Math.floor(random() * ROAD_X.length)] : ROAD_Y[Math.floor(random() * ROAD_Y.length)];
    let dir;
    let x;
    let y;
    if (vertical) {
      dir = 1;
      x = line + 14;
      y = -60;
    } else {
      dir = random() < 0.5 ? 1 : -1;
      x = dir > 0 ? -60 : WORLD.width + 60;
      y = line + (dir > 0 ? 14 : -14);
    }
    const car = makeCar(x, y, vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI), pickColor(random, PALETTE.trafficCar), 'traffic');
    car.axis = vertical ? 'v' : 'h';
    car.line = line;
    car.dir = dir;
    car.speed = TRAFFIC.speed * (0.85 + random() * 0.3);
    state.cars.push(car);
    return car;
  }

  function spawnParkedCar(x, y, angle, color) {
    const car = makeCar(x, y, angle, color || pickColor(random, PALETTE.trafficCar), 'parked');
    state.cars.push(car);
    return car;
  }

  function spawnPed() {
    const vertical = random() < 0.5;
    const line = vertical ? ROAD_X[Math.floor(random() * ROAD_X.length)] : ROAD_Y[Math.floor(random() * ROAD_Y.length)];
    const side = random() < 0.5 ? 1 : -1;
    const along = 100 + random() * (WORLD.height - 200);
    const x = vertical ? line + side * (ROAD_HALF + 14) : along;
    const y = vertical ? along : line + side * (ROAD_HALF + 14);
    state.peds.push({
      x, y, angle: random() * TAU, speed: PEDS.speed * (0.8 + random() * 0.4),
      axis: vertical ? 'v' : 'h', line, dir: random() < 0.5 ? 1 : -1,
      side, panic: 0, panicX: 0, panicY: 0, pause: 0, color: pickColor(random, ['#e8e8e8', '#f2b134', '#7c5cd6', '#5cd68a', '#d64545', '#45a8d6']),
      down: 0, walkPhase: random() * TAU,
    });
  }

  function spawnPoliceCar() {
    const road = nearestRoad(state.player.x, state.player.y);
    const angle = random() * TAU;
    const d = 650 + random() * 250;
    let x = clamp(state.player.x + Math.cos(angle) * d, 80, WORLD.width - 80);
    let y = clamp(state.player.y + Math.sin(angle) * d, 80, BEACH.waterTop - 80);
    // Snap onto the nearest road so the sirens arrive by street, not through buildings.
    if (road.axis === 'v') x = road.line + 14;
    else y = road.line + 14;
    const car = makeCar(x, y, angleTo(x, y, state.player.x, state.player.y), PALETTE.copCar, 'police');
    car.speed = POLICE.chaseSpeed * 0.7;
    // Pursuit runs on the streets: start on the road nearest the player.
    car.axis = road.axis;
    car.line = road.line;
    car.dir = road.axis === 'v'
      ? (state.player.y >= y ? 1 : -1)
      : (state.player.x >= x ? 1 : -1);
    state.policeCars.push(car);
    return car;
  }

  function spawnFootCop() {
    const angle = random() * TAU;
    const d = 320 + random() * 160;
    const x = clamp(state.player.x + Math.cos(angle) * d, 40, WORLD.width - 40);
    const y = clamp(state.player.y + Math.sin(angle) * d, 40, BEACH.waterTop - 40);
    state.footCops.push({ x, y, angle: 0, speed: 215, arrest: 0 });
  }

  function spawnEnemy(x, y) {
    state.enemies.push({ x, y, angle: 0, health: ENEMY.health, shootCooldown: 1 + random(), speed: ENEMY.speed });
  }

  function explodeCar(car) {
    car.dead = true;
    addParticles(car.x, car.y, 46, '#ff9f1c', 320, 0.9);
    addParticles(car.x, car.y, 30, '#e8e8e8', 180, 1.4);
    addParticles(car.x, car.y, 20, '#3c414d', 120, 1.8);
    state.shake = Math.max(state.shake, 14);
  }

  function damageCar(car, amount, audio) {
    if (car.dead) return;
    car.health -= amount;
    if (car.health <= 0) {
      explodeCar(car);
      if (audio) audio.explosion();
      if (car === state.player.car) {
        state.player.car = null;
        hurtPlayer(25);
        state.player.invulnerable = 1.5;
        state.player.x = clamp(car.x + 40, 20, WORLD.width - 20);
        state.player.y = clamp(car.y + 40, 20, BEACH.waterTop - 20);
        state.shake = 18;
        showMessage('Your car blew up! Get clear and find another ride.', 4);
      }
    } else if (car.health < CAR.health * 0.3) {
      car.smoke = 1;
    }
  }

  function reset() {
    state.time = 0;
    state.wanted = 0;
    state.wantedTimer = 0;
    state.crimeCooldown = 0;
    state.cars = [];
    state.peds = [];
    state.policeCars = [];
    state.footCops = [];
    state.enemies = [];
    state.bullets = [];
    state.particles = [];
    state.targetCar = null;
    state.over = null;
    state.shake = 0;
    state.spawnProtect = PLAYER.spawnProtect;
    state.policeSpawnTimer = 0;
    state.trafficSpawnTimer = 0;
    state.lastHurt = -999;
    state.player = {
      x: SPAWN.x, y: SPAWN.y, angle: -Math.PI / 2, health: PLAYER.health,
      car: null, invulnerable: PLAYER.spawnProtect, punchCooldown: 0, fireCooldown: 0,
      ammo: 0, hasPistol: false, walkPhase: 0, moving: false,
    };
    state.camera = { x: SPAWN.x, y: SPAWN.y };
    state.message = { text: 'Welcome to Neon Bay. Marla Voss has work for you — press Enter to take the first job.', until: 8 };
    state.pickups = [{ x: SPAWN.x + 60, y: SPAWN.y + 60, kind: 'pistol', taken: false, respawn: 0 }];
    for (let i = 0; i < TRAFFIC.count; i += 1) spawnTrafficCar();
    for (let i = 0; i < PEDS.count; i += 1) spawnPed();
    // Parked cars along the kerbs, easy to steal.
    const parkedSpots = [
      [600, 248, 0], [1000, 152, Math.PI / 2], [1800, 248, 0], [2200, 648, Math.PI / 2],
      [3000, 1048, 0], [1400, 1848, Math.PI / 2], [2600, 2248, 0],
    ];
    for (const [x, y, a] of parkedSpots) spawnParkedCar(x, y, a);
  }

  // ---- player on foot ----
  function stepPlayerOnFoot(dt, ctl, audio) {
    const p = state.player;
    const len = Math.hypot(ctl.moveX, ctl.moveY);
    p.moving = len > 0;
    if (len > 0) {
      const speed = PLAYER.walkSpeed;
      p.x += (ctl.moveX / len) * speed * dt;
      p.y += (ctl.moveY / len) * speed * dt;
      p.walkPhase += dt * 10;
    }
    p.angle = Math.atan2(ctl.aimY - p.y, ctl.aimX - p.x);
    resolveBuildingCollision(city, p, PLAYER.radius);
    // Bump out of cars.
    for (const car of state.cars) {
      if (car.dead) continue;
      const d = dist(p.x, p.y, car.x, car.y);
      if (d < 30 && d > 0.01) {
        p.x = car.x + ((p.x - car.x) / d) * 30;
        p.y = car.y + ((p.y - car.y) / d) * 30;
      }
    }
    if (p.punchCooldown > 0) p.punchCooldown -= dt;
    if (p.fireCooldown > 0) p.fireCooldown -= dt;
    if (ctl.punch && p.punchCooldown <= 0) {
      p.punchCooldown = PLAYER.punchCooldown;
      audio.punch();
      const reach = PLAYER.punchRange + 14;
      for (const e of state.enemies) {
        if (dist(p.x, p.y, e.x, e.y) < reach) {
          e.health -= PLAYER.punchDamage;
          addParticles(e.x, e.y, 8, '#ffd166', 160, 0.4);
        }
      }
      for (const ped of state.peds) {
        if (!ped.down && dist(p.x, p.y, ped.x, ped.y) < reach) {
          ped.down = 999;
          ped.panic = 3;
          addCrime(WANTED.hitPed);
          addParticles(ped.x, ped.y, 8, '#ef476f', 160, 0.4);
          showMessage('You hit a pedestrian! The police will hear about that.', 3);
        }
      }
    }
    if (ctl.firing && p.hasPistol && p.fireCooldown <= 0 && p.ammo > 0) {
      p.fireCooldown = PISTOL.fireCooldown;
      p.ammo -= 1;
      audio.gunshot();
      addCrime(WANTED.shoot);
      const a = p.angle;
      state.bullets.push({
        x: p.x + Math.cos(a) * 20, y: p.y + Math.sin(a) * 20,
        vx: Math.cos(a) * PISTOL.bulletSpeed, vy: Math.sin(a) * PISTOL.bulletSpeed,
        life: PISTOL.range / PISTOL.bulletSpeed, fromPlayer: true, damage: PISTOL.damage,
      });
      state.shake = Math.max(state.shake, 2);
    }
    // Pistol pickup.
    for (const pickup of state.pickups) {
      if (pickup.taken) continue;
      if (dist(p.x, p.y, pickup.x, pickup.y) < 30) {
        pickup.taken = true;
        pickup.respawn = 60;
        p.hasPistol = true;
        p.ammo = PISTOL.ammo;
        audio.pickup();
        showMessage('Pistol picked up — 12 rounds. Click to shoot, aim with the mouse.', 4);
      }
    }
    // Steal a car. The mission-marked coupe wins over any other car in reach:
    // a player who walks up to the marked car expects to take that car, not the
    // junker they arrived in parked beside it.
    if (ctl.interact) {
      let best = null;
      let bestD = STEAL_RADIUS;
      if (state.targetCar && !state.targetCar.dead && dist(p.x, p.y, state.targetCar.x, state.targetCar.y) < bestD) {
        best = state.targetCar;
      } else {
        for (const car of state.cars) {
          if (car.dead) continue;
          const d = dist(p.x, p.y, car.x, car.y);
          if (d < bestD) { bestD = d; best = car; }
        }
      }
      if (best) {
        p.car = best;
        if (best.kind === 'traffic') {
          best.kind = 'player';
          addCrime(WANTED.stealCar);
          showMessage('Car stolen! The owner called it in — watch the stars.', 3);
        } else if (best.kind === 'police') {
          best.kind = 'player';
          addCrime(2);
          showMessage('You stole a police cruiser?! Bold. Very bold.', 3);
        } else {
          showMessage(best === state.targetCar ? 'That\u2019s the coupe. Get it to the garage.' : 'You\u2019re driving. W A S D to drive, E to get out.', 3);
        }
        if (best === state.targetCar) state.targetCar = best;
        audio.click();
      }
    }
  }

  // ---- driving ----
  function stepDriving(dt, ctl, audio) {
    const p = state.player;
    const car = p.car;
    if (!car || car.dead) { p.car = null; return; }
    const forward = { x: Math.cos(car.angle), y: Math.sin(car.angle) };
    if (ctl.up) car.speed += CAR.accel * dt;
    else if (ctl.down) {
      if (car.speed > 20) car.speed -= CAR.brake * dt;
      else car.speed -= CAR.reverseAccel * dt;
    } else {
      car.speed -= car.speed * 0.9 * dt;
      if (Math.abs(car.speed) < 4) car.speed = 0;
    }
    car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
    // Steering scales with speed, but a car pulling away from a standstill can still
    // turn a lot — otherwise a wedged car could never steer out of a tight spot, and
    // a U-turn on a narrow street becomes a three-point shuffle into a wall.
    let speedFactor = clamp(Math.abs(car.speed) / 120, 0, 1);
    if (speedFactor < 0.5 && (ctl.up || ctl.down)) speedFactor = 0.5;
    car.angle += ctl.steer * CAR.turnRate * speedFactor * dt * (car.speed >= 0 ? 1 : -1);
    const oldX = car.x;
    const oldY = car.y;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Slide along walls: move fully, then push the car out of any building along
    // the shortest exit. The push-out cancels only the into-wall component, so the
    // car glides along the wall (and around corners) instead of stopping dead
    // nose-first into it — the old axis-by-axis revert wedged the car at speed 0
    // on building corners, and every retry wedged it again.
    const attempted = Math.abs(car.speed) * dt;
    const hitBuilding = resolveBuildingCollision(city, car, 18);
    if (hitBuilding) {
      const moved = dist(car.x, car.y, oldX, oldY);
      if (moved < attempted * 0.5) wallHit(Math.abs(car.speed));
      else if (moved < attempted * 0.9) car.speed *= 0.9;
    }
    // A hard hit into a wall damages the car and shakes the camera; a gentle scrape
    // just slows it down. Damage is deliberately light: one bad corner must not end
    // a whole job.
    function wallHit(intoSpeed) {
      if (intoSpeed > 300 && car.bump <= 0) {
        car.bump = 0.8;
        damageCar(car, Math.round((intoSpeed - 300) / 80), audio);
        audio.crash();
        state.shake = Math.max(state.shake, 6);
        addParticles(car.x + forward.x * 26, car.y + forward.y * 26, 10, '#e8e8e8', 200, 0.5);
      }
      car.speed *= 0.75;
    }
    car.x = clamp(car.x, 24, WORLD.width - 24);
    car.y = clamp(car.y, 24, BEACH.waterTop - 24);
    // Other cars: shove apart, trade a little damage.
    for (const other of state.cars) {
      if (other === car || other.dead) continue;
      const d = dist(car.x, car.y, other.x, other.y);
      if (d < 46 && d > 0.01) {
        const push = (46 - d) / 2;
        const nx = (car.x - other.x) / d;
        const ny = (car.y - other.y) / d;
        const ox = car.x;
        const oy = car.y;
        const oox = other.x;
        const ooy = other.y;
        car.x += nx * push;
        car.y += ny * push;
        other.x -= nx * push;
        other.y -= ny * push;
        // A shove must never push a car into a building: revert the shoved side.
        if (hitsBuilding(city, car.x, car.y, 18)) { car.x = ox; car.y = oy; }
        if (hitsBuilding(city, other.x, other.y, 24)) { other.x = oox; other.y = ooy; }
        const rel = Math.abs(car.speed - other.speed);
        if (rel > 150 && car.bump <= 0) {
          car.bump = 0.8;
          other.bump = 0.8;
          damageCar(car, 1, audio);
          damageCar(other, 1, audio);
          audio.crash();
          state.shake = Math.max(state.shake, 5);
        }
        car.speed *= 0.7;
      }
    }
    // Police ramming: keep the cruiser out of the player's car (continuous separation,
    // so it cannot sit inside the player and pin them in a corner), and on a real ram
    // the cruiser bounces back off, giving the player room to pull away. The ram hurts
    // a little and is gated by a 2 s cooldown, so it cannot grind the car down.
    for (const cop of state.policeCars) {
      const d = dist(car.x, car.y, cop.x, cop.y);
      if (d < 46 && d > 0.01) {
        const push = (46 - d) / 2;
        const nx = (car.x - cop.x) / d;
        const ny = (car.y - cop.y) / d;
        const ox = car.x;
        const oy = car.y;
        car.x += nx * push;
        car.y += ny * push;
        // The cruiser always gives way; the player is only pushed if it does not
        // put them into a building.
        cop.x -= nx * push;
        cop.y -= ny * push;
        if (hitsBuilding(city, car.x, car.y, 18)) { car.x = ox; car.y = oy; }
        if (cop.bump <= 0) {
          cop.bump = 2.0;
          car.speed *= 0.6;
          cop.speed = -100;
          damageCar(car, 1, audio);
          audio.crash();
          state.shake = Math.max(state.shake, 5);
        }
      }
    }
    // Pedestrians in the way: a hard hit knocks them down and counts as a crime.
    for (const ped of state.peds) {
      if (ped.down) continue;
      const d = dist(car.x, car.y, ped.x, ped.y);
      if (d < 30 && Math.abs(car.speed) > 60) {
        ped.down = 999;
        ped.panic = 3;
        addCrime(WANTED.hitPed);
        car.speed *= 0.75;
        state.shake = Math.max(state.shake, 4);
        audio.crash();
        showMessage('You hit a pedestrian! That\u2019s a wanted star.', 3);
      } else if (d < 46) {
        ped.panic = 2;
        ped.panicX = car.x;
        ped.panicY = car.y;
      }
    }
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    if (car.smoke > 0 && random() < 0.3) {
      addParticles(car.x - forward.x * 20, car.y - forward.y * 20, 1, '#3c414d', 40, 1.2);
    }
    if (ctl.interact) {
      p.car = null;
      p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
      p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
      resolveBuildingCollision(city, p, PLAYER.radius);
      if (car.kind === 'player') car.kind = 'parked';
      audio.click();
    }
  }

  function stepTraffic(dt) {
    for (const car of state.cars) {
      if (car.kind !== 'traffic' || car.dead) continue;
      car.turnCooldown -= dt;
      // Where this car is along its road, and the next intersection ahead.
      const along = car.axis === 'v' ? car.y : car.x;
      const lines = car.axis === 'v' ? ROAD_Y : ROAD_X;
      let nextLine = null;
      for (const line of lines) {
        if (car.dir > 0 && line > along + 10) { nextLine = line; break; }
        if (car.dir < 0 && line < along - 10) { nextLine = line; break; }
      }
      // Traffic light at the next intersection.
      let wantSpeed = TRAFFIC.speed;
      if (nextLine !== null) {
        const light = state.city.lights.find((l) => (car.axis === 'v' ? l.x === car.line && l.y === nextLine : l.y === car.line && l.x === nextLine));
        if (light) {
          const greenForMe = car.axis === 'v' ? lightState(light, state.time) === 'green' : lightState(light, state.time) === 'red';
          const distToLine = Math.abs(nextLine - along);
          if (!greenForMe && distToLine < 70) wantSpeed = 0;
        }
        // Maybe turn at the intersection.
        if (Math.abs(nextLine - along) < 8 && car.turnCooldown <= 0 && random() < 0.45) {
          car.turnCooldown = 6;
          const newAxis = car.axis === 'v' ? 'h' : 'v';
          const newLine = nextLine;
          const newDir = random() < 0.5 ? 1 : -1;
          car.axis = newAxis;
          car.line = newLine;
          car.dir = newDir;
          car.x = newAxis === 'v' ? newLine + (newDir > 0 ? 14 : -14) : car.x;
          car.y = newAxis === 'h' ? newLine + (newDir > 0 ? 14 : -14) : car.y;
          car.angle = newAxis === 'v' ? (newDir > 0 ? Math.PI / 2 : -Math.PI / 2) : (newDir > 0 ? 0 : Math.PI);
        }
      }
      // Slow for the car ahead on the same road.
      for (const other of state.cars) {
        if (other === car || other.dead || other.axis !== car.axis || other.line !== car.line || other.dir !== car.dir) continue;
        const gap = car.axis === 'v' ? (other.y - car.y) * car.dir : (other.x - car.x) * car.dir;
        if (gap > 0 && gap < TRAFFIC.minGap) wantSpeed = Math.min(wantSpeed, 40);
      }
      if (state.player.car) {
        const pc = state.player.car;
        if (pc.axis === car.axis && pc.line === car.line) {
          const gap = car.axis === 'v' ? (pc.y - car.y) * car.dir : (pc.x - car.x) * car.dir;
          if (gap > 0 && gap < TRAFFIC.minGap) wantSpeed = Math.min(wantSpeed, 30);
        }
      }
      car.speed += clamp(wantSpeed - car.speed, -300 * dt, 200 * dt);
      const step = car.speed * dt;
      if (car.axis === 'v') {
        car.y += car.dir * step;
        car.x += (car.line + (car.dir > 0 ? 14 : -14) - car.x) * Math.min(1, dt * 4);
      } else {
        car.x += car.dir * step;
        car.y += (car.line + (car.dir > 0 ? 14 : -14) - car.y) * Math.min(1, dt * 4);
      }
      // Off the map edge, or past the last street onto the beach: recycle the car.
      // (The streets end at the last east-west road; the sand is not a road.)
      if (car.x < -120 || car.x > WORLD.width + 120 || car.y < -120 || car.y > WORLD.height + 120 ||
        (car.axis === 'v' && car.dir > 0 && car.y > ROAD_Y[ROAD_Y.length - 1] + 80)) {
        const idx = state.cars.indexOf(car);
        if (idx !== -1) state.cars.splice(idx, 1);
        spawnTrafficCar();
      }
    }
  }

  function stepPeds(dt) {
    for (const ped of state.peds) {
      if (ped.down > 0) {
        ped.down -= dt;
        if (ped.down <= 0) {
          ped.down = 0;
          // They get up, shaken, and walk away.
          ped.panic = 2;
          ped.panicX = state.player.x;
          ped.panicY = state.player.y;
        }
        continue;
      }
      ped.walkPhase += dt * 8;
      if (ped.panic > 0) {
        ped.panic -= dt;
        const a = Math.atan2(ped.y - ped.panicY, ped.x - ped.panicX);
        ped.x += Math.cos(a) * PEDS.speed * 2.2 * dt;
        ped.y += Math.sin(a) * PEDS.speed * 2.2 * dt;
        ped.angle = a;
        resolveBuildingCollision(city, ped, 10);
        continue;
      }
      if (ped.pause > 0) {
        ped.pause -= dt;
        continue;
      }
      if (random() < 0.002) { ped.pause = 1 + random() * 2; continue; }
      const along = ped.axis === 'v' ? ped.y : ped.x;
      const lines = ped.axis === 'v' ? ROAD_Y : ROAD_X;
      for (const line of lines) {
        if (Math.abs(line - along) < 6 && random() < 0.3) {
          ped.axis = ped.axis === 'v' ? 'h' : 'v';
          ped.line = line;
          ped.dir = random() < 0.5 ? 1 : -1;
          break;
        }
      }
      const off = (ROAD_HALF + 14) * ped.side;
      if (ped.axis === 'v') {
        ped.y += ped.dir * ped.speed * dt;
        ped.x += (ped.line + off - ped.x) * Math.min(1, dt * 4);
        ped.angle = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        if (ped.y < 60 || ped.y > BEACH.sandTop - 20) ped.dir *= -1;
      } else {
        ped.x += ped.dir * ped.speed * dt;
        ped.y += (ped.line + off - ped.y) * Math.min(1, dt * 4);
        ped.angle = ped.dir > 0 ? 0 : Math.PI;
        if (ped.x < 60 || ped.x > WORLD.width - 60) ped.dir *= -1;
      }
      // Keep off the sand when strolling; the beach crowd walks the promenade instead.
      if (ped.y > BEACH.sandTop - 20) ped.y = BEACH.sandTop - 20;
    }
  }

  function stepPolice(dt, audio) {
    const p = state.player;
    // Spawn to match the wanted level. No new cruisers while the player is still
    // under spawn protection — the first seconds of a run are always safe.
    state.policeSpawnTimer -= dt;
    const wantCars = Math.min(state.wanted * POLICE.carsPerStar, POLICE.maxCars);
    if (state.wanted > 0 && state.spawnProtect <= 0 && state.policeCars.length < wantCars && state.policeSpawnTimer <= 0) {
      spawnPoliceCar();
      state.policeSpawnTimer = 2.5;
    }
    // When a star fades, the pressure fades with it: the farthest extra cruiser
    // breaks off, so each star the player loses is actually felt.
    while (state.policeCars.length > wantCars) {
      let farthest = 0;
      let farD = -1;
      for (let i = 0; i < state.policeCars.length; i += 1) {
        const d = dist(state.policeCars[i].x, state.policeCars[i].y, p.x, p.y);
        if (d > farD) { farD = d; farthest = i; }
      }
      state.policeCars.splice(farthest, 1);
    }
    // Foot cops when the player is on foot and the heat is on.
    if (state.wanted >= POLICE.footCopsFrom && !p.car && state.spawnProtect <= 0 && state.footCops.length < 2 && state.policeSpawnTimer <= 0) {
      spawnFootCop();
      state.policeSpawnTimer = 4;
    }
    // Pursuit runs on the streets: cruisers drive the road grid and turn at
    // intersections toward the player (Manhattan pursuit), so they chase like traffic
    // instead of cutting through buildings and parks — and so a fast driver on a long
    // straight can actually outrun them and lose the heat.
    for (const cop of state.policeCars) {
      const target = p.car ? p.car : p;
      const dx = target.x - cop.x;
      const dy = target.y - cop.y;
      const wantSpeed = state.wanted > 0 ? POLICE.chaseSpeed : 0;
      cop.speed += clamp(wantSpeed - cop.speed, -400 * dt, 320 * dt);
      const lane = cop.dir > 0 ? 14 : -14;
      if (cop.axis === 'v') {
        cop.dir = dy >= 0 ? 1 : -1;
        cop.y += cop.dir * cop.speed * dt;
        cop.x += (cop.line + lane - cop.x) * Math.min(1, dt * 6);
        cop.angle = cop.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        // At an intersection, turn toward the player if they are far to the side.
        // Turning costs speed, like a real car — a driver who keeps a straight line
        // pulls away from a cruiser that has to turn.
        for (const cross of ROAD_Y) {
          if (Math.abs(cop.y - cross) < 24 && Math.abs(dx) > 90) {
            cop.axis = 'h';
            cop.line = cross;
            cop.dir = dx >= 0 ? 1 : -1;
            cop.y = cross + (cop.dir > 0 ? 14 : -14);
            cop.speed *= 0.55;
            break;
          }
        }
        // The streets end at the beach: turn back onto the last east-west road.
        if (cop.y > ROAD_Y[ROAD_Y.length - 1] + 40) {
          cop.axis = 'h';
          cop.line = ROAD_Y[ROAD_Y.length - 1];
          cop.dir = dx >= 0 ? 1 : -1;
          cop.y = ROAD_Y[ROAD_Y.length - 1] + 14;
        } else if (cop.y < ROAD_Y[0] - 40) {
          cop.axis = 'h';
          cop.line = ROAD_Y[0];
          cop.dir = dx >= 0 ? 1 : -1;
          cop.y = ROAD_Y[0] + 14;
        }
      } else {
        cop.dir = dx >= 0 ? 1 : -1;
        cop.x += cop.dir * cop.speed * dt;
        cop.y += (cop.line + lane - cop.y) * Math.min(1, dt * 6);
        cop.angle = cop.dir > 0 ? 0 : Math.PI;
        for (const cross of ROAD_X) {
          if (Math.abs(cop.x - cross) < 24 && Math.abs(dy) > 90) {
            cop.axis = 'v';
            cop.line = cross;
            cop.dir = dy >= 0 ? 1 : -1;
            cop.x = cross + (cop.dir > 0 ? 14 : -14);
            cop.speed *= 0.55;
            break;
          }
        }
        if (cop.x > ROAD_X[ROAD_X.length - 1] + 40) {
          cop.axis = 'v';
          cop.line = ROAD_X[ROAD_X.length - 1];
          cop.dir = dy >= 0 ? 1 : -1;
          cop.x = ROAD_X[ROAD_X.length - 1] + 14;
        } else if (cop.x < ROAD_X[0] - 40) {
          cop.axis = 'v';
          cop.line = ROAD_X[0];
          cop.dir = dy >= 0 ? 1 : -1;
          cop.x = ROAD_X[0] + 14;
        }
      }
      cop.x = clamp(cop.x, 30, WORLD.width - 30);
      cop.y = clamp(cop.y, 30, BEACH.waterTop - 30);
    }
    // Cops give up and drive off once the heat is gone — and a cruiser that has lost
    // sight of the player for a while gives up too, so losing the law is achievable.
    if (state.wanted === 0) {
      for (let i = state.policeCars.length - 1; i >= 0; i -= 1) {
        const cop = state.policeCars[i];
        if (dist(cop.x, cop.y, p.x, p.y) > 900) state.policeCars.splice(i, 1);
      }
      for (let i = state.footCops.length - 1; i >= 0; i -= 1) {
        const cop = state.footCops[i];
        if (dist(cop.x, cop.y, p.x, p.y) > 300) state.footCops.splice(i, 1);
      }
    } else {
      for (let i = state.policeCars.length - 1; i >= 0; i -= 1) {
        const cop = state.policeCars[i];
        if (dist(cop.x, cop.y, p.x, p.y) > POLICE.giveUpDistance) {
          cop.farTime += dt;
          if (cop.farTime > POLICE.giveUpSeconds) state.policeCars.splice(i, 1);
        } else {
          cop.farTime = 0;
        }
      }
    }
    // Foot cops chase and try to arrest.
    for (const cop of state.footCops) {
      const d = dist(cop.x, cop.y, p.x, p.y);
      if (p.car) {
        // The player drove off; the cop runs back to the street and gives up.
        cop.x += Math.cos(cop.angle) * cop.speed * dt;
        cop.y += Math.sin(cop.angle) * cop.speed * dt;
        if (d > 800) cop.arrest = -999;
        continue;
      }
      cop.angle = angleTo(cop.x, cop.y, p.x, p.y);
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
      resolveBuildingCollision(city, cop, 12);
      if (d < 28) {
        cop.arrest += dt;
        if (cop.arrest >= POLICE.arrestSeconds && p.invulnerable <= 0) {
          state.over = 'busted';
        }
      } else {
        cop.arrest = 0;
      }
    }
    state.footCops = state.footCops.filter((c) => c.arrest !== -999);
    // A police car ramming the player on foot hurts — but never during spawn protection.
    // The ram also bounces the cruiser back off, so it cannot sit on the player and
    // ram again the moment the brief invulnerability wears off.
    if (!p.car && p.invulnerable <= 0) {
      for (const cop of state.policeCars) {
        if (dist(cop.x, cop.y, p.x, p.y) < 34 && Math.abs(cop.speed) > 80) {
          hurtPlayer(POLICE.ramDamage);
          state.shake = Math.max(state.shake, 8);
          audio.crash();
          p.x += Math.cos(angleTo(cop.x, cop.y, p.x, p.y)) * 30;
          p.y += Math.sin(angleTo(cop.x, cop.y, p.x, p.y)) * 30;
          resolveBuildingCollision(city, p, PLAYER.radius);
          cop.speed = -120;
          cop.bump = 1.5;
        }
      }
    }
    // A cruiser must never rest on top of the on-foot player: it hides them, pins
    // them in place, and WASD barely moves them. Keep a minimum gap by pushing the
    // cruiser out; if the cruiser cannot give way (a building behind it), push the
    // player out instead.
    if (!p.car) {
      for (const cop of state.policeCars) {
        const d = dist(cop.x, cop.y, p.x, p.y);
        const minD = 42;
        if (d < minD && d > 0.01) {
          const nx = (cop.x - p.x) / d;
          const ny = (cop.y - p.y) / d;
          const ox = cop.x;
          const oy = cop.y;
          cop.x = p.x + nx * minD;
          cop.y = p.y + ny * minD;
          if (hitsBuilding(city, cop.x, cop.y, 18)) {
            cop.x = ox;
            cop.y = oy;
            p.x = cop.x - nx * minD;
            p.y = cop.y - ny * minD;
            resolveBuildingCollision(city, p, PLAYER.radius);
          }
        }
      }
    }
  }

  function stepEnemies(dt, audio) {
    const p = state.player;
    for (const e of state.enemies) {
      const d = dist(e.x, e.y, p.x, p.y);
      e.angle = angleTo(e.x, e.y, p.x, p.y);
      if (d > 60) {
        e.x += Math.cos(e.angle) * e.speed * dt;
        e.y += Math.sin(e.angle) * e.speed * dt;
        resolveBuildingCollision(city, e, 12);
      }
      e.shootCooldown -= dt;
      if (d < ENEMY.shootRange && e.shootCooldown <= 0 && !state.over) {
        e.shootCooldown = ENEMY.shootCooldown * (0.9 + random() * 0.4);
        const a = e.angle + (random() - 0.5) * 0.25;
        state.bullets.push({
          x: e.x + Math.cos(a) * 20, y: e.y + Math.sin(a) * 20,
          vx: Math.cos(a) * 700, vy: Math.sin(a) * 700,
          life: 0.9, fromPlayer: false, damage: ENEMY.damage,
        });
        audio.gunshot();
      }
    }
    for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
      const e = state.enemies[i];
      if (e.health <= 0) {
        addParticles(e.x, e.y, 16, '#ef476f', 200, 0.6);
        state.money += 25;
        showMessage('Rival down — +$25 off his pockets.', 2);
        state.enemies.splice(i, 1);
      } else if (dist(e.x, e.y, p.x, p.y) > 1200) {
        // The rival lost the trail and gave up.
        state.enemies.splice(i, 1);
      }
    }
  }

  function stepBullets(dt) {
    const p = state.player;
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const b = state.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let dead = b.life <= 0 || b.x < 0 || b.x > WORLD.width || b.y < 0 || b.y > WORLD.height;
      if (!dead && hitsBuilding(city, b.x, b.y, 2)) {
        addParticles(b.x, b.y, 4, '#ffd166', 120, 0.3);
        dead = true;
      }
      if (!dead) {
        for (const car of state.cars) {
          if (car.dead) continue;
          if (dist(b.x, b.y, car.x, car.y) < 26) {
            // An enemy bullet chips a car rather than shredding it: a getaway car
            // must survive the rivals shooting at it, or every hold-still grab
            // (the vault job) ends with the car in flames.
            damageCar(car, b.fromPlayer ? b.damage : 1, null);
            addParticles(b.x, b.y, 6, '#ffd166', 140, 0.3);
            dead = true;
            break;
          }
        }
      }
      if (!dead && b.fromPlayer) {
        for (const e of state.enemies) {
          if (dist(b.x, b.y, e.x, e.y) < 16) {
            e.health -= b.damage;
            addParticles(b.x, b.y, 6, '#ef476f', 140, 0.3);
            dead = true;
            break;
          }
        }
        if (!dead) {
          for (const ped of state.peds) {
            if (!ped.down && dist(b.x, b.y, ped.x, ped.y) < 14) {
              ped.down = 999;
              ped.panic = 3;
              addCrime(WANTED.killPed);
              showMessage('You shot a pedestrian! That\u2019s two stars.', 3);
              dead = true;
              break;
            }
          }
        }
      }
      if (!dead && !b.fromPlayer && p.invulnerable <= 0) {
        if (dist(b.x, b.y, p.x, p.y) < (p.car ? 26 : 14)) {
          if (p.car) damageCar(p.car, b.damage, null);
          else hurtPlayer(b.damage);
          if (!p.car) state.shake = Math.max(state.shake, 5);
          dead = true;
        }
      }
      if (dead) state.bullets.splice(i, 1);
    }
  }

  function stepParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const pt = state.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.98;
      pt.vy *= 0.98;
      pt.life -= dt;
      if (pt.life <= 0) state.particles.splice(i, 1);
    }
  }

  const helpers = {
    message: (text) => showMessage(text, 5),
    addWanted: (n) => addWanted(n),
    spawnEnemies: (list) => { for (const e of list) spawnEnemy(e.x, e.y); },
    spawnTargetCar: (x, y) => {
      const car = spawnParkedCar(x, y, 0, '#f2b134');
      car.kind = 'target';
      state.targetCar = car;
    },
    clearTargetCar: () => { state.targetCar = null; },
  };

  /**
   * One fixed step. `ctl` is the frame's controls (move vector, driving keys, aim, fire,
   * interact). With `harmless` set (the title screen's backdrop) the city lives but nothing
   * touches the player and nothing scores.
   */
  function step(dt, ctl, audio, harmless) {
    let events = 0;
    state.time += dt;
    if (state.crimeCooldown > 0) state.crimeCooldown -= dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 26);
    for (const car of state.cars) if (car.bump > 0) car.bump -= dt;
    for (const cop of state.policeCars) if (cop.bump > 0) cop.bump -= dt;
    if (state.player.invulnerable > 0) state.player.invulnerable = Math.max(0, state.player.invulnerable - dt);
    if (state.spawnProtect > 0) state.spawnProtect = Math.max(0, state.spawnProtect - dt);

    stepTraffic(dt);
    stepPeds(dt);
    stepParticles(dt);
    if (harmless) {
      const p = state.player;
      state.camera.x += (p.x - state.camera.x) * Math.min(1, dt * 3);
      state.camera.y += (p.y - state.camera.y) * Math.min(1, dt * 3);
      clampCamera();
      return 0;
    }

    if (state.player.car) stepDriving(dt, ctl, audio);
    else stepPlayerOnFoot(dt, ctl, audio);
    stepPolice(dt, audio);
    stepEnemies(dt, audio);
    stepBullets(dt);

    // Quiet spell on foot: health creeps back, so a long chase rarely ends in a
    // cheap death from a dozen small hits.
    if (!state.player.car && state.player.health > 0 && state.player.health < PLAYER.health &&
        state.time - state.lastHurt > 8) {
      state.player.health = Math.min(PLAYER.health, state.player.health + 3 * dt);
    }

    // Clean up dead cars and keep traffic topped up.
    for (let i = state.cars.length - 1; i >= 0; i -= 1) {
      if (state.cars[i].dead) state.cars.splice(i, 1);
    }
    state.trafficSpawnTimer -= dt;
    if (state.trafficSpawnTimer <= 0) {
      state.trafficSpawnTimer = 3;
      const trafficCount = state.cars.filter((c) => c.kind === 'traffic').length;
      if (trafficCount < TRAFFIC.count) spawnTrafficCar();
      if (state.cars.filter((c) => c.kind === 'parked').length < PARKED.count) {
        const road = ROAD_X[Math.floor(random() * ROAD_X.length)];
        spawnParkedCar(road + (random() < 0.5 ? 70 : -70), 100 + random() * 2000, random() < 0.5 ? 0 : Math.PI / 2);
      }
    }
    // Pistol pickup respawns after a minute.
    for (const pickup of state.pickups) {
      if (pickup.taken) {
        pickup.respawn -= dt;
        if (pickup.respawn <= 0) pickup.taken = false;
      }
    }

    // Wanted decay: hide or outrun the law and the heat fades, one star at a time.
    // The bar is "no cop close", not "no cop on the map" — a cruiser 400 px away is
    // not a threat, and the player hears each star fade.
    if (state.wanted > 0) {
      const nearestCop = Math.min(
        ...state.policeCars.map((c) => dist(c.x, c.y, state.player.x, state.player.y)),
        ...state.footCops.map((c) => dist(c.x, c.y, state.player.x, state.player.y)),
        Infinity,
      );
      if (nearestCop > WANTED.clearDistance) {
        state.wantedTimer += dt;
        if (state.wantedTimer >= WANTED.decaySeconds) {
          state.wanted -= 1;
          state.wantedTimer = 0;
          if (audio && audio.starDown) audio.starDown();
          if (state.wanted === 0) showMessage('You lost them. The heat is off — for now.', 3);
        }
      } else {
        // A cop closing in slows the fade but never erases it: with three cruisers
        // taking turns, a full reset would make five stars effectively permanent.
        state.wantedTimer = Math.max(0, state.wantedTimer - dt * 0.5);
      }
    }

    // Missions.
    const missionEvent = missions.update(state, dt, helpers);
    if (missionEvent === 'step') events |= EVENT_STEP;
    else if (missionEvent === 'complete') {
      const def = missions.lastCompleted;
      if (def) {
        state.money += def.reward;
        if (!state.done.includes(def.id)) state.done.push(def.id);
        showMessage(`Job done: ${def.name} — +$${def.reward}`, 5);
      }
      // Marla's garage patches up your ride as part of the payout, so the next
      // job never starts in a wreck: a battered coupe must not doom the finale.
      if (state.player.car) {
        state.player.car.health = CAR.health;
        state.player.car.smoke = 0;
      }
      events |= EVENT_MISSION_COMPLETE;
    } else if (missionEvent === 'fail') {
      events |= EVENT_MISSION_FAIL;
    }

    // Player death / arrest ends the run.
    if (state.player.health <= 0 && !state.over) state.over = 'wasted';
    if (state.over === 'wasted') events |= EVENT_WASTED;
    else if (state.over === 'busted') events |= EVENT_BUSTED;

    // Camera follows the player smoothly; shake adds a kick on impacts. The view is
    // clamped inside the world so the camera never shows the void past the map edge.
    const p = state.player;
    state.camera.x += (p.x - state.camera.x) * Math.min(1, dt * 4);
    state.camera.y += (p.y - state.camera.y) * Math.min(1, dt * 4);
    clampCamera();

    // Audio beds.
    if (audio) {
      audio.engine(p.car ? Math.abs(p.car.speed) / CAR.maxSpeed : 0, !!p.car);
      const sirenOn = state.policeCars.some((c) => dist(c.x, c.y, p.x, p.y) < 800);
      audio.siren(sirenOn, state.time);
    }
    return events;
  }

  function clampCamera() {
    state.camera.x = clamp(state.camera.x, 640, WORLD.width - 640);
    state.camera.y = clamp(state.camera.y, 360, WORLD.height - 360);
  }

  /** Money earned in this run, on top of the saved total. */
  function addMoney(amount) {
    state.money += amount;
  }

  /**
   * Stage a screenshot scene: put the world in a fixed, readable state for ?shot=.
   * The caller then steps the world a short while so traffic and particles settle.
   */
  function stageScene(name) {
    reset();
    const p = state.player;
    p.invulnerable = 0;
    state.spawnProtect = 0;
    if (name === 'chase') {
      // Mid-chase: driving fast down Bayview Row, three stars, two cruisers closing in.
      const car = spawnParkedCar(1800, 1200, Math.PI / 2, '#d64545');
      car.kind = 'player';
      p.car = car;
      car.speed = 430;
      p.x = car.x;
      p.y = car.y;
      state.wanted = 3;
      const cop1 = makeCar(1800, 900, Math.PI / 2, PALETTE.copCar, 'police');
      cop1.speed = 480;
      cop1.axis = 'v'; cop1.line = 1800; cop1.dir = 1;
      const cop2 = makeCar(1800, 780, Math.PI / 2, PALETTE.copCar, 'police');
      cop2.speed = 460;
      cop2.axis = 'v'; cop2.line = 1800; cop2.dir = 1;
      state.policeCars.push(cop1, cop2);
      missions.start(MISSION_DEFS[1], helpers);
      state.message = { text: 'Deliver to the Salt Air bar on the beach', until: 9999 };
      state.camera.x = car.x;
      state.camera.y = car.y;
    } else if (name === 'mission') {
      // Rico's pickup: the player on foot, rivals closing in, the marker ahead.
      p.x = 880;
      p.y = 1680;
      p.angle = Math.PI / 4;
      p.hasPistol = true;
      p.ammo = 9;
      spawnEnemy(1060, 1740);
      spawnEnemy(940, 1880);
      missions.start(MISSION_DEFS[2], helpers);
      state.message = { text: 'Pick up Rico — two of his rivals are waiting there', until: 9999 };
      state.camera.x = p.x;
      state.camera.y = p.y;
    } else if (name === 'police') {
      // Cornered on foot at four stars: cruisers and foot cops closing in.
      p.x = 1400;
      p.y = 1400;
      p.hasPistol = true;
      p.ammo = 6;
      state.wanted = 4;
      const cop1 = makeCar(1400, 1120, Math.PI / 2, PALETTE.copCar, 'police');
      cop1.speed = 300;
      cop1.axis = 'v'; cop1.line = 1400; cop1.dir = 1;
      const cop2 = makeCar(1620, 1400, Math.PI, PALETTE.copCar, 'police');
      cop2.speed = 300;
      cop2.axis = 'h'; cop2.line = 1400; cop2.dir = -1;
      state.policeCars.push(cop1, cop2);
      state.footCops.push({ x: 1330, y: 1480, angle: 0, speed: 215, arrest: 0 });
      state.footCops.push({ x: 1480, y: 1330, angle: 0, speed: 215, arrest: 0 });
      state.message = { text: 'Four stars — the whole Bay PD is on you', until: 9999 };
      state.camera.x = p.x;
      state.camera.y = p.y;
    } else {
      // 'city': a busy intersection on foot — streets, buildings, traffic and
      // pedestrians in frame, the player clearly visible in the middle of it.
      p.x = 1400;
      p.y = 1400;
      p.angle = -Math.PI / 2;
      state.camera.x = p.x;
      state.camera.y = p.y;
      state.message = { text: 'Neon Bay — explore the city, steal a car, take a job', until: 9999 };
    }
  }

  reset();
  return { state, reset, step, missions, addMoney, addWanted, stageScene, showMessage, missionHelpers: helpers };
}

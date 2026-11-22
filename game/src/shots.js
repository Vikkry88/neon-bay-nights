// Screenshot staging: ?shot=cover|wheel|mission|police&seed=1 places the
// player, police, helicopter, traffic and HUD state explicitly so each of the
// four screenshots is deterministic. In shot mode the world is frozen (only
// render-time animation runs), so the frame cannot drift before capture.

import { makeCar } from './world.js';
import { JOBS } from './missions.js';
import { districtAt } from './config.js';
import { nearestRoadPoint } from './city.js';

// Road centre lines (block 420, road 96): 48, 468, 888, 1308, 1728, 2148, 2568, 2988.
// All staged positions sit on these lines (lane offset ±24) so cars are on roads.

export function shotNameFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return params.get('shot');
}

export function seedFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const seed = Number(params.get('seed'));
  return Number.isFinite(seed) && seed > 0 ? seed : 1;
}

function policeCar(x, y, angle) {
  const car = makeCar(x, y, angle, '#f5f6fa', 'police');
  car.sirenPhase = Math.random() * 6;
  return car;
}

function trafficCar(x, y, angle, color) {
  const car = makeCar(x, y, angle, color, 'traffic');
  car.speed = 120;
  car.cruise = 120;
  return car;
}

function stageCommon(state, x, y, angle) {
  state.mode = 'play';
  state.player.x = x;
  state.player.y = y;
  state.player.angle = angle;
  state.player.health = 100;
  state.player.armor = 60;
  state.player.protect = 0;
  state.district = districtAt(x, y);
  state.hintTime = 0;
  state.camera.x = x;
  state.camera.y = y;
  state.camera.shake = 0;
}

function giveAllWeapons(state) {
  state.save.weapons = ['fists', 'pistol', 'smg', 'shotgun'];
  state.save.ammo = { pistol: 84, smg: 160, shotgun: 24 };
}

function setJob(state, index, stageIndex, timeLeft) {
  const job = JOBS[index];
  state.job = job;
  state.stageIndex = stageIndex;
  state.stageLabel = job.stages[stageIndex].label;
  const at = job.stages[stageIndex].at;
  state.missionMarker = nearestRoadPoint(at[0], at[1]);
  state.missionTime = timeLeft;
  state.storyDone = false;
}

export function applyShot(state, shot) {
  giveAllWeapons(state);
  state.save.money = 7250;
  state.save.respect = { downtown: 45, beachfront: 60, oldtown: 25, marina: 35 };
  state.save.radio = 'neonfm';
  state.save.jobsDone = 4;

  if (shot === 'cover') {
    // Mid-chase at speed on the y=888 boulevard: player car flying east,
    // police on the bumper, helicopter overhead, dense traffic, full HUD.
    const x = 1728;
    const y = 888;
    stageCommon(state, x, y, 0);
    const car = makeCar(x, y, 0, '#e63946', 'player');
    car.speed = 460;
    state.player.inCar = true;
    state.player.car = car;
    state.player.carSpeedKmh = 168;
    state.wanted = 4;
    state.bannerTime = 3;
    state.police = [
      policeCar(x - 95, y - 24, 0),
      policeCar(x - 125, y + 24, 0),
      policeCar(x - 180, y - 6, 0),
      policeCar(x - 230, y + 24, 0),
    ];
    state.heli = { active: true, x: x + 70, y: y - 200, angle: 0.4, spotX: x + 10, spotY: y - 8 };
    state.traffic = [
      trafficCar(x + 240, y + 24, 0, '#2a9d8f'),
      trafficCar(x + 330, y - 24, Math.PI, '#e9c46a'),
      trafficCar(x - 320, y + 24, 0, '#a8dadc'),
      trafficCar(x + 24, y + 310, -Math.PI / 2, '#f4a261'),
      trafficCar(x - 24, y - 310, Math.PI / 2, '#ff70a6'),
      trafficCar(x + 430, y + 24, 0, '#ffffff'),
    ];
    state.peds = state.peds.slice(0, 6).map((ped, i) => ({ ...ped, x: x - 260 + i * 90, y: y + 68, angle: 0.4 }));
    setJob(state, 4, 1, 118);
    state.dialogue = JOBS[4].brief;
    state.dialogueTime = 99;
    state.weaponIndex = 1;
  } else if (shot === 'wheel') {
    // On foot at the 1728/1308 intersection, weapon wheel open, police
    // closing in on three sides, helicopter above with spotlight on player.
    const x = 1728;
    const y = 1308;
    stageCommon(state, x, y, -0.6);
    state.player.inCar = false;
    state.player.car = null;
    state.player.carSpeedKmh = 0;
    state.wanted = 3;
    state.bannerTime = 3;
    state.police = [
      policeCar(x - 215, y + 24, 0.1),
      policeCar(x + 235, y - 24, Math.PI - 0.2),
      policeCar(x + 24, y + 255, -Math.PI / 2),
    ];
    state.heli = { active: true, x: x - 50, y: y - 235, angle: 0.9, spotX: x, spotY: y };
    state.traffic = [
      trafficCar(x - 330, y - 24, 0, '#2a9d8f'),
      trafficCar(x + 345, y + 24, Math.PI, '#e63946'),
      trafficCar(x - 24, y - 335, Math.PI / 2, '#ffd670'),
    ];
    state.peds = state.peds.slice(0, 5).map((ped, i) => ({ ...ped, x: x - 180 + i * 80, y: y + 72, angle: 2.6 }));
    setJob(state, 6, 0, 174);
    state.dialogue = JOBS[6].brief;
    state.dialogueTime = 99;
    state.weaponIndex = 2;
    state.wheelOpen = true;
  } else if (shot === 'mission') {
    // Mission in progress on the Beachfront boulevard (x=2568): marker +
    // arrow + timer + district respect + radio visible, dense traffic/peds.
    const x = 2568;
    const y = 888;
    stageCommon(state, x, y, 0);
    const car = makeCar(x, y, 0, '#2a9d8f', 'player');
    car.speed = 210;
    state.player.inCar = true;
    state.player.car = car;
    state.player.carSpeedKmh = 76;
    state.wanted = 1;
    state.bannerTime = 0;
    state.police = [policeCar(x - 390, y + 24, 0)];
    state.heli = { active: false, x: 0, y: 0, angle: 0, spotX: 0, spotY: 0 };
    state.traffic = [
      trafficCar(x + 210, y + 24, 0, '#e63946'),
      trafficCar(x + 340, y - 24, Math.PI, '#f1fa8c'),
      trafficCar(x - 250, y + 24, 0, '#70d6ff'),
      trafficCar(x + 24, y + 310, -Math.PI / 2, '#ffffff'),
      trafficCar(x - 24, y - 310, Math.PI / 2, '#ff70a6'),
      trafficCar(x + 24, y + 470, -Math.PI / 2, '#e9c46a'),
      trafficCar(x - 440, y - 24, Math.PI, '#a8dadc'),
    ];
    state.peds = state.peds.slice(0, 8).map((ped, i) => ({ ...ped, x: x - 300 + i * 85, y: y + 68, angle: 0.2 }));
    setJob(state, 1, 1, 96);
    state.dialogue = JOBS[1].brief;
    state.dialogueTime = 99;
    state.weaponIndex = 1;
  } else if (shot === 'police') {
    // Maximum Response on the y=2988 road: roadblock ahead, interceptors
    // behind, helicopter up, player breaking west for the garage ring.
    const x = 888;
    const y = 2988;
    stageCommon(state, x, y, Math.PI);
    const car = makeCar(x, y, Math.PI, '#e63946', 'player');
    car.speed = 300;
    state.player.inCar = true;
    state.player.car = car;
    state.player.carSpeedKmh = 110;
    state.wanted = 5;
    state.bannerTime = 3;
    state.police = [
      policeCar(x + 120, y - 24, Math.PI),
      policeCar(x + 170, y + 24, Math.PI),
      policeCar(x - 190, y - 24, Math.PI / 2),
      policeCar(x - 190, y + 24, Math.PI / 2),
      policeCar(x + 60, y - 24, Math.PI),
    ];
    state.heli = { active: true, x: x + 90, y: y - 210, angle: 1.4, spotX: x, spotY: y };
    state.traffic = [
      trafficCar(x + 330, y + 24, Math.PI, '#2a9d8f'),
      trafficCar(x - 330, y - 24, 0, '#ffd670'),
      trafficCar(x + 24, y - 310, Math.PI / 2, '#ffffff'),
    ];
    state.peds = state.peds.slice(0, 4).map((ped, i) => ({ ...ped, x: x - 200 + i * 110, y: y + 68, angle: 2.2 }));
    setJob(state, 5, 1, 141);
    state.dialogue = JOBS[5].brief;
    state.dialogueTime = 99;
    state.weaponIndex = 3;
  }

  state.shot = shot;
  state.frozen = true;
  return state;
}

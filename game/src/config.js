// Every tuning number and colour for Neon Bay Nights, in one place. The world is a fixed
// 3600x3000 logical area; the renderer scales a 1280x720 camera view of it to the window,
// so no rule below depends on the screen size.

export const STEP = 1 / 60;

export const WORLD = { width: 3600, height: 3000 };

/** Roads run on a 400 px grid; ROAD_HALF is half the road width (48 px each side). */
export const ROAD_SPACING = 400;
export const ROAD_HALF = 48;
export const ROAD_X = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000, 3400];
export const ROAD_Y = [200, 600, 1000, 1400, 1800, 2200];

/** The beach strip along the south edge: sand, then water. */
export const BEACH = { sandTop: 2360, waterTop: 2520 };

/** Safe spawn: the middle of Coral Park, away from roads, traffic and enemies. */
export const SPAWN = { x: 1600, y: 1200 };

export const PLAYER = {
  radius: 13,
  walkSpeed: 230,
  runSpeed: 300,
  health: 100,
  /** Seconds of invulnerability after spawning or respawning. */
  spawnProtect: 3,
  punchDamage: 25,
  punchRange: 34,
  punchCooldown: 0.35,
};

export const PISTOL = { ammo: 12, damage: 34, bulletSpeed: 900, fireCooldown: 0.28, range: 520 };

export const CAR = {
  length: 52,
  width: 26,
  accel: 430,
  brake: 720,
  reverseAccel: 280,
  maxSpeed: 570,
  maxReverse: 190,
  turnRate: 3.2,
  grip: 3.2,
  health: 240,
};

export const TRAFFIC = { count: 14, speed: 170, minGap: 90 };
export const PARKED = { count: 7 };
export const PEDS = { count: 26, speed: 55 };

export const WANTED = {
  max: 5,
  stealCar: 1,
  hitPed: 1,
  shoot: 1,
  killPed: 2,
  /** Seconds with no cop within WANTED.clearDistance before one star fades. */
  decaySeconds: 3,
  /** A cop farther away than this counts as "lost" for the decay timer. */
  clearDistance: 350,
};

export const POLICE = {
  /** How many police cars may chase at once, per wanted star. */
  carsPerStar: 1,
  maxCars: 3,
  chaseSpeed: 400,
  ramDamage: 8,
  /** Foot cops appear once the wanted level reaches this. */
  footCopsFrom: 2,
  arrestSeconds: 1.2,
  /** A cruiser this far away for this long gives up and leaves. */
  giveUpDistance: 700,
  giveUpSeconds: 3,
};

export const ENEMY = { health: 50, speed: 170, damage: 5, shootRange: 380, shootCooldown: 1.8 };

export const SAVE_KEY = 'neon-bay-nights.save.v1';
export const BEST_KEY = 'neon-bay-nights.best.v1';

export const PALETTE = {
  backdrop: '#101623',
  grass: '#7fb069',
  grassDark: '#6da25c',
  sand: '#e8cf9a',
  water: '#2fa8c9',
  waterDeep: '#1f7fa8',
  road: '#3c414d',
  roadLine: '#e8d44d',
  sidewalk: '#9aa0a8',
  park: '#79b264',
  building: ['#e07856', '#e8a87c', '#7fb8a4', '#8fa8d8', '#c98bb8', '#e8c87c', '#a8c686'],
  buildingRoof: ['#c96a4e', '#d89a6c', '#6fa894', '#7f98c8', '#b97ba8', '#d8b86c', '#98b676'],
  palm: '#3f8f4f',
  player: '#ffd166',
  playerShirt: '#ef476f',
  cop: '#2b6cb0',
  copCar: '#2b6cb0',
  trafficCar: ['#d64545', '#45a8d6', '#e8e8e8', '#f2b134', '#7c5cd6', '#5cd68a', '#d6d6d6'],
  text: '#f4f1e8',
  muted: '#b9c0cc',
  gold: '#ffd166',
  red: '#ef476f',
  blue: '#4cc9f0',
  panel: 'rgba(16, 22, 35, 0.92)',
  panelBorder: '#ffd166',
  marker: '#ffd166',
  health: '#06d6a0',
  wanted: '#ef476f',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

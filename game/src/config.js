// Neon Bay Nights — shared constants: world size, districts, dispatch tiers,
// weapons, radio stations and tuning values used across every module.

export const WORLD = { width: 3400, height: 3400, block: 420, road: 96 };
export const SEA_X = 2960;          // sea starts here (east edge)
export const BEACH_X = 2780;        // sand strip before the water
export const SAVE_KEY = 'neon-bay-nights-v7';

export const DISTRICTS = [
  { id: 'downtown',  name: 'Downtown',  color: '#ffd166' },
  { id: 'beachfront', name: 'Beachfront', color: '#06d6a0' },
  { id: 'oldtown',   name: 'Old Town',  color: '#ef476f' },
  { id: 'marina',    name: 'Marina',    color: '#4cc9f0' },
];

// District by world position: east = Beachfront, south-east = Marina,
// west = Old Town, centre/north = Downtown.
export function districtAt(x, y) {
  if (x > 2300 && y > 2100) return DISTRICTS[3];       // Marina
  if (x > 2300) return DISTRICTS[1];                   // Beachfront
  if (x < 1150) return DISTRICTS[2];                   // Old Town
  return DISTRICTS[0];                                 // Downtown
}

export const DISPATCH_TIERS = [
  { stars: 0, name: 'Clear',            units: 0, speed: 0 },
  { stars: 1, name: 'Patrol',           units: 1, speed: 250 },
  { stars: 2, name: 'Interceptor',      units: 2, speed: 300 },
  { stars: 3, name: 'Roadblock',        units: 3, speed: 330 },
  { stars: 4, name: 'Air Support',      units: 4, speed: 360 },
  { stars: 5, name: 'Maximum Response', units: 6, speed: 395 },
];

export const WEAPONS = [
  { id: 'fists',   name: 'Fists',   damage: 8,  fireRate: 0.35, range: 46,  spread: 0,    pellets: 1, tracer: null },
  { id: 'pistol',  name: 'Pistol',  damage: 22, fireRate: 0.22, range: 520, spread: 0.02, pellets: 1, tracer: '#ffe66d' },
  { id: 'smg',     name: 'SMG',     damage: 14, fireRate: 0.08, range: 480, spread: 0.07, pellets: 1, tracer: '#ffd166' },
  { id: 'shotgun', name: 'Shotgun', damage: 12, fireRate: 0.7,  range: 300, spread: 0.16, pellets: 6, tracer: '#ff9f1c' },
];

export const RADIO_STATIONS = [
  { id: 'neonfm',  name: 'Neon FM',  tempo: 112, root: 110.0, mode: [0, 3, 5, 7, 10] },
  { id: 'baytalk', name: 'Bay Talk', tempo: 84,  root: 98.0,  mode: [0, 2, 4, 7, 9] },
  { id: 'off',     name: 'Radio Off', tempo: 0,  root: 0,     mode: [] },
];

export const TUNING = {
  playerWalkSpeed: 210,
  playerSprintSpeed: 320,
  playerRadius: 13,
  carRadius: 22,
  carAccel: 340,
  carBrake: 420,
  carMaxSpeed: 520,          // px/s ≈ 187 km/h on the gauge
  carReverseMax: 150,
  policeStandoff: 72,        // px — police never close inside this ring
  policeRamCooldown: 1.6,    // s between gentle rams
  spawnProtectSeconds: 4,
  garage: { x: 468, y: 2988, radius: 64 },
  safeSpawn: { x: 1050, y: 1050 },
  trafficCount: 26,
  pedCount: 34,
  parkedCount: 18,
};

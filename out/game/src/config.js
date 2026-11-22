// Neon Bay Nights — shared constants: world size, colours, weapons, dispatch tiers.

export const WORLD = { w: 3200, h: 2400, block: 200, road: 56 };
export const VIEW = { w: 1280, h: 720 };
export const SAVE_KEY = 'neon-bay-nights-save-v7';

export const COLORS = {
  sea: '#1d6fb8', sand: '#ecd9a0', grass: '#4d9e57', park: '#3e8f4c',
  road: '#3a3f4a', roadLine: '#e8e4c8', sidewalk: '#8d93a3',
  building: ['#7a5c8f', '#5c7a8f', '#8f7a5c', '#6b8f5c', '#8f5c6b', '#5c8f83'],
  roof: '#2e3444', neon: ['#ff5da2', '#37e0ff', '#ffd23f', '#7dff6a', '#c77dff'],
};

export const DISTRICTS = [
  { id: 'downtown', name: 'Downtown', test: (x, y) => x > 1200 && y < 1200 },
  { id: 'beachfront', name: 'Beachfront', test: (x, y) => y >= 1900 },
  { id: 'oldtown', name: 'Old Town', test: (x, y) => x <= 1200 && y < 1200 },
  { id: 'marina', name: 'Marina', test: (x, y) => x > 2400 },
];

export function districtAt(x, y) {
  for (const d of DISTRICTS) if (d.test(x, y)) return d;
  return DISTRICTS[2];
}

export const WEAPONS = [
  { id: 'fists', name: 'Fists', damage: 8, rate: 0.35, speed: 0, spread: 0, pellets: 1, infinite: true },
  { id: 'pistol', name: 'Pistol', damage: 22, rate: 0.28, speed: 720, spread: 0.03, pellets: 1 },
  { id: 'smg', name: 'SMG', damage: 12, rate: 0.09, speed: 760, spread: 0.09, pellets: 1 },
  { id: 'shotgun', name: 'Shotgun', damage: 9, rate: 0.8, speed: 640, spread: 0.16, pellets: 6 },
];

export const DISPATCH = [
  { stars: 0, name: 'All Clear', units: 0, speed: 0 },
  { stars: 1, name: 'Patrol', units: 1, speed: 235 },
  { stars: 2, name: 'Interceptor', units: 2, speed: 275 },
  { stars: 3, name: 'Roadblock', units: 3, speed: 300 },
  { stars: 4, name: 'Air Support', units: 4, speed: 325 },
  { stars: 5, name: 'Maximum Response', units: 6, speed: 350 },
];

export const RADIO = [
  { id: 'neon', name: 'Neon FM', bpm: 112, scale: [0, 3, 5, 7, 10] },
  { id: 'talk', name: 'Bay Talk', bpm: 84, scale: [0, 2, 4, 7, 9] },
  { id: 'off', name: 'Radio Off', bpm: 0, scale: [] },
];

export function mulberry(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const angleTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

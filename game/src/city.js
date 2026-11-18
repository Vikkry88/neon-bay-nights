// Neon Bay Nights — city.js
// One job: the map of Neon Bay — street grid, buildings, parks, beach,
// traffic lights and the named places, plus collision helpers.
(function () {
  'use strict';

  const NBN = window.NBN;
  const CFG = NBN.CFG;
  const PAL = NBN.PALETTE;

  // Streets run on a 400px grid; each street is 96px wide. A "block" is the
  // 304px square between streets. Beach occupies the east edge.
  const GRID = CFG.GRID;
  const HALF_STREET = CFG.STREET / 2;
  const WORLD = CFG.WORLD;

  // Which blocks are parks (col, row) — the spawn park is the safe one.
  const PARKS = new Set(['1,2', '5,5', '2,6']);
  const PLAZA = new Set(['3,3']); // downtown plaza, open ground

  const buildings = []; // {x,y,w,h,roof,wall,neon,sign}
  const trees = []; // {x,y,r}
  const lights = []; // traffic lights {x,y,phase}
  const lamps = []; // street lamps {x,y}

  function blockAt(cx, cy) {
    return { x0: cx * GRID + HALF_STREET, y0: cy * GRID + HALF_STREET, x1: (cx + 1) * GRID - HALF_STREET, y1: (cy + 1) * GRID - HALF_STREET };
  }

  function onRoad(x, y) {
    if (x < 0 || y < 0 || x > WORLD || y > WORLD) return false;
    const mx = x % GRID;
    const my = y % GRID;
    return mx < CFG.STREET || mx > GRID - CFG.STREET || my < CFG.STREET || my > GRID - CFG.STREET || x >= CFG.BEACH_X;
  }

  function inWater(x, y) {
    return x >= CFG.WATER_X;
  }

  function buildCity() {
    const rng = NBN.rng;
    const cols = Math.floor(WORLD / GRID);
    for (let cx = 0; cx < cols; cx++) {
      for (let cy = 0; cy < cols; cy++) {
        const b = blockAt(cx, cy);
        if (b.x1 > CFG.BEACH_X) continue; // beach blocks stay open sand
        const key = `${cx},${cy}`;
        if (PARKS.has(key)) {
          // Park: trees and paths, no buildings.
          const n = 7 + Math.floor(rng() * 5);
          for (let i = 0; i < n; i++) {
            trees.push({ x: b.x0 + 20 + rng() * (b.x1 - b.x0 - 40), y: b.y0 + 20 + rng() * (b.y1 - b.y0 - 40), r: 12 + rng() * 8 });
          }
          continue;
        }
        if (PLAZA.has(key)) {
          for (let i = 0; i < 4; i++) trees.push({ x: b.x0 + 40 + i * 70, y: b.y0 + 40, r: 12 });
          continue;
        }
        // One or two buildings per block, with a gap between them.
        const split = rng() < 0.55;
        const bw = b.x1 - b.x0;
        const bh = b.y1 - b.y0;
        const mk = (x0, y0, x1, y1) => {
          const roof = NBN.pick(PAL.buildingRoof);
          const wall = NBN.pick(PAL.buildingWall);
          const neon = rng() < 0.6 ? NBN.pick(PAL.neon) : null;
          buildings.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, roof, wall, neon, sign: rng() < 0.4 });
        };
        if (split) {
          const cut = b.x0 + bw * (0.42 + rng() * 0.16);
          mk(b.x0 + 8, b.y0 + 8, cut - 8, b.y1 - 8);
          mk(cut + 8, b.y0 + 8, b.x1 - 8, b.y1 - 8);
        } else {
          mk(b.x0 + 10, b.y0 + 10, b.x1 - 10, b.y1 - 10);
        }
      }
    }
    // Traffic lights at every other intersection, offset phases.
    for (let cx = 1; cx < cols; cx++) {
      for (let cy = 1; cy < cols; cy++) {
        if ((cx + cy) % 2 === 0) lights.push({ x: cx * GRID, y: cy * GRID, phase: (cx * 7 + cy * 3) % 6 });
      }
    }
    // Street lamps along the beach boardwalk.
    for (let y = 200; y < WORLD; y += 300) lamps.push({ x: CFG.BEACH_X - 30, y });
    // A few palm trees on the sand.
    for (let i = 0; i < 26; i++) {
      trees.push({ x: CFG.BEACH_X + 40 + NBN.rng() * 120, y: 120 + NBN.rng() * (WORLD - 240), r: 11 });
    }
  }

  // Circle vs building AABBs. Returns the first building hit, or null.
  function hitBuilding(x, y, r) {
    for (const b of buildings) {
      const nx = NBN.clamp(x, b.x, b.x + b.w);
      const ny = NBN.clamp(y, b.y, b.y + b.h);
      const dx = x - nx;
      const dy = y - ny;
      if (dx * dx + dy * dy < r * r) return b;
    }
    return null;
  }

  // Move a circle with axis separation so it SLIDES along walls and corners
  // instead of wedging: try x, then y, keeping each axis that stays clear.
  function moveCircle(e, dx, dy, r) {
    const nx = e.x + dx;
    if (!hitBuilding(nx, e.y, r) && !inWater(nx, e.y) && nx > r && nx < WORLD - r) e.x = nx;
    const ny = e.y + dy;
    if (!hitBuilding(e.x, ny, r) && !inWater(e.x, ny) && ny > r && ny < WORLD - r) e.y = ny;
  }

  // Is a point clear of buildings (for spawning cars/peds)?
  function clearOfBuildings(x, y, r) {
    return !hitBuilding(x, y, r) && !inWater(x, y) && x > r && x < WORLD - r && y > r && y < WORLD - r;
  }

  // Nearest point on a road to (x, y): snaps to the closest street center line.
  function nearestRoadPoint(x, y) {
    const snap = (v) => {
      const m = ((v % GRID) + GRID) % GRID;
      if (m < HALF_STREET) return v - m + HALF_STREET / 2;
      if (m > GRID - HALF_STREET) return v - m + GRID - HALF_STREET / 2;
      // Inside a block: go to the nearest street edge line.
      return m < GRID / 2 ? v - m + HALF_STREET / 2 : v - m + GRID - HALF_STREET / 2;
    };
    return { x: NBN.clamp(snap(x), 60, WORLD - 60), y: NBN.clamp(snap(y), 60, WORLD - 60) };
  }

  // Traffic light state at an intersection: true = green for east-west.
  // Short 6s cycle (3s each way) so no one waits long at a red light.
  function lightGreen(light, t) {
    const cycle = 6;
    const phase = (t + light.phase) % cycle;
    return phase < 3;
  }

  NBN.city = {
    buildings,
    trees,
    lights,
    lamps,
    buildCity,
    onRoad,
    inWater,
    hitBuilding,
    moveCircle,
    clearOfBuildings,
    nearestRoadPoint,
    lightGreen,
  };
})();

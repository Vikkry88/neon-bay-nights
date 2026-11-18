// Neon Bay Nights — config.js
// One job: every number the rest of the game shares, in one place.
// Round 3 tuning: police rams are rare and gentle, steering works at
// walking pace, traffic can never jam an intersection for long.
(function () {
  'use strict';

  const NBN = (window.NBN = window.NBN || {});

  NBN.CFG = {
    // World: a 3200 x 3200 coastal city. Streets on a 400px grid, 96px wide.
    WORLD: 3200,
    GRID: 400,
    STREET: 96,
    BEACH_X: 2920, // sand starts here
    WATER_X: 3100, // water starts here
    // Player on foot
    WALK_SPEED: 190,
    SPRINT_MULT: 1.55,
    PLAYER_RADIUS: 14,
    PLAYER_HEALTH: 100,
    // Cars — steering stays strong at low speed so a 90-degree turn at
    // 5-8 mph takes about a second of steering, not dozens of key taps.
    CAR_LENGTH: 46,
    CAR_WIDTH: 24,
    CAR_ACCEL: 520,
    CAR_MAX_SPEED: 460,
    CAR_REVERSE_MAX: 150,
    CAR_TURN: 3.4,
    CAR_TURN_FLOOR: 0.6, // turn rate never drops below 60% of full
    STEAL_RADIUS: 120,
    ENTER_COOLDOWN: 0.6, // seconds after stealing/exiting before E works again
    TRAFFIC_MAX: 28, // traffic cars alive at once
    TRAFFIC_TOPUP: 1.5, // per-second chance to replace a missing traffic car
    PARKED_CARS: 14,
    // Police rams — the round-2 grind fix. A ram is a rare shove, never a
    // shredder: one ram per 3.5s across ALL cruisers, only when the player's
    // car is actually moving, small car-only damage, and the cruiser backs
    // off and holds its distance afterwards instead of gluing to the bumper.
    RAM_CAR_DAMAGE: 1,
    RAM_COOLDOWN: 4.0, // seconds before one cruiser may ram again
    RAM_GATE_SECONDS: 3.5, // one ram per 3.5s across ALL cruisers
    RAM_BACKOFF_SECONDS: 2.5, // a cruiser reverses away this long after ramming
    RAM_HOLD_SECONDS: 3.0, // ...then holds at a distance this long
    RAM_HOLD_DIST: 130, // cruisers that may not ram yet hold at this distance
    RAM_MIN_PLAYER_SPEED: 30, // rams only land on a moving car
    RAM_RANGE: 52, // how close a cruiser must be to ram
    POLICE_SEPARATION: 46, // a cruiser is never allowed inside this of the player's car
    // Combat / damage (capped so one hit can never gut the player)
    TRAFFIC_HIT_DAMAGE: 4,
    BULLET_DAMAGE: 8,
    PUNCH_DAMAGE: 12,
    HIT_COOLDOWN: 0.7, // seconds between damage ticks from one source
    // Traffic jams — a car that makes no progress for 5s is in a jam that
    // will never clear, so it turns around or respawns instead of sitting.
    TRAFFIC_STUCK_SECONDS: 5,
    TRAFFIC_BLOCKED_SECONDS: 3, // blocked by a stopped car this long: U-turn
    // Wanted
    WANTED_DECAY_SECONDS: 14, // quiet seconds per star lost
    COP_CAR_MIN_DIST_ON_FOOT: 58, // a cruiser may never rest on the on-foot player
    ARREST_SECONDS: 1.2, // a foot cop touching you this long busts you
    // Spawn safety
    SPAWN_INVULN_SECONDS: 3,
    // Camera / view
    VIEW_W: 1280,
    VIEW_H: 720,
  };

  // Palette: sun-soaked coastal city, neon at dusk.
  NBN.PALETTE = {
    grass: '#5da24a',
    parkGrass: '#6db35c',
    sand: '#e8d29a',
    water: '#2e7fa8',
    waterDeep: '#1f5f86',
    road: '#3c3f4a',
    roadLine: '#e8d44d',
    sidewalk: '#9aa0a8',
    curb: '#7d838d',
    buildingRoof: ['#b0563a', '#4a6b8a', '#8a5a7a', '#5a7a4a', '#a87c3a', '#6a5a8a'],
    buildingWall: ['#8a4430', '#3a5468', '#6b4460', '#46603a', '#87622e', '#52446e'],
    neon: ['#ff2e88', '#22e6ff', '#ffe14d', '#7CFF6B', '#ff7a2e'],
  };

  // The five jobs from Marla Voss, in order. Money, story and names are original.
  NBN.MISSIONS = [
    {
      id: 1, name: 'First Wheels', reward: 150,
      brief: 'Marla Voss needs wheels. Steal any car and bring it to the garage.',
      hint: 'Walk up to a car and press E to steal it. Then drive to the yellow garage marker.',
    },
    {
      id: 2, name: 'Sunset Run', reward: 300, timeLimit: 90,
      brief: 'A package for the Salt Air bar, on the beach. 90 seconds. No excuses.',
      hint: 'You have the package. Drive east to the beach bar before the timer runs out.',
    },
    {
      id: 3, name: 'The Getaway', reward: 450,
      brief: 'Rico is hot and needs a lift. Pick him up, lose the Bay PD, reach the safehouse.',
      hint: 'Pick up Rico at the blue marker, then shake the cops and get to the safehouse.',
    },
    {
      id: 4, name: 'Repo Man', reward: 600,
      brief: 'A yellow coupe, parked by the marina lot. Bring it back in one piece.',
      hint: 'Steal the marked yellow coupe. Below 30% condition and the job is blown.',
    },
    {
      id: 5, name: 'The Bay Trust Job', reward: 1000,
      brief: 'The vault at Bay Trust. Grab the cash, lose the whole Bay PD, vanish.',
      hint: 'Reach the vault, grab the cash, then lose every cop and reach the safehouse.',
    },
  ];

  // Key places in the city (world coordinates). Every mission target sits
  // ON a street (or the beach), never inside a block: a target a driver
  // cannot reach by a clear street path is a target that cannot be done.
  NBN.PLACES = {
    spawnPark: { x: 600, y: 1000 }, // safe spawn: a park, away from traffic
    garage: { x: 1200, y: 600 }, // on the x=1200 street
    saltAirBar: { x: 2960, y: 1600 }, // beach, on the y=1600 street
    safehouse: { x: 600, y: 2400 }, // on the y=2400 street
    vault: { x: 1600, y: 1400 }, // on the x=1600 street
    ricoPickup: { x: 2000, y: 2200 }, // on the x=2000 street (was inside a park block)
    coupeLot: { x: 1000, y: 2000 }, // on the y=2000 street
    pistolPickup: { x: 1200, y: 800 }, // on the x=1200 street, just south of the garage — on the player's path, never behind a building corner
  };

  NBN.MISSION_INTRO = 'Marla Voss: ';
})();

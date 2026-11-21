// Neon Bay Nights — deterministic screenshot scenes (?shot=cover|chase|mission|night).
// Each scene positions the player/cars so headless captures show real gameplay.
import { snapToStreet } from './city.js';

export function applyShot(state, city, rng, announce) {
  const shot = state.shot;
  if (!shot) return;
  const p = state.player;
  if (shot === 'cover' || shot === 'start') {
    // Hero shot: player beside a car near neon signs, mission marker visible.
    const spot = snapToStreet(city, city.garage.x + 320, city.garage.y - 320);
    p.x = spot.x; p.y = spot.y; p.angle = -0.4;
    state.money = 1250;
    state.health = 100;
    state.wanted = 0;
    state.wantedHeat = 0;
    announce('Neon Bay Nights — press ENTER to play');
  } else if (shot === 'chase' || shot === 'play') {
    // Police chase: player driving, two cruisers shadowing at standoff distance.
    const spot = snapToStreet(city, 1600, 1600);
    let car = state.world.cars.find((c) => !c.police && !c.traffic);
    if (!car) car = state.world.cars[0];
    car.x = spot.x; car.y = spot.y; car.angle = 0; car.speed = 240; car.traffic = false; car.driver = 'player';
    p.inCar = car; p.x = car.x; p.y = car.y;
    state.wantedHeat = 55;
    state.wanted = 3;
    state.money = 860;
    state.hasPistol = true; state.ammo = 42;
    // Place two cruisers behind at safe standoff.
    let placed = 0;
    for (const c of state.world.cars) {
      if (c === car) continue;
      if (placed >= 2) break;
      c.police = true; c.traffic = false; c.dead = false; c.color = '#101018';
      c.x = spot.x - 130 - placed * 110;
      c.y = spot.y + (placed === 0 ? -40 : 50);
      c.angle = 0; c.speed = 220;
      placed++;
    }
    announce('Police chase — keep driving!');
  } else if (shot === 'mission') {
    // Mission view: on foot near the package marker with pistol beacon nearby.
    const spot = snapToStreet(city, 960, 2240);
    p.x = spot.x; p.y = spot.y; p.angle = 0.6;
    state.missionIdx = 0;
    state.missionStage = 0;
    state.money = 540;
    state.hasPistol = true; state.ammo = 30;
    state.wanted = 1; state.wantedHeat = 22;
    announce('Mission: pick up the package');
  } else if (shot === 'night' || shot === 'end') {
    // Night cruise: in a car downtown with cash collected.
    const spot = snapToStreet(city, 2240, 960);
    let car = state.world.cars.find((c) => !c.police && !c.traffic);
    if (!car) car = state.world.cars[0];
    car.x = spot.x; car.y = spot.y; car.angle = Math.PI / 2; car.speed = 180; car.traffic = false; car.driver = 'player';
    p.inCar = car; p.x = car.x; p.y = car.y;
    state.missionIdx = 2;
    state.missionStage = 1;
    state.money = 1980;
    state.health = 82;
    state.wanted = 0; state.wantedHeat = 0;
    announce('Cash drops: 1 of 3 collected');
  }
}

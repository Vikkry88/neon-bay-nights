// Screenshot staging via ?shot=cover|chase|mission|police
export function applyShot(state, name) {
  const s = state;
  if (!name) return false;
  s.mode = 'play';
  if (name === 'cover') {
    s.player.x = s.city.spawn.x; s.player.y = s.city.spawn.y; s.player.inCar = null;
    s.wanted = 0; s.banner = 'Neon Bay Nights — welcome to the bay.';
  } else if (name === 'chase') {
    const car = s.cars.find((c) => c.parked && !c.dead) || s.cars[0];
    if (car) { s.player.inCar = car; car.speed = 160; car.angle = 0; }
    s.wanted = 3; s.missionStage = 1;
    s.banner = 'Quiet Pickup: deliver to the YELLOW garage ring.';
    s.marker = { x: s.city.garage.x, y: s.city.garage.y };
  } else if (name === 'mission') {
    const car = s.cars.find((c) => c.parked && !c.dead) || s.cars[0];
    if (car) { s.player.inCar = car; car.speed = 90; }
    s.missionStage = 0;
    s.banner = 'Quiet Pickup: go to the glowing marker.';
    if (s._targets) s.marker = { x: s._targets.a.x, y: s._targets.a.y };
  } else if (name === 'police') {
    s.wanted = 4;
    s.player.x = s.city.spawn.x; s.player.y = s.city.spawn.y; s.player.inCar = null;
    s.banner = 'Wanted! Lose the heat or reach the garage.';
  }
  return true;
}
export function shotFromUrl() {
  return new URLSearchParams(location.search).get('shot');
}

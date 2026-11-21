// Fixer missions for Neon Bay Nights. Targets are snapped onto streets.
import { nearestRoadPoint } from './city.js';

export const FIXER = 'Marlowe';
export const MISSIONS = [
  { id: 'm1', title: 'Quiet Pickup', reward: 500, brief: 'Grab the package at the marker, then bring it to the yellow garage ring.' },
  { id: 'm2', title: 'Beach Run', reward: 750, brief: 'Pick up the cooler near the beach road and deliver it to the garage.' },
  { id: 'm3', title: 'Repo Job', reward: 1000, brief: 'Steal the marked car and deliver it to the garage. Expect heat.' },
  { id: 'm4', title: 'Hot Delivery', reward: 1250, brief: 'Collect the crate, shake the tail, and reach the garage.' },
  { id: 'm5', title: 'Night Chase', reward: 2000, brief: 'Run the final package across town. The cops will not like it.' },
];

export function missionTargets(city, missionId) {
  const { xs, ys } = city;
  let a, b;
  if (missionId === 'm1') { a = nearestRoadPoint(xs[3], ys[2]); }
  else if (missionId === 'm2') { a = nearestRoadPoint(xs[2], city.beachY - 120); }
  else if (missionId === 'm3') { a = nearestRoadPoint(xs[0], ys[3]); }
  else if (missionId === 'm4') { a = nearestRoadPoint(xs[xs.length - 1], ys[1]); }
  else { a = nearestRoadPoint(xs[xs.length - 1], ys[ys.length - 1]); }
  b = { x: city.garage.x, y: city.garage.y };
  return { a, b };
}

export function stageBanner(mission, stage) {
  if (!mission) return 'Free roam — press Enter near Marlowe\'s corner to take work.';
  if (stage === 0) return mission.title + ': go to the glowing marker.';
  if (stage === 1) return mission.title + ': deliver to the YELLOW garage ring.';
  return mission.title + ' complete!';
}

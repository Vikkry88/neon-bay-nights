// Marlowe's ten story jobs for Neon Bay Nights. Each job is a sequence of
// street-point stages (drive to / deliver / reach) with a time budget, a cash
// reward and a district whose respect grows when the job is done. Jobs unlock
// in order; progress is saved between sessions.

export const JOBS = [
  {
    id: 'm1', title: 'First Run', reward: 500, time: 150, district: 'downtown',
    brief: 'Marlowe: "New face, simple work. Pick up the package downtown and bring it to me. No noise."',
    done: 'Marlowe: "Clean. Keep that up and Neon Bay pays you well."',
    stages: [
      { label: 'Pick up the package', at: [1050, 630], needCar: false },
      { label: 'Deliver to Marlowe', at: [630, 1890], needCar: false },
    ],
  },
  {
    id: 'm2', title: 'Beach Drop', reward: 750, time: 170, district: 'beachfront',
    brief: 'Marlowe: "A cooler of product is sitting by the pier. Grab it, drop it at the beach club."',
    done: 'Marlowe: "The club owner sends thanks. Cash is yours."',
    stages: [
      { label: 'Collect the cooler at the pier', at: [2520, 630], needCar: false },
      { label: 'Drop it at the beach club', at: [2520, 1470], needCar: false },
    ],
  },
  {
    id: 'm3', title: 'Old Town Ledger', reward: 1000, time: 180, district: 'oldtown',
    brief: 'Marlowe: "An old friend in Old Town owes me a ledger. Collect it. Drive — it is a long walk."',
    done: 'Marlowe: "Names, numbers, leverage. Beautiful."',
    stages: [
      { label: 'Steal a car and drive to Old Town', at: [210, 1050], needCar: true },
      { label: 'Bring the ledger back downtown', at: [1470, 1050], needCar: true },
    ],
  },
  {
    id: 'm4', title: 'Marina Wheels', reward: 1250, time: 190, district: 'marina',
    brief: 'Marlowe: "A buyer at the marina wants a fast car, no questions. Any car. Deliver it running."',
    done: 'Marlowe: "Sold before you parked it. Nice."',
    stages: [
      { label: 'Deliver any car to the marina buyer', at: [2520, 2730], needCar: true },
    ],
  },
  {
    id: 'm5', title: 'Neon Courier', reward: 1500, time: 160, district: 'downtown',
    brief: 'Marlowe: "Three drops, one route, clock ticking. Downtown only. Move."',
    done: 'Marlowe: "Fast hands. The city noticed — respect earned."',
    stages: [
      { label: 'Drop 1: hotel alley', at: [1470, 630], needCar: false },
      { label: 'Drop 2: club door', at: [1890, 1050], needCar: false },
      { label: 'Drop 3: rooftop stairs', at: [1470, 1470], needCar: false },
    ],
  },
  {
    id: 'm6', title: 'Heat Check', reward: 2000, time: 200, district: 'beachfront',
    brief: 'Marlowe: "Pick up the stash, then lose any heat at the yellow garage ring before you come to me."',
    done: 'Marlowe: "Cool head. That is worth more than speed."',
    stages: [
      { label: 'Pick up the stash', at: [2520, 1890], needCar: false },
      { label: 'Deliver to Marlowe', at: [1050, 2310], needCar: false },
    ],
  },
  {
    id: 'm7', title: 'Old Town Muscle', reward: 2500, time: 210, district: 'oldtown',
    brief: 'Marlowe: "Some collectors are leaning on my people in Old Town. Show up armed and settle it."',
    done: 'Marlowe: "Old Town breathes again. So do my margins."',
    stages: [
      { label: 'Reach the Old Town corner', at: [210, 2310], needCar: false },
      { label: 'Report back downtown', at: [1050, 1050], needCar: false },
    ],
  },
  {
    id: 'm8', title: 'Harbor Run', reward: 3000, time: 200, district: 'marina',
    brief: 'Marlowe: "Boat comes in at the marina. Cargo to the warehouse, warehouse to me. Two legs."',
    done: 'Marlowe: "Harbor money. Spend it slow."',
    stages: [
      { label: 'Collect cargo at the marina', at: [2520, 3150], needCar: true },
      { label: 'Haul it to the warehouse', at: [630, 3150], needCar: true },
      { label: 'Bring the cut to Marlowe', at: [1050, 1890], needCar: false },
    ],
  },
  {
    id: 'm9', title: 'Citywide', reward: 4000, time: 240, district: 'downtown',
    brief: 'Marlowe: "Every district, one night. Four stops. This is how you become Neon Bay."',
    done: 'Marlowe: "Four districts, one name: yours."',
    stages: [
      { label: 'Stop 1: Downtown', at: [1470, 630], needCar: false },
      { label: 'Stop 2: Beachfront', at: [2520, 1050], needCar: false },
      { label: 'Stop 3: Marina', at: [2520, 2730], needCar: false },
      { label: 'Stop 4: Old Town', at: [210, 1890], needCar: false },
    ],
  },
  {
    id: 'm10', title: 'Neon Bay Nights', reward: 5000, time: 260, district: 'beachfront',
    brief: 'Marlowe: "Last job. The big one. Pick up the case at the pier and bring it home — whatever follows you."',
    done: 'Marlowe: "That is it. Neon Bay is yours now. Go enjoy it."',
    stages: [
      { label: 'Take the case at the pier', at: [2520, 630], needCar: false },
      { label: 'Bring it home to Marlowe', at: [1050, 1470], needCar: false },
    ],
  },
];

export function jobAt(index) {
  return index >= 0 && index < JOBS.length ? JOBS[index] : null;
}

export function totalRewards() {
  return JOBS.reduce((sum, job) => sum + job.reward, 0);
}

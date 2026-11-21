// Neon Bay Nights — tuning constants.
export const CFG = {
  worldSize: 3200,
  block: 320,
  street: 112,
  walkSpeed: 230,
  carMax: 460,
  carReverse: 170,
  carAccel: 340,
  carBrake: 420,
  carDrag: 0.55,
  trafficSpeed: 150,
  policeSpeed: 380,
  policeStandoff: 72,
  policeBrakeDist: 130,
  garage: { x: 0, y: 0 }, // filled by city (street point)
  colors: {
    ground: '#14182b',
    street: '#232840',
    streetLine: '#3d4670',
    sidewalk: '#1c2138',
    neon: ['#ff2d95', '#00e5ff', '#ffe600', '#7c4dff', '#00ffa3'],
    car: ['#e53935', '#1e88e5', '#fdd835', '#8e24aa', '#00acc1', '#fb8c00', '#43a047', '#d81b60'],
  },
};

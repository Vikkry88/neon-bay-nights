// city.js — procedural Neon Bay: pastel towers with lit windows, palm trees,
// street lamps, neon signs, traffic lights, hospital and garage landmarks.
import * as THREE from 'three';
import { WORLD, LANDMARKS, districtAt } from './world.js';

const PASTELS = [0xf6c9a0, 0xf2a9b8, 0xa8d8ea, 0xf9e79f, 0xc3e6c0, 0xe8c8f0, 0xf5f0e6, 0xffb59e];
const SIGN_WORDS = ['NEON', 'BAY FM', 'HOTEL SOL', 'PIER CAFE', 'MARINA', 'PALM BAR', 'BAY PD', 'GARAGE', 'TACOS', 'SURF SHOP'];
const SIGN_COLORS = ['#ff5fa2', '#4de8ff', '#ffd94d', '#8be89b', '#ff8c5a'];

function windowTexture(baseColor, rng) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const ctx = c.getContext('2d');
  const col = new THREE.Color(baseColor);
  ctx.fillStyle = '#' + col.getHexString(); ctx.fillRect(0, 0, 128, 256);
  for (let y = 10; y < 246; y += 20) {
    for (let x = 8; x < 118; x += 18) {
      const lit = rng() < 0.42;
      ctx.fillStyle = lit ? '#ffe9a3' : 'rgba(30,45,70,0.85)';
      ctx.fillRect(x, y, 11, 13);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function signTexture(word, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#141c2c'; ctx.fillRect(0, 0, 256, 64);
  ctx.font = 'bold 34px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = color; ctx.shadowBlur = 16;
  ctx.fillStyle = color;
  ctx.fillText(word, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(G) {
  const scene = G.scene;
  const rng = G.rng;
  const textures = PASTELS.map((col) => windowTexture(col, rng));
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x8a7f74 });
  G.trafficLights = [];

  // Blocks sit between roads: centres at -120,-40,40,120 on both axes.
  const centres = [-120, -40, 40, 120];
  for (const bx of centres) {
    for (const bz of centres) {
      const district = districtAt(bx, bz);
      const isHospital = Math.abs(bx - LANDMARKS.hospital.x) < 1 && Math.abs(bz - LANDMARKS.hospital.z) < 1;
      const isGarage = Math.abs(bx - LANDMARKS.garage.x) < 1 && Math.abs(bz - LANDMARKS.garage.z) < 1;
      if (isHospital) { buildHospital(G, bx, bz); continue; }
      if (isGarage) { buildGarage(G, bx, bz); continue; }
      if (rng() < 0.14) { buildPark(G, bx, bz); continue; }
      const count = district === 'Downtown' ? 2 : (rng() < 0.5 ? 2 : 1);
      for (let i = 0; i < count; i++) {
        const w = 16 + rng() * 14, d = 16 + rng() * 14;
        const tall = district === 'Downtown' ? 26 + rng() * 30 : district === 'Beachfront' ? 14 + rng() * 18 : 9 + rng() * 13;
        const ox = count === 2 ? (i === 0 ? -14 : 14) : 0;
        const oz = count === 2 ? (rng() - 0.5) * 18 : 0;
        const tex = textures[Math.floor(rng() * textures.length)];
        const side = new THREE.MeshLambertMaterial({ map: tex });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, tall, d), [side, side, roofMat, roofMat, side, side]);
        mesh.position.set(bx + ox, tall / 2, bz + oz);
        mesh.castShadow = true; mesh.receiveShadow = true;
        scene.add(mesh);
        G.colliders.push({ minX: bx + ox - w / 2, maxX: bx + ox + w / 2, minZ: bz + oz - d / 2, maxZ: bz + oz + d / 2 });
        if (rng() < 0.5) addNeonSign(G, bx + ox, tall * 0.72, bz + oz + d / 2 + 0.15, 0);
        if (rng() < 0.35) addNeonSign(G, bx + ox + w / 2 + 0.15, tall * 0.6, bz + oz, Math.PI / 2);
      }
    }
  }

  // Beachfront row: low hotels along the boulevard, palms on the sand.
  for (let z = -200; z <= 200; z += 34) {
    if (Math.abs(z) < 16) continue;
    const h = 10 + rng() * 10;
    const tex = textures[Math.floor(rng() * textures.length)];
    const side = new THREE.MeshLambertMaterial({ map: tex });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(18, h, 22), [side, side, roofMat, roofMat, side, side]);
    mesh.position.set(176, h / 2, z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    G.colliders.push({ minX: 167, maxX: 185, minZ: z - 11, maxZ: z + 11 });
    addPalm(G, 196 + rng() * 6, z + (rng() - 0.5) * 18);
  }
  // Boulevard palms + lamps along every avenue.
  for (const ax of WORLD.avenues) {
    for (let z = -228; z <= 228; z += 26) {
      if (WORLD.streets.some((s) => Math.abs(s - z) < 12)) continue;
      if (ax === WORLD.boulevardX) addPalm(G, ax + 11.5, z);
      addLamp(G, ax - 10.6, z);
    }
  }
  for (const sz of WORLD.streets) {
    for (let x = -228; x <= 228; x += 30) {
      if (WORLD.avenues.some((a) => Math.abs(a - x) < 12)) continue;
      addLamp(G, x, sz + 10.6);
    }
  }
  // Traffic lights at each intersection corner.
  for (const ax of WORLD.avenues) for (const sz of WORLD.streets) addTrafficLight(G, ax, sz);
  // Marina boats: simple hulls bobbing near the pier/marina corner.
  G.boats = [];
  for (let i = 0; i < 6; i++) {
    const boat = makeBoat(rng);
    boat.position.set(228 + rng() * 14, 0.2, 120 + i * 16 + rng() * 6);
    scene.add(boat);
    G.boats.push(boat);
  }
  return G;
}

function addNeonSign(G, x, y, z, rotY) {
  const word = SIGN_WORDS[Math.floor(G.rng() * SIGN_WORDS.length)];
  const color = SIGN_COLORS[Math.floor(G.rng() * SIGN_COLORS.length)];
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(11, 2.75),
    new THREE.MeshBasicMaterial({ map: signTexture(word, color) }),
  );
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  G.scene.add(mesh);
}

function addPalm(G, x, z) {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6844 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3e9e4f, side: THREE.DoubleSide });
  const lean = (G.rng() - 0.5) * 0.22;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 6.4, 6), trunkMat);
  trunk.position.y = 3.2; trunk.rotation.z = lean; trunk.castShadow = true;
  group.add(trunk);
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 0.9), leafMat);
    const a = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 1.9 - lean * 6, 6.6, Math.sin(a) * 1.9);
    leaf.rotation.set(-0.5, -a, 0, 'YXZ');
    group.add(leaf);
  }
  group.position.set(x, 0, z);
  G.scene.add(group);
  G.colliders.push({ minX: x - 0.4, maxX: x + 0.4, minZ: z - 0.4, maxZ: z + 0.4 });
}

function addLamp(G, x, z) {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 5.2, 6),
    new THREE.MeshLambertMaterial({ color: 0x3a4150 }));
  pole.position.y = 2.6;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffe9a3 }));
  bulb.position.y = 5.3;
  group.add(pole); group.add(bulb);
  group.position.set(x, 0, z);
  G.scene.add(group);
}

function addTrafficLight(G, x, z) {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 5.6, 6),
    new THREE.MeshLambertMaterial({ color: 0x2e3440 }));
  pole.position.y = 2.8;
  group.add(pole);
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.5, 0.4),
    new THREE.MeshLambertMaterial({ color: 0x1c2129 }));
  box.position.y = 5.2;
  group.add(box);
  const lamps = {};
  const defs = [['red', 0xff4444, 5.65], ['amber', 0xffb340, 5.2], ['green', 0x51e07a, 4.75]];
  for (const [name, color, y] of defs) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0x222222 }));
    m.position.set(0, y, 0.24);
    group.add(m);
    lamps[name] = { mesh: m, color };
  }
  group.position.set(x + WORLD.roadHalf + 1.2, 0, z + WORLD.roadHalf + 1.2);
  G.scene.add(group);
  G.trafficLights.push({ lamps, phase: G.rng() * 10 });
}

function buildHospital(G, x, z) {
  const white = new THREE.MeshLambertMaterial({ color: 0xf4f6f8 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(30, 16, 22), white);
  mesh.position.set(x, 8, z);
  mesh.castShadow = true; mesh.receiveShadow = true;
  G.scene.add(mesh);
  G.colliders.push({ minX: x - 15, maxX: x + 15, minZ: z - 11, maxZ: z + 11 });
  const crossMat = new THREE.MeshBasicMaterial({ color: 0xe83a3a });
  const v = new THREE.Mesh(new THREE.BoxGeometry(1.6, 5, 0.3), crossMat);
  v.position.set(x, 11, z + 11.2); G.scene.add(v);
  const h = new THREE.Mesh(new THREE.BoxGeometry(5, 1.6, 0.3), crossMat);
  h.position.set(x, 11, z + 11.2); G.scene.add(h);
  addNeonSign(G, x, 15, z + 11.2, 0);
}

function buildGarage(G, x, z) {
  const mat = new THREE.MeshLambertMaterial({ color: 0x5a6b7d });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(28, 7, 20), mat);
  mesh.position.set(x, 3.5, z);
  mesh.castShadow = true; mesh.receiveShadow = true;
  G.scene.add(mesh);
  G.colliders.push({ minX: x - 14, maxX: x + 14, minZ: z - 10, maxZ: z + 10 });
  const door = new THREE.Mesh(new THREE.BoxGeometry(10, 5, 0.3),
    new THREE.MeshLambertMaterial({ color: 0x2c3542 }));
  door.position.set(x, 2.5, z - 10.2);
  G.scene.add(door);
  addNeonSign(G, x, 8.2, z - 10.2, Math.PI);
  // Glowing service ring in front of the garage (drive in to lose the heat).
  const ring = new THREE.Mesh(new THREE.RingGeometry(4.4, 5.4, 28),
    new THREE.MeshBasicMaterial({ color: 0x4de8ff, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, 0.08, z - 16);
  G.scene.add(ring);
  G.garageRing = ring;
  G.garagePoint = { x, z: z - 16 };
}

function buildPark(G, x, z) {
  const grass = new THREE.Mesh(new THREE.BoxGeometry(46, 0.3, 46),
    new THREE.MeshLambertMaterial({ color: 0x5f9e4e }));
  grass.position.set(x, 0.15, z);
  grass.receiveShadow = true;
  G.scene.add(grass);
  for (let i = 0; i < 5; i++) addPalm(G, x + (G.rng() - 0.5) * 34, z + (G.rng() - 0.5) * 34);
  const benchMat = new THREE.MeshLambertMaterial({ color: 0x7a5a3a });
  for (let i = 0; i < 3; i++) {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 0.8), benchMat);
    bench.position.set(x + (G.rng() - 0.5) * 30, 0.4, z + (G.rng() - 0.5) * 30);
    G.scene.add(bench);
  }
}

function makeBoat(rng) {
  const group = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1, 6),
    new THREE.MeshLambertMaterial({ color: [0xffffff, 0xff8c5a, 0x4de8ff][Math.floor(rng() * 3)] }));
  hull.position.y = 0.4;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 5, 5),
    new THREE.MeshLambertMaterial({ color: 0xdddddd }));
  mast.position.y = 3;
  const sail = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3.4),
    new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
  sail.position.set(0, 3.2, 0.8);
  group.add(hull); group.add(mast); group.add(sail);
  return group;
}

export function updateCity(G, dt) {
  const t = G.time;
  for (const tl of G.trafficLights) {
    const phase = (t + tl.phase) % 12;
    const state = phase < 5 ? 'green' : phase < 6.5 ? 'amber' : 'red';
    for (const name of ['red', 'amber', 'green']) {
      tl.lamps[name].mesh.material.color.setHex(name === state ? tl.lamps[name].color : 0x222222);
    }
  }
  if (G.boats) for (let i = 0; i < G.boats.length; i++) {
    G.boats[i].position.y = 0.15 + Math.sin(t * 0.9 + i * 1.7) * 0.18;
    G.boats[i].rotation.z = Math.sin(t * 0.7 + i) * 0.05;
  }
  if (G.garageRing) G.garageRing.material.opacity = 0.55 + Math.sin(t * 3) * 0.25;
}

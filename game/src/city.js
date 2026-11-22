// city.js — procedural Neon Bay: pastel buildings, palms, neon signs,
// street lamps, traffic lights, parks and district layout.
// Buildings are merged into instanced meshes where it helps performance.
import * as THREE from 'three';
import { WORLD_SIZE, ROAD_STEP, ROAD_HALF, roadCoords } from './world.js';

export const DISTRICTS = [
  { name: 'Downtown', cx: -120, cz: -120 },
  { name: 'Beachfront', cx: 0, cz: 190 },
  { name: 'Old Town', cx: 140, cz: -130 },
  { name: 'Marina', cx: 150, cz: 140 },
];

export function districtAt(x, z) {
  let best = DISTRICTS[0];
  let bestD = Infinity;
  for (const d of DISTRICTS) {
    const dist = (x - d.cx) ** 2 + (z - d.cz) ** 2;
    if (dist < bestD) {
      bestD = dist;
      best = d;
    }
  }
  return best.name;
}

const PASTELS = [0xf2e3c9, 0xf7c8b8, 0xbfe3d0, 0xbdd7f2, 0xf2d38a, 0xe8b4d8, 0xc9e7f2, 0xf5efe0, 0xd9c7e7, 0xa8d8b9];
const SIGN_TEXTS = ['NEON BAY', 'MARINA GRILL', 'HOTEL SOL', 'BAY RADIO', 'CAFÉ LUNA', 'AUTO BAY', 'PIER 9', 'PALM CLUB', 'NOODLE HOUSE', 'SURF SHOP', 'BAR AZUL', 'CINEMA'];

function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeSignTexture(text, bg, fg) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 112;
  const g = canvas.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 112);
  g.strokeStyle = fg;
  g.lineWidth = 6;
  g.strokeRect(6, 6, 500, 100);
  g.fillStyle = fg;
  g.font = 'bold 52px Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = fg;
  g.shadowBlur = 18;
  g.fillText(text, 256, 58);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeWindowTexture(baseColor, litRatio, rand) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = baseColor;
  g.fillRect(0, 0, 128, 256);
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 5; col++) {
      const lit = rand() < litRatio;
      g.fillStyle = lit ? '#ffe9a8' : 'rgba(40,60,90,0.85)';
      g.fillRect(10 + col * 23, 12 + row * 20, 15, 12);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene, seed = 1) {
  const rand = seededRandom(seed * 7919 + 13);
  const colliders = []; // {x, z, hw, hd} axis-aligned building boxes
  const group = new THREE.Group();
  scene.add(group);

  const roads = roadCoords();
  const isRoad = (v) => roads.some((r) => Math.abs(v - r) < ROAD_HALF + 6);
  const boulevardZ = WORLD_SIZE / 2 - 34;

  const signMats = SIGN_TEXTS.map((t, i) => new THREE.MeshBasicMaterial({
    map: makeSignTexture(t, i % 2 ? '#1a1033' : '#0d2b3a', i % 3 === 0 ? '#ff5fa2' : i % 3 === 1 ? '#4de8ff' : '#ffd94d'),
  }));

  // buildings on the blocks between roads
  const windowTexCache = [];
  for (let i = 0; i < 6; i++) {
    const c = PASTELS[i % PASTELS.length];
    const css = `#${c.toString(16).padStart(6, '0')}`;
    windowTexCache.push(makeWindowTexture(css, 0.35 + rand() * 0.3, rand));
  }
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x6b6259, roughness: 0.95 });

  for (let bx = -WORLD_SIZE / 2 + ROAD_STEP / 2; bx < WORLD_SIZE / 2; bx += ROAD_STEP) {
    for (let bz = -WORLD_SIZE / 2 + ROAD_STEP / 2; bz < WORLD_SIZE / 2; bz += ROAD_STEP) {
      if (isRoad(bx) || isRoad(bz)) continue;
      if (Math.abs(bz - boulevardZ) < ROAD_HALF + 8) continue;
      if (bz > WORLD_SIZE / 2 - 60) continue; // keep the beach clear
      const roll = rand();
      if (roll < 0.1) {
        // park block: grass + trees
        const park = new THREE.Mesh(
          new THREE.BoxGeometry(ROAD_STEP - 16, 0.3, ROAD_STEP - 16),
          new THREE.MeshStandardMaterial({ color: 0x5da65d, roughness: 1 }),
        );
        park.position.set(bx, 0.15, bz);
        park.receiveShadow = true;
        group.add(park);
        for (let t = 0; t < 5; t++) {
          addTree(group, bx + (rand() - 0.5) * 24, bz + (rand() - 0.5) * 24, rand);
        }
        continue;
      }
      const w = 16 + rand() * 12;
      const d = 16 + rand() * 12;
      const h = 10 + rand() * 34;
      const tex = windowTexCache[Math.floor(rand() * windowTexCache.length)];
      const sideMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
      const mats = [sideMat, sideMat, roofMat, roofMat, sideMat, sideMat];
      const building = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
      building.position.set(bx + (rand() - 0.5) * 4, h / 2, bz + (rand() - 0.5) * 4);
      building.castShadow = true;
      building.receiveShadow = true;
      group.add(building);
      colliders.push({ x: building.position.x, z: building.position.z, hw: w / 2 + 0.4, hd: d / 2 + 0.4 });
      // neon sign on some buildings
      if (rand() < 0.42) {
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w * 0.9, 14), 3), signMats[Math.floor(rand() * signMats.length)]);
        const face = Math.floor(rand() * 4);
        const off = face < 2 ? d / 2 + 0.08 : w / 2 + 0.08;
        if (face === 0) { sign.position.set(building.position.x, h * 0.72, building.position.z + off); }
        if (face === 1) { sign.position.set(building.position.x, h * 0.72, building.position.z - off); sign.rotation.y = Math.PI; }
        if (face === 2) { sign.position.set(building.position.x + off, h * 0.72, building.position.z); sign.rotation.y = Math.PI / 2; }
        if (face === 3) { sign.position.set(building.position.x - off, h * 0.72, building.position.z); sign.rotation.y = -Math.PI / 2; }
        group.add(sign);
      }
      // rooftop water tank / AC box for silhouette
      if (rand() < 0.5) {
        const tank = new THREE.Mesh(
          new THREE.CylinderGeometry(1.6, 1.6, 2.4, 8),
          new THREE.MeshStandardMaterial({ color: 0x9a8f7d, roughness: 0.9 }),
        );
        tank.position.set(building.position.x + (rand() - 0.5) * w * 0.4, h + 1.2, building.position.z + (rand() - 0.5) * d * 0.4);
        tank.castShadow = true;
        group.add(tank);
      }
    }
  }

  // palm trees along the boulevard and scattered on sidewalks
  for (let x = -WORLD_SIZE / 2 + 10; x < WORLD_SIZE / 2; x += 18) {
    addPalm(group, x + rand() * 4, boulevardZ - ROAD_HALF - 3.5, rand);
    addPalm(group, x + rand() * 4, boulevardZ + ROAD_HALF + 3.5, rand);
    addPalm(group, x + rand() * 4, WORLD_SIZE / 2 + 8, rand);
  }
  for (let i = 0; i < 60; i++) {
    const x = (rand() - 0.5) * (WORLD_SIZE - 30);
    const z = (rand() - 0.5) * (WORLD_SIZE - 90);
    if (isRoad(x) || isRoad(z)) continue;
    addPalm(group, x, z, rand);
  }

  // street lamps along every road
  const lampPole = new THREE.CylinderGeometry(0.09, 0.12, 5.4, 6);
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 0.6, metalness: 0.4 });
  const bulbGeo = new THREE.SphereGeometry(0.28, 8, 6);
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffedb5 });
  const lampPositions = [];
  for (const r of roads) {
    for (let d = -WORLD_SIZE / 2 + 12; d < WORLD_SIZE / 2; d += 36) {
      lampPositions.push([r - ROAD_HALF - 1.2, d]);
      lampPositions.push([r + ROAD_HALF + 1.2, d + 18]);
      lampPositions.push([d, r - ROAD_HALF - 1.2]);
      lampPositions.push([d + 18, r + ROAD_HALF + 1.2]);
    }
  }
  const poleMesh = new THREE.InstancedMesh(lampPole, lampMat, lampPositions.length);
  const bulbMesh = new THREE.InstancedMesh(bulbGeo, bulbMat, lampPositions.length);
  const m4 = new THREE.Matrix4();
  lampPositions.forEach(([x, z], i) => {
    m4.makeTranslation(x, 2.7, z);
    poleMesh.setMatrixAt(i, m4);
    m4.makeTranslation(x, 5.5, z);
    bulbMesh.setMatrixAt(i, m4);
  });
  poleMesh.instanceMatrix.needsUpdate = true;
  bulbMesh.instanceMatrix.needsUpdate = true;
  group.add(poleMesh, bulbMesh);

  // traffic lights at intersections (visual, cycles colours)
  const trafficLights = [];
  const tlPoleMat = new THREE.MeshStandardMaterial({ color: 0x2e3238, roughness: 0.6, metalness: 0.4 });
  for (const rx of roads) {
    for (const rz of roads) {
      if (rand() < 0.35) continue;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 4.6, 6), tlPoleMat);
      pole.position.set(rx + ROAD_HALF + 0.8, 2.3, rz + ROAD_HALF + 0.8);
      group.add(pole);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.3, 0.4), tlPoleMat);
      head.position.set(pole.position.x, 4.4, pole.position.z);
      group.add(head);
      const lamps = [];
      const cols = [0xff4444, 0xffcc33, 0x44dd66];
      cols.forEach((c, i) => {
        const lamp = new THREE.Mesh(
          new THREE.CircleGeometry(0.14, 10),
          new THREE.MeshBasicMaterial({ color: c }),
        );
        lamp.position.set(pole.position.x, 4.85 - i * 0.42, pole.position.z - 0.22);
        lamp.rotation.y = Math.PI;
        group.add(lamp);
        lamps.push(lamp);
      });
      trafficLights.push({ lamps, phase: rand() * 10 });
    }
  }

  // hospital + garage landmarks (respawn / safehouse)
  const hospital = landmark(group, -150, -190, 'HOSPITAL', 0xe8f2ff, 0xff5555);
  colliders.push({ x: -150, z: -190, hw: 13, hd: 11 });
  const garage = landmark(group, 90, 60, 'BAY GARAGE', 0xffe9a8, 0xffb020);
  colliders.push({ x: 90, z: 60, hw: 13, hd: 11 });

  // pier into the ocean
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x8a6f4d, roughness: 0.95 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(7, 0.5, 90), pierMat);
  pier.position.set(-60, 1.1, WORLD_SIZE / 2 + 55);
  pier.castShadow = true;
  group.add(pier);
  for (let i = 0; i < 8; i++) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 2.2, 6), pierMat);
    post.position.set(-60 + (i % 2 ? 3 : -3), 0.4, WORLD_SIZE / 2 + 16 + i * 11);
    group.add(post);
  }

  return { colliders, trafficLights, hospitalPos: new THREE.Vector3(-150, 0, -172), garagePos: new THREE.Vector3(90, 0, 78), boulevardZ };
}

function landmark(group, x, z, text, bg, fg) {
  const tex = makeSignTexture(text, '#14202e', `#${fg.toString(16).padStart(6, '0')}`);
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(24, 11, 20),
    new THREE.MeshStandardMaterial({ color: bg, roughness: 0.85 }),
  );
  body.position.set(x, 5.5, z);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(16, 3.4), new THREE.MeshBasicMaterial({ map: tex }));
  sign.position.set(x, 8.6, z + 10.1);
  group.add(sign);
  return body;
}

function addPalm(group, x, z, rand) {
  const h = 5.5 + rand() * 2.5;
  const lean = (rand() - 0.5) * 0.22;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.26, h, 6),
    new THREE.MeshStandardMaterial({ color: 0x8a6f4d, roughness: 1 }),
  );
  trunk.position.set(x, h / 2, z);
  trunk.rotation.z = lean;
  trunk.castShadow = true;
  group.add(trunk);
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x3f9e4d, roughness: 0.9, side: THREE.DoubleSide });
  for (let i = 0; i < 6; i++) {
    const frond = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.7), frondMat);
    const a = (i / 6) * Math.PI * 2 + rand() * 0.4;
    frond.position.set(x + Math.cos(a) * 1.4 + lean * h * 0.4, h + 0.3, z + Math.sin(a) * 1.4);
    frond.rotation.set(-0.5, -a, 0);
    frond.castShadow = true;
    group.add(frond);
  }
}

function addTree(group, x, z, rand) {
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.2, 2.4, 6),
    new THREE.MeshStandardMaterial({ color: 0x7a5c3e, roughness: 1 }),
  );
  trunk.position.set(x, 1.2, z);
  trunk.castShadow = true;
  group.add(trunk);
  const crown = new THREE.Mesh(
    new THREE.SphereGeometry(1.5 + rand() * 0.8, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x4da653, roughness: 0.95 }),
  );
  crown.position.set(x, 3.4, z);
  crown.castShadow = true;
  group.add(crown);
}

export function updateCity(city, nowMs) {
  for (const tl of city.trafficLights) {
    const t = ((nowMs / 1000 + tl.phase) % 9);
    const active = t < 4 ? 2 : t < 5 ? 1 : 0; // green, amber, red
    tl.lamps.forEach((lamp, i) => {
      lamp.material.opacity = 1;
      lamp.visible = i === active;
    });
  }
}

// Push a point out of building colliders; returns corrected position.
export function collideBuildings(pos, radius, colliders) {
  for (const c of colliders) {
    const dx = pos.x - c.x;
    const dz = pos.z - c.z;
    const px = c.hw + radius - Math.abs(dx);
    const pz = c.hd + radius - Math.abs(dz);
    if (px > 0 && pz > 0) {
      if (px < pz) pos.x = c.x + Math.sign(dx || 1) * (c.hw + radius);
      else pos.z = c.z + Math.sign(dz || 1) * (c.hd + radius);
    }
  }
  return pos;
}

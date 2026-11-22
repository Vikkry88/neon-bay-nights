// world.js — Three.js scene, golden-hour sky, ocean, beach and road grid.
// Neon Bay is a coastal city: water along the south edge, sand, a palm
// boulevard, then a full road grid the player can drive and walk on.
import * as THREE from 'three';

export const WORLD_SIZE = 480; // metres, square city
export const ROAD_STEP = 48; // distance between parallel roads
export const ROAD_HALF = 7; // half road width

export function roadCoords() {
  const coords = [];
  for (let v = -WORLD_SIZE / 2 + ROAD_STEP; v < WORLD_SIZE / 2; v += ROAD_STEP) coords.push(v);
  return coords;
}

function makeSkyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#2a4a7f');
  grad.addColorStop(0.45, '#7fb2d9');
  grad.addColorStop(0.72, '#f7c98b');
  grad.addColorStop(0.88, '#ffb37a');
  grad.addColorStop(1, '#ff9e6e');
  g.fillStyle = grad;
  g.fillRect(0, 0, 16, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeGroundTexture() {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  // base city ground (pavement)
  g.fillStyle = '#8d8578';
  g.fillRect(0, 0, size, size);
  // subtle noise blocks
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    g.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)';
    g.fillRect(x, y, 6, 6);
  }
  const toPx = (world) => ((world + WORLD_SIZE / 2) / WORLD_SIZE) * size;
  const roads = roadCoords();
  const roadPx = (ROAD_HALF * 2 / WORLD_SIZE) * size;
  // asphalt roads
  g.fillStyle = '#3c3f45';
  for (const r of roads) {
    const p = toPx(r);
    g.fillRect(p - roadPx / 2, 0, roadPx, size);
    g.fillRect(0, p - roadPx / 2, size, roadPx);
  }
  // beach boulevard along the south edge (high z)
  const blvd = toPx(WORLD_SIZE / 2 - 34);
  g.fillRect(0, blvd - roadPx / 2, size, roadPx);
  // lane markings: centre dashes + edge lines
  g.fillStyle = '#f5d76e';
  for (const r of roads) {
    const p = toPx(r);
    for (let d = 0; d < size; d += 26) {
      g.fillRect(p - 1.5, d, 3, 14);
      g.fillRect(d, p - 1.5, 14, 3);
    }
  }
  for (let d = 0; d < size; d += 26) g.fillRect(d, blvd - 1.5, 14, 3);
  g.fillStyle = 'rgba(255,255,255,0.85)';
  for (const r of roads) {
    const p = toPx(r);
    g.fillRect(p - roadPx / 2, 0, 2, size);
    g.fillRect(p + roadPx / 2 - 2, 0, 2, size);
    g.fillRect(0, p - roadPx / 2, size, 2);
    g.fillRect(0, p + roadPx / 2 - 2, size, 2);
  }
  // crosswalks at intersections
  g.fillStyle = 'rgba(255,255,255,0.75)';
  for (const rx of roads) {
    for (const rz of roads) {
      const px = toPx(rx);
      const py = toPx(rz);
      for (let s = -2; s <= 2; s++) {
        g.fillRect(px + s * 5 - 2, py - roadPx / 2 - 7, 3, 6);
        g.fillRect(px + s * 5 - 2, py + roadPx / 2 + 1, 3, 6);
        g.fillRect(px - roadPx / 2 - 7, py + s * 5 - 2, 6, 3);
        g.fillRect(px + roadPx / 2 + 1, py + s * 5 - 2, 6, 3);
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function createWorld() {
  const scene = new THREE.Scene();
  scene.background = makeSkyTexture();
  scene.fog = new THREE.Fog(0xf2b98a, 140, 520);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
  camera.position.set(0, 26, 60);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  document.getElementById('app').appendChild(renderer.domElement);

  const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x8a6a4a, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd9a0, 1.9);
  sun.position.set(-120, 150, -80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -160;
  sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 160;
  sun.shadow.camera.bottom = -160;
  sun.shadow.camera.far = 520;
  scene.add(sun);
  scene.add(sun.target);
  const fill = new THREE.DirectionalLight(0x8fb8ff, 0.35);
  fill.position.set(90, 60, 120);
  scene.add(fill);

  // city ground with painted roads
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE),
    new THREE.MeshStandardMaterial({ map: makeGroundTexture(), roughness: 0.95, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // sand beach strip on the south edge
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_SIZE + 240, 46),
    new THREE.MeshStandardMaterial({ color: 0xe8d29a, roughness: 1 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.06, WORLD_SIZE / 2 + 22);
  sand.receiveShadow = true;
  scene.add(sand);

  // ocean
  const oceanMat = new THREE.MeshStandardMaterial({
    color: 0x2e8fb8, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.94,
  });
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(1400, 420), oceanMat);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, 0.02, WORLD_SIZE / 2 + 250);
  scene.add(ocean);

  // sun disc sprite for the golden-hour look
  const sunCanvas = document.createElement('canvas');
  sunCanvas.width = 128;
  sunCanvas.height = 128;
  const sg = sunCanvas.getContext('2d');
  const rg = sg.createRadialGradient(64, 64, 4, 64, 64, 64);
  rg.addColorStop(0, 'rgba(255,240,200,1)');
  rg.addColorStop(0.35, 'rgba(255,200,120,0.85)');
  rg.addColorStop(1, 'rgba(255,170,90,0)');
  sg.fillStyle = rg;
  sg.fillRect(0, 0, 128, 128);
  const sunTex = new THREE.CanvasTexture(sunCanvas);
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, transparent: true, depthWrite: false }));
  sunSprite.position.set(-260, 95, -420);
  sunSprite.scale.set(180, 180, 1);
  scene.add(sunSprite);

  // clouds: a few soft billboards
  const cloudCanvas = document.createElement('canvas');
  cloudCanvas.width = 256;
  cloudCanvas.height = 96;
  const cg = cloudCanvas.getContext('2d');
  cg.fillStyle = 'rgba(255,255,255,0.9)';
  for (const [cx, cy, r] of [[60, 55, 28], [110, 45, 36], [165, 52, 30], [205, 58, 22]]) {
    cg.beginPath();
    cg.arc(cx, cy, r, 0, Math.PI * 2);
    cg.fill();
  }
  const cloudTex = new THREE.CanvasTexture(cloudCanvas);
  const clouds = [];
  for (let i = 0; i < 9; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.75, depthWrite: false }));
    sp.position.set(-380 + Math.random() * 760, 95 + Math.random() * 55, -380 + Math.random() * 560);
    sp.scale.set(120 + Math.random() * 90, 36 + Math.random() * 22, 1);
    scene.add(sp);
    clouds.push(sp);
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { scene, camera, renderer, sun, ocean, clouds };
}

export function updateWorld(world, dt, focus) {
  // keep the shadow camera centred on the action
  world.sun.position.set(focus.x - 120, 150, focus.z - 80);
  world.sun.target.position.set(focus.x, 0, focus.z);
  world.sun.target.updateMatrixWorld();
  // gentle ocean shimmer
  world.ocean.material.color.setHSL(0.54, 0.62, 0.42 + Math.sin(performance.now() * 0.0006) * 0.03);
  for (const c of world.clouds) {
    c.position.x += dt * 1.6;
    if (c.position.x > 460) c.position.x = -460;
  }
}

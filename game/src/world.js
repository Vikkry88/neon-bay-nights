// world.js — scene, renderer, sky, ocean/beach, road-grid ground, districts.
// Neon Bay is a 480x480 coastal city: avenues run north-south, streets run
// east-west, the beach and ocean sit on the east edge, a pier juts into the sea.
import * as THREE from 'three';

export const WORLD = {
  half: 240,
  avenues: [-160, -80, 0, 80, 160],
  streets: [-160, -80, 0, 80, 160],
  roadHalf: 8,
  beachX: 186,
  waterX: 214,
  boulevardX: 160,
};

export function districtAt(x, z) {
  if (x > 96 && z > 96) return 'Marina';
  if (x > 96) return 'Beachfront';
  if (x < -96) return 'Old Town';
  return 'Downtown';
}

export const LANDMARKS = {
  hospital: { x: -40, z: -120, name: 'Neon Bay Hospital' },
  garage: { x: 40, z: 120, name: 'Bay Garage' },
  pier: { x: 216, z: 0, name: 'Neon Bay Pier' },
  marina: { x: 150, z: 150, name: 'Marina' },
};

// Deterministic RNG so screenshots and playtests see the same city.
export function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function buildWorld(G) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.getElementById('app').appendChild(renderer.domElement);
  G.renderer = renderer;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xf2c9a0, 180, 520);
  G.scene = scene;
  G.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);

  // Golden-hour sky: big gradient dome + sun sprite + drifting clouds.
  const skyGeo = new THREE.SphereGeometry(560, 24, 14);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x3d7bd6) },
      mid: { value: new THREE.Color(0x9fc7ee) },
      low: { value: new THREE.Color(0xffc98a) },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 low; varying vec3 vP;' +
      'void main(){ float h = normalize(vP).y; vec3 c = h > 0.22 ? mix(mid, top, smoothstep(0.22, 0.75, h)) : mix(low, mid, smoothstep(-0.06, 0.22, h)); gl_FragColor = vec4(c, 1.0); }',
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  const sun = new THREE.DirectionalLight(0xffe3b3, 2.6);
  sun.position.set(-140, 190, -90);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -160; sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 160; sun.shadow.camera.bottom = -160;
  sun.shadow.camera.far = 600;
  scene.add(sun); scene.add(sun.target);
  G.sun = sun;
  scene.add(new THREE.HemisphereLight(0xbfe0ff, 0x8a6a4a, 0.95));
  scene.add(new THREE.AmbientLight(0xffffff, 0.22));

  const sunSprite = makeGlowSprite(0xffe9b0, 90);
  sunSprite.position.set(-330, 250, -210);
  scene.add(sunSprite);

  G.clouds = [];
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 10; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(G.rng() * 3);
    for (let p = 0; p < puffs; p++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(6 + G.rng() * 7, 10, 8), cloudMat);
      m.position.set(p * 8 - puffs * 4, G.rng() * 2.5, G.rng() * 5);
      m.scale.y = 0.45;
      cloud.add(m);
    }
    cloud.position.set(-320 + G.rng() * 640, 95 + G.rng() * 45, -320 + G.rng() * 640);
    scene.add(cloud);
    G.clouds.push(cloud);
  }

  // Ground: one big plane with a painted canvas texture (roads, lanes, walks).
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 560),
    new THREE.MeshLambertMaterial({ map: makeGroundTexture() }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Ocean: animated-feel plane east of the beach.
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(340, 560),
    new THREE.MeshPhongMaterial({ color: 0x2e7fc4, shininess: 90, specular: 0x99d4ff }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(WORLD.waterX + 170, -0.4, 0);
  scene.add(ocean);
  G.ocean = ocean;

  // Pier: wooden deck over the water at z=0.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x9a6b43 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(70, 1.2, 12), pierMat);
  pier.position.set(216, 0.6, 0);
  pier.receiveShadow = true;
  scene.add(pier);
  for (let i = 0; i < 8; i++) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 3, 6), pierMat);
    post.position.set(188 + i * 8, -0.6, i % 2 ? 5 : -5);
    scene.add(post);
  }

  G.colliders = [];
  G.waterEdgeX = WORLD.waterX;
  return G;
}

function makeGlowSprite(color, size) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, 'rgba(255,240,190,1)');
  g.addColorStop(0.35, 'rgba(255,220,140,0.75)');
  g.addColorStop(1, 'rgba(255,210,120,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, color, transparent: true, depthWrite: false, fog: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(size, size, 1);
  return sprite;
}

// Paint the whole city floor: grass/sand base, asphalt roads, lane dashes,
// crosswalks and sidewalks. Canvas maps world [-280,280] to [0,2048].
function makeGroundTexture() {
  const S = 2048, span = 560;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d');
  const px = (w) => ((w + span / 2) / span) * S;
  const pw = (w) => (w / span) * S;
  ctx.fillStyle = '#7fae62'; ctx.fillRect(0, 0, S, S);
  // City blocks slightly different green-grey, beach sand to the east.
  ctx.fillStyle = '#8fae7d'; ctx.fillRect(px(-240), px(-240), pw(480), pw(480));
  ctx.fillStyle = '#ecd29a'; ctx.fillRect(px(WORLD.beachX), 0, pw(span / 2 - WORLD.beachX), S);
  ctx.fillStyle = '#f4e2ae'; ctx.fillRect(px(WORLD.beachX + 14), 0, pw(span / 2 - WORLD.beachX - 14), S);

  const road = '#3c4148', walk = '#b9b3a4', line = '#f5d76e', cross = '#e8e8e8';
  function paintRoad(vertical, at) {
    const h = WORLD.roadHalf;
    ctx.fillStyle = walk;
    if (vertical) ctx.fillRect(px(at - h - 2.4), px(-240), pw((h + 2.4) * 2), pw(480));
    else ctx.fillRect(px(-240), px(at - h - 2.4), pw(480), pw((h + 2.4) * 2));
    ctx.fillStyle = road;
    if (vertical) ctx.fillRect(px(at - h), px(-240), pw(h * 2), pw(480));
    else ctx.fillRect(px(-240), px(at - h), pw(480), pw(h * 2));
    // Center dashes + edge lines.
    ctx.fillStyle = line;
    for (let d = -236; d < 240; d += 9) {
      if (vertical) ctx.fillRect(px(at - 0.22), px(d), pw(0.44), pw(4.4));
      else ctx.fillRect(px(d), px(at - 0.22), pw(4.4), pw(0.44));
    }
    ctx.fillStyle = cross;
    if (vertical) {
      ctx.fillRect(px(at - h + 0.5), px(-240), pw(0.4), pw(480));
      ctx.fillRect(px(at + h - 0.9), px(-240), pw(0.4), pw(480));
    } else {
      ctx.fillRect(px(-240), px(at - h + 0.5), pw(480), pw(0.4));
      ctx.fillRect(px(-240), px(at + h - 0.9), pw(480), pw(0.4));
    }
  }
  for (const x of WORLD.avenues) paintRoad(true, x);
  for (const z of WORLD.streets) paintRoad(false, z);
  // Crosswalks at every intersection.
  ctx.fillStyle = cross;
  for (const x of WORLD.avenues) for (const z of WORLD.streets) {
    for (let s = -6; s <= 6; s += 2.4) {
      ctx.fillRect(px(x + s - 0.7), px(z - WORLD.roadHalf - 1.6), pw(1.4), pw(1.4));
      ctx.fillRect(px(x + s - 0.7), px(z + WORLD.roadHalf + 0.2), pw(1.4), pw(1.4));
      ctx.fillRect(px(x - WORLD.roadHalf - 1.6), px(z + s - 0.7), pw(1.4), pw(1.4));
      ctx.fillRect(px(x + WORLD.roadHalf + 0.2), px(z + s - 0.7), pw(1.4), pw(1.4));
    }
  }
  // Hospital + garage pads.
  ctx.fillStyle = '#c9ccd2';
  ctx.fillRect(px(LANDMARKS.hospital.x - 16), px(LANDMARKS.hospital.z - 14), pw(32), pw(28));
  ctx.fillRect(px(LANDMARKS.garage.x - 16), px(LANDMARKS.garage.z - 14), pw(32), pw(28));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function updateWorld(G, dt) {
  for (const cloud of G.clouds) {
    cloud.position.x += dt * 1.6;
    if (cloud.position.x > 360) cloud.position.x = -360;
  }
  if (G.ocean) G.ocean.position.y = -0.4 + Math.sin(G.time * 0.7) * 0.12;
  // Keep the shadow camera centred on the player so shadows stay crisp.
  const p = G.player.pos;
  G.sun.position.set(p.x - 140, 190, p.z - 90);
  G.sun.target.position.set(p.x, 0, p.z);
}

// Push a circle (x,z,r) out of all building AABBs. Returns true if it hit.
export function collideCircle(G, pos, r) {
  let hit = false;
  for (const b of G.colliders) {
    const nx = Math.max(b.minX, Math.min(pos.x, b.maxX));
    const nz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
    const dx = pos.x - nx, dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      hit = true;
      if (d2 < 0.0001) { pos.x = b.maxX + r; continue; }
      const d = Math.sqrt(d2);
      pos.x = nx + (dx / d) * r;
      pos.z = nz + (dz / d) * r;
    }
  }
  pos.x = Math.max(-WORLD.half + 2, Math.min(WORLD.waterX + 34, pos.x));
  pos.z = Math.max(-WORLD.half + 2, Math.min(WORLD.half - 2, pos.z));
  return hit;
}

export function nearestRoadPoint(x, z) {
  let bestX = WORLD.avenues[0], bestZ = WORLD.streets[0];
  for (const a of WORLD.avenues) if (Math.abs(a - x) < Math.abs(bestX - x)) bestX = a;
  for (const s of WORLD.streets) if (Math.abs(s - z) < Math.abs(bestZ - z)) bestZ = s;
  return Math.abs(bestX - x) < Math.abs(bestZ - z) ? { x: bestX, z } : { x, z: bestZ };
}

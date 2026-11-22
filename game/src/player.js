// player.js — on-foot character, weapon visuals, pedestrians, chase camera.
// The hero is a low-poly box character with swinging limbs; pedestrians
// stroll the sidewalks and scatter when shots ring out.
import * as THREE from 'three';

export function makeCharacter(shirt = 0x2e6fd8, pants = 0x333a45, skin = 0xe8b98a) {
  const g = new THREE.Group();
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.8 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.85 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.34), shirtMat);
  torso.position.y = 1.08;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.4, 0.36), skinMat);
  head.position.y = 1.72;
  head.castShadow = true;
  g.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.42), new THREE.MeshStandardMaterial({ color: 0x22262e, roughness: 0.8 }));
  cap.position.y = 1.94;
  g.add(cap);
  const mkLimb = (mat, w, len) => {
    const pivot = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, len, w), mat);
    mesh.position.y = -len / 2;
    mesh.castShadow = true;
    pivot.add(mesh);
    return pivot;
  };
  const armL = mkLimb(shirtMat, 0.16, 0.66);
  armL.position.set(-0.4, 1.4, 0);
  const armR = mkLimb(shirtMat, 0.16, 0.66);
  armR.position.set(0.4, 1.4, 0);
  const legL = mkLimb(pantsMat, 0.2, 0.72);
  legL.position.set(-0.16, 0.7, 0);
  const legR = mkLimb(pantsMat, 0.2, 0.72);
  legR.position.set(0.16, 0.7, 0);
  g.add(armL, armR, legL, legR);
  // weapon in the right hand (hidden until drawn)
  const gun = new THREE.Group();
  const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.42), new THREE.MeshStandardMaterial({ color: 0x22262e, roughness: 0.4, metalness: 0.5 }));
  gunBody.position.set(0, -0.6, 0.18);
  gun.add(gunBody);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, -0.6, 0.42);
  gun.add(muzzle);
  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.5),
    new THREE.MeshBasicMaterial({ color: 0xffd94d, transparent: true, opacity: 0, side: THREE.DoubleSide }),
  );
  flash.position.copy(muzzle.position);
  gun.add(flash);
  armR.add(gun);
  gun.visible = false;
  return { group: g, armL, armR, legL, legR, gun, muzzle, flash, walkPhase: 0, heading: 0 };
}

export function animateWalk(char, speed, dt, aiming = false) {
  char.walkPhase += dt * (2 + speed * 1.6);
  const swing = Math.min(0.75, speed * 0.16);
  const s = Math.sin(char.walkPhase) * swing;
  char.legL.rotation.x = s;
  char.legR.rotation.x = -s;
  char.armL.rotation.x = -s * 0.8;
  if (aiming) {
    char.armR.rotation.x = -Math.PI / 2 + 0.12;
  } else {
    char.armR.rotation.x = s * 0.8;
  }
}

export const PED_SHIRTS = [0xd94f6a, 0x4fa3d9, 0xf2c14e, 0x6ad97a, 0xf27bb5, 0x8a6ad9, 0xe8e3d8, 0x4dc4c4];

export function spawnPedestrians(scene, count, rand) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const char = makeCharacter(
      PED_SHIRTS[Math.floor(rand() * PED_SHIRTS.length)],
      [0x333a45, 0x5a4a3a, 0x2e4a3a, 0x6b6259][Math.floor(rand() * 4)],
    );
    const along = (rand() - 0.5) * 420;
    const road = Math.floor(rand() * 9) * 48 - 192;
    const side = (rand() > 0.5 ? 1 : -1) * 9.5;
    if (rand() > 0.5) char.group.position.set(road + side, 0, along);
    else char.group.position.set(along, 0, road + side);
    char.heading = rand() * Math.PI * 2;
    char.speed = 1.1 + rand() * 0.9;
    char.turnTimer = rand() * 6;
    char.flee = 0;
    scene.add(char.group);
    peds.push(char);
  }
  return peds;
}

export function updatePedestrian(ped, dt, rand, scarePos) {
  const pos = ped.group.position;
  if (scarePos && pos.distanceTo(scarePos) < 16) ped.flee = 2.2;
  ped.flee = Math.max(0, ped.flee - dt);
  ped.turnTimer -= dt;
  if (ped.turnTimer <= 0) {
    ped.turnTimer = 3 + rand() * 5;
    if (ped.flee > 0 && scarePos) {
      ped.heading = Math.atan2(pos.x - scarePos.x, pos.z - scarePos.z) + (rand() - 0.5) * 0.6;
    } else {
      ped.heading += (rand() - 0.5) * 1.6;
    }
  }
  const speed = ped.flee > 0 ? ped.speed * 2.6 : ped.speed;
  pos.x += Math.sin(ped.heading) * speed * dt;
  pos.z += Math.cos(ped.heading) * speed * dt;
  pos.x = THREE.MathUtils.clamp(pos.x, -232, 232);
  pos.z = THREE.MathUtils.clamp(pos.z, -232, 250);
  ped.group.rotation.y = ped.heading;
  animateWalk(ped, speed, dt, false);
}

// Smooth chase camera: behind the car when driving, behind the hero on foot.
export function updateChaseCamera(camera, targetPos, heading, driving, dt, snap = false) {
  const dist = driving ? 10.5 : 6.5;
  const height = driving ? 4.2 : 3.0;
  const desired = new THREE.Vector3(
    targetPos.x - Math.sin(heading) * dist,
    height,
    targetPos.z - Math.cos(heading) * dist,
  );
  if (snap) camera.position.copy(desired);
  else camera.position.lerp(desired, Math.min(1, dt * 4.2));
  camera.position.y = Math.max(camera.position.y, 1.6);
  const look = new THREE.Vector3(
    targetPos.x + Math.sin(heading) * (driving ? 6 : 2.5),
    1.4,
    targetPos.z + Math.cos(heading) * (driving ? 6 : 2.5),
  );
  camera.lookAt(look);
}

// police.js — wanted stars, dispatch tiers, pursuit AI, roadblocks,
// and the helicopter with spotlight. Pursuit uses a standoff distance
// plus push-out so the player is never pinned against a wall.
import * as THREE from 'three';
import { makeCar, spinWheels } from './vehicles.js';
import { collideBuildings } from './city.js';

export const DISPATCH_TIERS = [
  { stars: 1, name: 'Patrol', units: 2, tactic: 'FOLLOWING' },
  { stars: 2, name: 'Interceptor', units: 3, tactic: 'RAMMING' },
  { stars: 3, name: 'Roadblock', units: 4, tactic: 'ROADBLOCK' },
  { stars: 4, name: 'Air Support', units: 5, tactic: 'SPOTLIGHT' },
  { stars: 5, name: 'Maximum Response', units: 6, tactic: 'FLANKING' },
];

const POLICE_MODEL = { name: 'Bay PD Interceptor', color: 0xf2f2f2, topSpeed: 56, accel: 18 };

export function makeHelicopter() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2e4a7a, roughness: 0.4, metalness: 0.3 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 5.2), bodyMat);
  body.castShadow = true;
  g.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.2, 1.2), new THREE.MeshStandardMaterial({ color: 0x9fd4e8, roughness: 0.2, metalness: 0.3 }));
  nose.position.set(0, -0.1, 3.0);
  g.add(nose);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 3.6), bodyMat);
  tail.position.set(0, 0.3, -4.2);
  g.add(tail);
  const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 0.8), bodyMat);
  tailFin.position.set(0, 0.7, -5.9);
  g.add(tailFin);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.08, 0.5), new THREE.MeshStandardMaterial({ color: 0x22262e }));
  rotor.position.y = 1.15;
  g.add(rotor);
  const rotor2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 11), new THREE.MeshStandardMaterial({ color: 0x22262e }));
  rotor2.position.y = 1.15;
  g.add(rotor2);
  const skidMat = new THREE.MeshStandardMaterial({ color: 0x33373d, metalness: 0.5, roughness: 0.4 });
  for (const sx of [-0.9, 0.9]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 3.4), skidMat);
    skid.position.set(sx, -1.3, 0.4);
    g.add(skid);
  }
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.4, 5.24), new THREE.MeshBasicMaterial({ color: 0xffd94d }));
  stripe.position.y = -0.3;
  g.add(stripe);
  // spotlight: real SpotLight + visible cone + ground pool
  const spot = new THREE.SpotLight(0xfff2b0, 900, 90, 0.42, 0.45, 1.2);
  spot.position.set(0, -0.8, 1.5);
  g.add(spot);
  g.add(spot.target);
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(7.5, 26, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
  );
  cone.position.set(0, -13.5, 1.5);
  g.add(cone);
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(6.5, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.28, depthWrite: false }),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.name = 'spot-pool';
  return { group: g, rotor, rotor2, spot, cone, pool, heading: 0, orbit: 0 };
}

export class PoliceSystem {
  constructor(scene) {
    this.scene = scene;
    this.units = [];
    this.heli = null;
    this.roadblocks = [];
    this.wanted = 0;
    this.cooldown = 0;
    this.flashTimer = 0;
  }

  setWanted(stars) {
    this.wanted = THREE.MathUtils.clamp(Math.round(stars), 0, 5);
    return this.wanted;
  }

  tier() {
    return this.wanted > 0 ? DISPATCH_TIERS[this.wanted - 1] : null;
  }

  ensureUnits(playerPos, rand) {
    const tier = this.tier();
    const want = tier ? tier.units : 0;
    while (this.units.length < want) {
      const car = makeCar(POLICE_MODEL, true);
      const a = rand() * Math.PI * 2;
      car.group.position.set(playerPos.x + Math.sin(a) * 55, 0, playerPos.z + Math.cos(a) * 55);
      car.heading = Math.atan2(playerPos.x - car.group.position.x, playerPos.z - car.group.position.z);
      car.group.rotation.y = car.heading;
      car.unitName = `Unit ${this.units.length + 1}`;
      car.tactic = tier ? tier.tactic : 'FOLLOWING';
      this.scene.add(car.group);
      this.units.push(car);
    }
    while (this.units.length > want) {
      const car = this.units.pop();
      this.scene.remove(car.group);
    }
    // helicopter from 3 stars up
    if (this.wanted >= 3 && !this.heli) {
      this.heli = makeHelicopter();
      this.heli.group.position.set(playerPos.x + 20, 26, playerPos.z - 20);
      this.scene.add(this.heli.group);
      this.scene.add(this.heli.pool);
    }
    if (this.wanted < 3 && this.heli) {
      this.scene.remove(this.heli.group);
      this.scene.remove(this.heli.pool);
      this.heli = null;
    }
    // roadblocks from 3 stars up: two parked police cars ahead of the player
    if (this.wanted >= 3 && this.roadblocks.length === 0) {
      for (let i = 0; i < 2; i++) {
        const car = makeCar(POLICE_MODEL, true);
        car.group.position.set(playerPos.x + (i === 0 ? -3 : 3), 0, playerPos.z + 34);
        car.heading = Math.PI / 2;
        car.group.rotation.y = car.heading;
        car.roadblock = true;
        this.scene.add(car.group);
        this.roadblocks.push(car);
      }
    }
    if (this.wanted < 3 && this.roadblocks.length) {
      for (const car of this.roadblocks) this.scene.remove(car.group);
      this.roadblocks = [];
    }
  }

  update(dt, playerPos, playerSpeed, colliders, rand, onRam) {
    this.flashTimer += dt * 9;
    const flashOn = Math.floor(this.flashTimer) % 2 === 0;
    this.ensureUnits(playerPos, rand);
    const tier = this.tier();
    this.units.forEach((car, i) => {
      const pos = car.group.position;
      const dx = playerPos.x - pos.x;
      const dz = playerPos.z - pos.z;
      const dist = Math.hypot(dx, dz);
      // standoff: aim slightly behind/beside the player, never dead-centre
      const flank = this.wanted >= 5 ? (i % 2 === 0 ? 5.5 : -5.5) : (i - 1) * 2.4;
      const targetX = playerPos.x + Math.cos(Math.atan2(dx, dz)) * flank;
      const targetZ = playerPos.z - Math.sin(Math.atan2(dx, dz)) * flank;
      const desired = Math.atan2(targetX - pos.x, targetZ - pos.z);
      let turn = desired - car.heading;
      while (turn > Math.PI) turn -= Math.PI * 2;
      while (turn < -Math.PI) turn += Math.PI * 2;
      car.heading += THREE.MathUtils.clamp(turn, -2.4 * dt, 2.4 * dt);
      const topSpeed = 34 + this.wanted * 4.5;
      // ease off inside the standoff ring so we nudge, never pin
      const standoff = 6.5;
      let targetSpeed = topSpeed;
      if (dist < standoff) targetSpeed = Math.max(0, playerSpeed * 0.9);
      else if (dist < 14) targetSpeed = Math.max(playerSpeed + 4, 10);
      car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.8);
      pos.x += Math.sin(car.heading) * car.speed * dt;
      pos.z += Math.cos(car.heading) * car.speed * dt;
      collideBuildings(pos, 2.1, colliders);
      // push-out: keep a minimum gap to the player
      const pdx = pos.x - playerPos.x;
      const pdz = pos.z - playerPos.z;
      const pd = Math.hypot(pdx, pdz);
      if (pd < 4.6 && pd > 0.001) {
        pos.x = playerPos.x + (pdx / pd) * 4.6;
        pos.z = playerPos.z + (pdz / pd) * 4.6;
        car.speed *= 0.55; // back off after contact
        if (onRam) onRam(car);
      }
      // if far behind, reposition ahead-side (keeps pressure without teleporting on top)
      if (dist > 130) {
        const a = Math.atan2(dx, dz) + (rand() - 0.5) * 1.2;
        pos.set(playerPos.x - Math.sin(a) * 60, 0, playerPos.z - Math.cos(a) * 60);
        car.heading = Math.atan2(dx, dz);
      }
      car.group.rotation.y = car.heading;
      spinWheels(car, dt);
      const red = car.group.getObjectByName('lightbar-red');
      const blue = car.group.getObjectByName('lightbar-blue');
      if (red) red.material.color.setHex(flashOn ? 0xff2244 : 0x661122);
      if (blue) blue.material.color.setHex(flashOn ? 0x112266 : 0x2266ff);
      car.tactic = tier ? tier.tactic : 'FOLLOWING';
      car.distance = Math.round(dist);
    });
    for (const car of this.roadblocks) {
      const red = car.group.getObjectByName('lightbar-red');
      const blue = car.group.getObjectByName('lightbar-blue');
      if (red) red.material.color.setHex(flashOn ? 0xff2244 : 0x661122);
      if (blue) blue.material.color.setHex(flashOn ? 0x112266 : 0x2266ff);
    }
    if (this.heli) {
      const h = this.heli;
      h.orbit += dt * 0.35;
      const hx = playerPos.x + Math.sin(h.orbit) * 16;
      const hz = playerPos.z + Math.cos(h.orbit) * 16;
      h.group.position.lerp(new THREE.Vector3(hx, 20, hz), Math.min(1, dt * 1.6));
      h.heading = Math.atan2(playerPos.x - h.group.position.x, playerPos.z - h.group.position.z);
      h.group.rotation.y = h.heading;
      h.rotor.rotation.y += dt * 28;
      h.rotor2.rotation.y += dt * 28;
      h.spot.target.position.set(0, -26, 1.5);
      h.spot.target.updateMatrixWorld();
      h.pool.position.set(playerPos.x, 0.12, playerPos.z);
      h.cone.visible = true;
    }
  }

  clear() {
    for (const car of this.units) this.scene.remove(car.group);
    for (const car of this.roadblocks) this.scene.remove(car.group);
    if (this.heli) {
      this.scene.remove(this.heli.group);
      this.scene.remove(this.heli.pool);
    }
    this.units = [];
    this.roadblocks = [];
    this.heli = null;
    this.wanted = 0;
  }
}

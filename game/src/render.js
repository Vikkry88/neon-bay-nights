// World rendering for Neon Bay Nights: sun-soaked top-down city with beach and
// sea, roads with lane markings and traffic lights, buildings with neon signs,
// cars, pedestrians, police, the helicopter and its spotlight, particles,
// tracers, mission markers and the yellow garage ring.

import { WORLD, BEACH_X, SEA_X, TUNING } from './config.js';

export function drawWorld(ctx, cam, view, city, state, time) {
  const left = cam.x - view.w / 2 - 80;
  const top = cam.y - view.h / 2 - 80;
  const right = cam.x + view.w / 2 + 80;
  const bottom = cam.y + view.h / 2 + 80;

  // Ground: warm sand base, sea on the east.
  ctx.fillStyle = '#e8d5a3';
  ctx.fillRect(left, top, right - left, bottom - top);
  const seaGrad = ctx.createLinearGradient(SEA_X, 0, SEA_X + 500, 0);
  seaGrad.addColorStop(0, '#38b6c9');
  seaGrad.addColorStop(1, '#1b7fa8');
  ctx.fillStyle = seaGrad;
  ctx.fillRect(SEA_X, top, WORLD.width - SEA_X + 200, bottom - top);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let wy = Math.floor(top / 46) * 46; wy < bottom; wy += 46) {
    const wob = Math.sin(time * 1.4 + wy * 0.05) * 8;
    ctx.fillRect(SEA_X + 6 + wob, wy, 90, 3);
  }
  // Beach strip.
  ctx.fillStyle = '#f4e3b2';
  ctx.fillRect(BEACH_X, top, SEA_X - BEACH_X, bottom - top);

  // City blocks (sidewalk) then roads on top.
  ctx.fillStyle = '#cbbf9e';
  ctx.fillRect(Math.max(left, 0), Math.max(top, 0), Math.min(right, BEACH_X) - Math.max(left, 0), Math.min(bottom, WORLD.height) - Math.max(top, 0));
  drawRoads(ctx, left, top, right, bottom);

  // Parks.
  for (const park of city.parks) {
    if (park.x + park.w < left || park.x > right || park.y + park.h < top || park.y > bottom) continue;
    ctx.fillStyle = '#57a773';
    ctx.fillRect(park.x, park.y, park.w, park.h);
    ctx.fillStyle = '#6fbf8a';
    ctx.fillRect(park.x + 14, park.y + 14, park.w - 28, park.h - 28);
  }

  // Buildings with roofs + windows.
  for (const b of city.buildings) {
    if (b.x + b.w < left || b.x > right || b.y + b.h < top || b.y > bottom) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(b.x + b.w * b.roof, b.y + b.h * b.roof, b.w * (1 - b.roof * 2), b.h * (1 - b.roof * 2));
    ctx.fillStyle = 'rgba(255,240,180,0.55)';
    for (let wx = b.x + 10; wx < b.x + b.w - 10; wx += 22) {
      for (let wy = b.y + 10; wy < b.y + b.h - 10; wy += 22) {
        ctx.fillRect(wx, wy, 8, 8);
      }
    }
  }

  // Neon signs with text.
  ctx.textAlign = 'center';
  for (const sign of city.signs) {
    if (sign.x < left || sign.x > right || sign.y < top || sign.y > bottom) continue;
    const glow = 0.75 + Math.sin(time * 3 + sign.x) * 0.25;
    ctx.save();
    ctx.globalAlpha = glow;
    ctx.fillStyle = sign.color;
    ctx.shadowColor = sign.color;
    ctx.shadowBlur = 12;
    ctx.font = 'bold 15px system-ui, sans-serif';
    if (sign.vertical) {
      ctx.save();
      ctx.translate(sign.x, sign.y + 30);
      ctx.rotate(Math.PI / 2);
      ctx.fillText(sign.text, 0, 0);
      ctx.restore();
    } else {
      ctx.fillText(sign.text, sign.x, sign.y);
    }
    ctx.restore();
  }

  // Palms.
  for (const palm of city.palms) {
    if (palm.x < left || palm.x > right || palm.y < top || palm.y > bottom) continue;
    ctx.strokeStyle = '#2d6a4f';
    ctx.lineWidth = 3;
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2 + Math.sin(time + palm.x) * 0.05;
      ctx.beginPath();
      ctx.moveTo(palm.x, palm.y);
      ctx.lineTo(palm.x + Math.cos(a) * 16, palm.y + Math.sin(a) * 16);
      ctx.stroke();
    }
    ctx.fillStyle = '#40916c';
    ctx.beginPath();
    ctx.arc(palm.x, palm.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  drawGarageRing(ctx, time);
  drawTrafficLights(ctx, city, left, top, right, bottom, time);
  drawPickups(ctx, state, time);
  drawMissionMarker(ctx, state, time);
}

function drawRoads(ctx, left, top, right, bottom) {
  const m = WORLD.block;
  const r = WORLD.road;
  ctx.fillStyle = '#4a4e57';
  for (let x = Math.floor(left / m) * m; x < right; x += m) {
    ctx.fillRect(x, Math.max(top, 0), r, Math.min(bottom, WORLD.height) - Math.max(top, 0));
  }
  for (let y = Math.floor(top / m) * m; y < bottom; y += m) {
    ctx.fillRect(Math.max(left, 0), y, Math.min(right, BEACH_X) - Math.max(left, 0), r);
  }
  // Lane dashes.
  ctx.fillStyle = '#f5d90a';
  for (let x = Math.floor(left / m) * m; x < right; x += m) {
    for (let y = Math.floor(top / 60) * 60; y < bottom; y += 60) {
      if (((y % m) + m) % m < r) continue;
      ctx.fillRect(x + r / 2 - 2, y, 4, 26);
    }
  }
  for (let y = Math.floor(top / m) * m; y < bottom; y += m) {
    for (let x = Math.floor(left / 60) * 60; x < Math.min(right, BEACH_X); x += 60) {
      if (((x % m) + m) % m < r) continue;
      ctx.fillRect(x, y + r / 2 - 2, 26, 4);
    }
  }
  // Crosswalks at intersections.
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  for (let x = Math.floor(left / m) * m; x < right; x += m) {
    for (let y = Math.floor(top / m) * m; y < bottom; y += m) {
      for (let i = 0; i < 4; i += 1) {
        ctx.fillRect(x + 8 + i * 20, y + r + 2, 12, 6);
        ctx.fillRect(x + r + 2, y + 8 + i * 20, 6, 12);
      }
    }
  }
}

function drawTrafficLights(ctx, city, left, top, right, bottom, time) {
  for (const light of city.lights) {
    if (light.x < left || light.x > right || light.y < top || light.y > bottom) continue;
    const cycle = (time + light.phase) % 8;
    const color = cycle < 3.4 ? '#2ecc71' : cycle < 4.2 ? '#f1c40f' : '#e74c3c';
    ctx.fillStyle = '#222';
    ctx.fillRect(light.x - 4, light.y - 4, 8, 14);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(light.x, light.y + 3, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGarageRing(ctx, time) {
  const g = TUNING.garage;
  const pulse = 0.7 + Math.sin(time * 2.5) * 0.3;
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.strokeStyle = '#ffd60a';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(g.x, g.y, g.radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,214,10,0.12)';
  ctx.fill();
  ctx.fillStyle = '#ffd60a';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('GARAGE', g.x, g.y - g.radius - 10);
  ctx.restore();
}

function drawPickups(ctx, state, time) {
  for (const pickup of state.pickups) {
    if (pickup.taken) continue;
    const bobY = Math.sin(time * 3 + pickup.bob) * 3;
    const colors = { pistol: '#ffe66d', smg: '#ffd166', shotgun: '#ff9f1c', health: '#ff5d8f', armor: '#4cc9f0' };
    const color = colors[pickup.kind] || '#ffffff';
    ctx.save();
    ctx.globalAlpha = 0.35 + Math.sin(time * 4 + pickup.bob) * 0.15;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(pickup.x, pickup.y + bobY, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#14141c';
    ctx.fillRect(pickup.x - 13, pickup.y - 8 + bobY, 26, 16);
    ctx.fillStyle = color;
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const label = { pistol: 'PISTOL', smg: 'SMG', shotgun: 'SHOTGUN', health: '+HP', armor: 'ARMOR' }[pickup.kind];
    ctx.fillText(label, pickup.x, pickup.y + 3 + bobY);
    ctx.restore();
  }
}

function drawMissionMarker(ctx, state, time) {
  const marker = state.missionMarker;
  if (!marker) return;
  const pulse = 1 + Math.sin(time * 4) * 0.12;
  ctx.save();
  ctx.strokeStyle = '#ffe600';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(marker.x, marker.y, 30 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,230,0,0.18)';
  ctx.fill();
  // Beacon column so the marker reads from far away.
  ctx.fillStyle = 'rgba(255,230,0,0.25)';
  ctx.fillRect(marker.x - 3, marker.y - 90, 6, 90);
  ctx.fillStyle = '#ffe600';
  ctx.beginPath();
  ctx.moveTo(marker.x, marker.y - 14);
  ctx.lineTo(marker.x - 9, marker.y - 30);
  ctx.lineTo(marker.x + 9, marker.y - 30);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawCar(ctx, car, time, isPolice) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-car.w / 2 + 3, -car.h / 2 + 4, car.w, car.h);
  ctx.fillStyle = car.color;
  roundRect(ctx, -car.w / 2, -car.h / 2, car.w, car.h, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,30,50,0.85)';
  roundRect(ctx, -6, -car.h / 2 + 3, 16, car.h - 6, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(car.w / 2 - 8, -car.h / 2 + 2, 5, 5);
  ctx.fillRect(car.w / 2 - 8, car.h / 2 - 7, 5, 5);
  if (isPolice) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-car.w / 2 + 12, -car.h / 2, 16, car.h);
    ctx.fillStyle = '#1b2a6b';
    ctx.font = 'bold 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', -car.w / 2 + 20, 3);
    const flash = Math.sin(time * 14 + car.sirenPhase) > 0;
    ctx.fillStyle = flash ? '#ff2e2e' : '#2e6bff';
    ctx.beginPath();
    ctx.arc(-2, -4, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = flash ? '#2e6bff' : '#ff2e2e';
    ctx.beginPath();
    ctx.arc(-2, 4, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (car.health < 45) {
    ctx.fillStyle = 'rgba(40,40,40,0.55)';
    ctx.beginPath();
    ctx.arc(6, 0, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawPed(ctx, ped) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  ctx.rotate(ped.angle);
  const step = Math.sin(ped.walkPhase) * 3;
  ctx.fillStyle = '#2b2d42';
  ctx.fillRect(-2 + step * 0.3, -7, 4, 5);
  ctx.fillRect(-2 - step * 0.3, 2, 4, 5);
  ctx.fillStyle = ped.color;
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2c9a0';
  ctx.beginPath();
  ctx.arc(2, 0, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawPlayer(ctx, player, time, weaponId) {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.arc(2, 3, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#14213d';
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fca311';
  ctx.fillRect(-8, -3, 8, 6);
  ctx.fillStyle = '#f2c9a0';
  ctx.beginPath();
  ctx.arc(2, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  if (weaponId !== 'fists') {
    ctx.fillStyle = '#222';
    const len = weaponId === 'shotgun' ? 22 : weaponId === 'smg' ? 18 : 14;
    ctx.fillRect(6, -2, len, 4);
  }
  if (player.protect > 0) {
    ctx.strokeStyle = `rgba(76,201,240,${0.4 + Math.sin(time * 8) * 0.25})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawHelicopter(ctx, heli, time) {
  if (!heli.active) return;
  // Spotlight cone onto the ground.
  ctx.save();
  const grad = ctx.createRadialGradient(heli.spotX, heli.spotY, 4, heli.spotX, heli.spotY, 90);
  grad.addColorStop(0, 'rgba(255,250,200,0.5)');
  grad.addColorStop(1, 'rgba(255,250,200,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(heli.spotX, heli.spotY, 90, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(heli.x, heli.y);
  ctx.rotate(heli.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(10, 14, 26, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1b2a6b';
  ctx.beginPath();
  ctx.ellipse(0, 0, 24, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-8, -3, 16, 6);
  ctx.fillStyle = '#1b2a6b';
  ctx.font = 'bold 7px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('AIR', 0, 2);
  ctx.fillRect(-44, -2, 22, 4);
  // Rotor.
  ctx.strokeStyle = 'rgba(20,20,20,0.75)';
  ctx.lineWidth = 3;
  const rotor = time * 28;
  ctx.beginPath();
  ctx.moveTo(Math.cos(rotor) * -34, Math.sin(rotor) * -34);
  ctx.lineTo(Math.cos(rotor) * 34, Math.sin(rotor) * 34);
  ctx.moveTo(Math.cos(rotor + Math.PI / 2) * -34, Math.sin(rotor + Math.PI / 2) * -34);
  ctx.lineTo(Math.cos(rotor + Math.PI / 2) * 34, Math.sin(rotor + Math.PI / 2) * 34);
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.fillStyle = '#ffe600';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('AIR SUPPORT', heli.x, heli.y - 34);
  ctx.restore();
}

export function drawParticles(ctx, particles) {
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function drawTracers(ctx, tracers) {
  for (const t of tracers) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
    ctx.strokeStyle = t.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(t.x1, t.y1);
    ctx.lineTo(t.x2, t.y2);
    ctx.stroke();
    ctx.restore();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

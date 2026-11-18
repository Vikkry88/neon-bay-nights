// Neon Bay Nights — render.js
// One job: draw the world — ground, streets, beach, buildings, cars,
// pedestrians, police, particles, markers and the player.
(function () {
  'use strict';

  const NBN = window.NBN;
  const CFG = NBN.CFG;
  const PAL = NBN.PALETTE;

  function drawGround(ctx, cam, vw, vh) {
    const x0 = Math.max(0, cam.x - vw / 2 - 40);
    const y0 = Math.max(0, cam.y - vh / 2 - 40);
    const x1 = Math.min(CFG.WORLD, cam.x + vw / 2 + 40);
    const y1 = Math.min(CFG.WORLD, cam.y + vh / 2 + 40);
    // Grass base.
    ctx.fillStyle = PAL.grass;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    // Sand strip, then water.
    ctx.fillStyle = PAL.sand;
    ctx.fillRect(Math.max(x0, CFG.BEACH_X), y0, Math.min(x1, CFG.WATER_X) - Math.max(x0, CFG.BEACH_X), y1 - y0);
    ctx.fillStyle = PAL.water;
    ctx.fillRect(Math.max(x0, CFG.WATER_X), y0, x1 - Math.max(x0, CFG.WATER_X), y1 - y0);
    // Water shimmer lines.
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    const t = NBN.world.getState().time;
    for (let y = Math.floor(y0 / 90) * 90; y < y1; y += 90) {
      const off = Math.sin(t * 1.4 + y * 0.05) * 8;
      ctx.beginPath();
      ctx.moveTo(Math.max(x0, CFG.WATER_X) + 10, y + off);
      ctx.lineTo(x1, y + off);
      ctx.stroke();
    }
    // Streets: asphalt strips on the grid.
    ctx.fillStyle = PAL.road;
    for (let k = 0; k <= CFG.WORLD / CFG.GRID; k++) {
      const c = k * CFG.GRID;
      ctx.fillRect(x0, c - CFG.STREET / 2, x1 - x0, CFG.STREET);
      ctx.fillRect(c - CFG.STREET / 2, y0, CFG.STREET, y1 - y0);
    }
    // Sidewalk edges.
    ctx.fillStyle = PAL.sidewalk;
    for (let k = 0; k <= CFG.WORLD / CFG.GRID; k++) {
      const c = k * CFG.GRID;
      ctx.fillRect(x0, c - CFG.STREET / 2 - 6, x1 - x0, 6);
      ctx.fillRect(x0, c + CFG.STREET / 2, x1 - x0, 6);
      ctx.fillRect(c - CFG.STREET / 2 - 6, y0, 6, y1 - y0);
      ctx.fillRect(c + CFG.STREET / 2, y0, 6, y1 - y0);
    }
    // Center dashes.
    ctx.strokeStyle = PAL.roadLine;
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 30]);
    for (let k = 0; k <= CFG.WORLD / CFG.GRID; k++) {
      const c = k * CFG.GRID;
      ctx.beginPath();
      ctx.moveTo(x0, c);
      ctx.lineTo(x1, c);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(c, y0);
      ctx.lineTo(c, y1);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // Crosswalks at intersections.
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let kx = 1; kx < CFG.WORLD / CFG.GRID; kx++) {
      for (let ky = 1; ky < CFG.WORLD / CFG.GRID; ky++) {
        const cx = kx * CFG.GRID;
        const cy = ky * CFG.GRID;
        if (cx < x0 - 60 || cx > x1 + 60 || cy < y0 - 60 || cy > y1 + 60) continue;
        for (let i = -2; i <= 2; i++) {
          ctx.fillRect(cx + i * 14 - 4, cy - CFG.STREET / 2 + 4, 8, 14);
          ctx.fillRect(cx + i * 14 - 4, cy + CFG.STREET / 2 - 18, 8, 14);
        }
      }
    }
  }

  function drawParksAndTrees(ctx, cam, vw, vh) {
    const S = NBN.world.getState();
    // Parks: softer grass + a pond.
    ctx.fillStyle = PAL.parkGrass;
    for (const key of ['1,2', '5,5', '2,6']) {
      const [cx, cy] = key.split(',').map(Number);
      const x0 = cx * CFG.GRID + CFG.STREET / 2;
      const y0 = cy * CFG.GRID + CFG.STREET / 2;
      ctx.fillRect(x0, y0, CFG.GRID - CFG.STREET, CFG.GRID - CFG.STREET);
    }
    // Trees.
    for (const tr of NBN.city.trees) {
      if (Math.abs(tr.x - cam.x) > vw / 2 + 60 || Math.abs(tr.y - cam.y) > vh / 2 + 60) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(tr.x + 4, tr.y + 5, tr.r, tr.r * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2f7a33';
      ctx.beginPath();
      ctx.arc(tr.x, tr.y, tr.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4caf50';
      ctx.beginPath();
      ctx.arc(tr.x - 3, tr.y - 3, tr.r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    // Boardwalk lamps.
    for (const l of NBN.city.lamps) {
      if (Math.abs(l.x - cam.x) > vw / 2 + 40 || Math.abs(l.y - cam.y) > vh / 2 + 40) continue;
      ctx.fillStyle = '#222';
      ctx.fillRect(l.x - 2, l.y - 8, 4, 16);
      ctx.fillStyle = '#ffe14d';
      ctx.beginPath();
      ctx.arc(l.x, l.y - 10, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Traffic lights.
    const t = S.time;
    for (const l of NBN.city.lights) {
      if (Math.abs(l.x - cam.x) > vw / 2 + 40 || Math.abs(l.y - cam.y) > vh / 2 + 40) continue;
      const ewGreen = NBN.city.lightGreen(l, t);
      ctx.fillStyle = '#1c1c22';
      ctx.fillRect(l.x - 16, l.y - 16, 10, 26);
      ctx.fillStyle = ewGreen ? '#37e05c' : '#e03737';
      ctx.beginPath();
      ctx.arc(l.x - 11, l.y - 9, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ewGreen ? '#e03737' : '#37e05c';
      ctx.beginPath();
      ctx.arc(l.x - 11, l.y + 1, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBuildings(ctx, cam, vw, vh) {
    for (const b of NBN.city.buildings) {
      if (b.x + b.w < cam.x - vw / 2 - 60 || b.x > cam.x + vw / 2 + 60 || b.y + b.h < cam.y - vh / 2 - 60 || b.y > cam.y + vh / 2 + 60) continue;
      // Drop shadow for a little height.
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(b.x + 8, b.y + 10, b.w, b.h);
      ctx.fillStyle = b.wall;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
      // Windows.
      ctx.fillStyle = 'rgba(255,240,180,0.5)';
      const stepX = 26;
      const stepY = 24;
      for (let wx = b.x + 16; wx < b.x + b.w - 14; wx += stepX) {
        for (let wy = b.y + 16; wy < b.y + b.h - 14; wy += stepY) {
          ctx.fillRect(wx, wy, 10, 8);
        }
      }
      // Neon sign on some roofs.
      if (b.neon && b.sign) {
        ctx.fillStyle = b.neon;
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('NEON', b.x + b.w / 2, b.y + b.h / 2);
      }
    }
  }

  function drawPlaces(ctx) {
    const P = NBN.PLACES;
    const M = NBN.missions.getState();
    const label = (x, y, text, color) => {
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      const w = ctx.measureText(text).width + 16;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(x - w / 2, y - 34, w, 20);
      ctx.fillStyle = color;
      ctx.fillText(text, x, y - 20);
    };
    // Garage zone.
    ctx.strokeStyle = '#ffe14d';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.strokeRect(P.garage.x - 55, P.garage.y - 45, 110, 90);
    ctx.setLineDash([]);
    label(P.garage.x, P.garage.y - 50, 'GARAGE', '#ffe14d');
    // Safehouse.
    ctx.strokeStyle = '#7CFF6B';
    ctx.strokeRect(P.safehouse.x - 45, P.safehouse.y - 45, 90, 90);
    label(P.safehouse.x, P.safehouse.y - 50, 'SAFEHOUSE', '#7CFF6B');
    // Salt Air bar on the beach.
    ctx.fillStyle = '#c96a3b';
    ctx.fillRect(P.saltAirBar.x - 40, P.saltAirBar.y - 26, 80, 52);
    ctx.fillStyle = '#22e6ff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SALT AIR', P.saltAirBar.x, P.saltAirBar.y + 4);
    // Bay Trust vault.
    ctx.fillStyle = '#8a6d3b';
    ctx.fillRect(P.vault.x - 44, P.vault.y - 30, 88, 60);
    ctx.fillStyle = '#ffe14d';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('BAY TRUST', P.vault.x, P.vault.y + 4);
    // Pistol pickup.
    const S = NBN.world.getState();
    if (!S.pistolTaken) {
      const bob = Math.sin(S.time * 3) * 3;
      ctx.fillStyle = '#222';
      ctx.fillRect(P.pistolPickup.x - 12, P.pistolPickup.y - 4 + bob, 24, 8);
      ctx.fillStyle = '#ffe14d';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('PISTOL', P.pistolPickup.x, P.pistolPickup.y - 12 + bob);
    }
    // Mission target beacon.
    if (M.active && M.active.target) {
      const t = M.active.target;
      const pulse = 1 + Math.sin(S.time * 4) * 0.12;
      ctx.strokeStyle = '#ff2e88';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 34 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ff2e88';
      ctx.beginPath();
      ctx.moveTo(t.x, t.y - 52);
      ctx.lineTo(t.x - 10, t.y - 30);
      ctx.lineTo(t.x + 10, t.y - 30);
      ctx.closePath();
      ctx.fill();
      label(t.x, t.y - 58, M.active.target.label.toUpperCase(), '#ff2e88');
    }
  }

  function drawCar(ctx, c) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-CFG.CAR_LENGTH / 2 + 3, -CFG.CAR_WIDTH / 2 + 4, CFG.CAR_LENGTH, CFG.CAR_WIDTH);
    // Body.
    ctx.fillStyle = c.color;
    ctx.beginPath();
    ctx.roundRect(-CFG.CAR_LENGTH / 2, -CFG.CAR_WIDTH / 2, CFG.CAR_LENGTH, CFG.CAR_WIDTH, 7);
    ctx.fill();
    // Cabin + windshield.
    ctx.fillStyle = 'rgba(20,30,45,0.85)';
    ctx.beginPath();
    ctx.roundRect(-8, -CFG.CAR_WIDTH / 2 + 4, 16, CFG.CAR_WIDTH - 8, 4);
    ctx.fill();
    // Headlights / taillights.
    ctx.fillStyle = '#fff8c0';
    ctx.fillRect(CFG.CAR_LENGTH / 2 - 3, -CFG.CAR_WIDTH / 2 + 3, 3, 5);
    ctx.fillRect(CFG.CAR_LENGTH / 2 - 3, CFG.CAR_WIDTH / 2 - 8, 3, 5);
    ctx.fillStyle = '#ff3b30';
    ctx.fillRect(-CFG.CAR_LENGTH / 2, -CFG.CAR_WIDTH / 2 + 3, 3, 5);
    ctx.fillRect(-CFG.CAR_LENGTH / 2, CFG.CAR_WIDTH / 2 - 8, 3, 5);
    // Police livery + light bar.
    if (c.kind === 'police') {
      ctx.fillStyle = '#f2f2f2';
      ctx.fillRect(-CFG.CAR_LENGTH / 2 + 8, -CFG.CAR_WIDTH / 2, CFG.CAR_LENGTH - 16, 5);
      const t = NBN.world.getState().time;
      const red = Math.sin(t * 10) > 0;
      ctx.fillStyle = red ? '#ff2e2e' : '#2e7bff';
      ctx.fillRect(-4, -CFG.CAR_WIDTH / 2 - 3, 8, 5);
      ctx.fillStyle = red ? '#2e7bff' : '#ff2e2e';
      ctx.fillRect(4, -CFG.CAR_WIDTH / 2 - 3, 8, 5);
      ctx.fillStyle = '#111';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('BAY PD', 0, 3);
    }
    // Damage smoke.
    if (c.health < 45) {
      ctx.fillStyle = 'rgba(60,60,60,0.6)';
      ctx.beginPath();
      ctx.arc(-CFG.CAR_LENGTH / 2 + 6, 0, 6 + Math.random() * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // Health bar for the player's car.
    if (c.kind === 'player' && c.health < 100) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(c.x - 24, c.y - 34, 48, 6);
      ctx.fillStyle = c.health > 30 ? '#7CFF6B' : '#ff3b30';
      ctx.fillRect(c.x - 23, c.y - 33, 46 * (c.health / 100), 4);
    }
  }

  function drawPed(ctx, pd) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(pd.x + 2, pd.y + 3, 9, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pd.color;
    ctx.beginPath();
    ctx.arc(pd.x, pd.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2c89b';
    ctx.beginPath();
    ctx.arc(pd.x + Math.cos(pd.angle) * 3, pd.y + Math.sin(pd.angle) * 3, 5, 0, Math.PI * 2);
    ctx.fill();
    if (pd.panic > 0) {
      ctx.fillStyle = '#ff3b30';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', pd.x, pd.y - 14);
    }
  }

  function drawPlayer(ctx, p) {
    if (p.inCar) return; // the car drawing covers the driver
    const blink = p.invuln > 0 && Math.floor(p.invuln * 8) % 2 === 0;
    if (blink) return; // spawn-protection blink
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(p.x + 2, p.y + 4, 12, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body: teal jacket, dark jeans — the driver for hire.
    ctx.fillStyle = '#1f8a8a';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2c89b';
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(p.angle) * 5, p.y + Math.sin(p.angle) * 5, 7, 0, Math.PI * 2);
    ctx.fill();
    // Aim direction tick.
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(p.angle) * 12, p.y + Math.sin(p.angle) * 12);
    ctx.lineTo(p.x + Math.cos(p.angle) * 22, p.y + Math.sin(p.angle) * 22);
    ctx.stroke();
    if (p.hasPistol) {
      ctx.fillStyle = '#222';
      ctx.fillRect(p.x + Math.cos(p.angle) * 14 - 3, p.y + Math.sin(p.angle) * 14 - 2, 8, 4);
    }
  }

  function drawWorld(ctx, cam, vw, vh) {
    const S = NBN.world.getState();
    drawGround(ctx, cam, vw, vh);
    drawParksAndTrees(ctx, cam, vw, vh);
    drawPlaces(ctx);
    drawBuildings(ctx, cam, vw, vh);
    // Rico marker (mission 3, stage 0).
    const M = NBN.missions.getState();
    if (M.active && M.active.def.id === 3 && M.active.stage === 0) {
      const r = NBN.PLACES.ricoPickup;
      ctx.fillStyle = '#5cb8ff';
      ctx.beginPath();
      ctx.arc(r.x, r.y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('RICO', r.x, r.y - 16);
    }
    // Guards.
    for (const g of S.guards) {
      if (g.hp <= 0) continue;
      ctx.fillStyle = '#3a3a44';
      ctx.beginPath();
      ctx.arc(g.x, g.y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff3b30';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('GUARD', g.x, g.y - 16);
    }
    // Foot cops.
    for (const c of S.cops) {
      ctx.fillStyle = '#1c2a4a';
      ctx.beginPath();
      ctx.arc(c.x, c.y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#9db8ff';
      ctx.beginPath();
      ctx.arc(c.x, c.y - 3, 6, 0, Math.PI * 2);
      ctx.fill();
      if (c.arrest > 0) {
        ctx.fillStyle = '#ff3b30';
        ctx.fillRect(c.x - 15, c.y - 26, 30, 5);
        ctx.fillStyle = '#ffe14d';
        ctx.fillRect(c.x - 14, c.y - 25, 28 * (c.arrest / CFG.ARREST_SECONDS), 3);
      }
    }
    // Pedestrians.
    for (const pd of S.peds) drawPed(ctx, pd);
    // Cars, sorted so the player's car draws last.
    const cars = S.cars.slice().sort((a, b) => (a.kind === 'player' ? 1 : 0) - (b.kind === 'player' ? 1 : 0));
    for (const c of cars) drawCar(ctx, c);
    // Bullets.
    ctx.fillStyle = '#ffe14d';
    for (const b of S.bullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Particles.
    for (const pt of S.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.max);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;
    // Floating text.
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    for (const f of S.floats) {
      ctx.globalAlpha = Math.max(0, f.life / 1.4);
      ctx.fillStyle = f.color;
      ctx.fillText(f.txt, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    drawPlayer(ctx, S.player);
    // Steal prompt.
    if (!S.player.inCar && !S.over) {
      const car = NBN.world.nearestCar(CFG.STEAL_RADIUS);
      if (car) {
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        const txt = car.coupe ? 'Press E — steal the yellow coupe' : 'Press E — steal car';
        ctx.font = 'bold 14px sans-serif';
        const w = ctx.measureText(txt).width + 20;
        ctx.fillRect(car.x - w / 2, car.y - 52, w, 24);
        ctx.fillStyle = '#ffe14d';
        ctx.fillText(txt, car.x, car.y - 35);
      }
    }
  }

  NBN.render = { drawWorld };
})();

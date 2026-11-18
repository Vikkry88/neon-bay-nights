// Neon Bay Nights — minimap.js
// One job: the live minimap — streets, beach, player, police, mission
// marker, traffic and the pistol pickup.
(function () {
  'use strict';

  const NBN = window.NBN;
  const CFG = NBN.CFG;

  const SIZE = 190;
  const SCALE = SIZE / CFG.WORLD;

  function drawMinimap(ctx, vw, vh) {
    const S = NBN.world.getState();
    const M = NBN.missions.getState();
    // Inset from the viewport edges so the frame is never clipped by the
    // letterbox: the old 16px margin sat flush against the right edge.
    const x0 = vw - SIZE - 28;
    const y0 = vh - SIZE - 28;

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x0 - 6, y0 - 6, SIZE + 12, SIZE + 12);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, SIZE, SIZE);
    ctx.clip();
    // Land, beach, water.
    ctx.fillStyle = '#3f6b34';
    ctx.fillRect(x0, y0, SIZE, SIZE);
    ctx.fillStyle = '#c9b078';
    ctx.fillRect(x0 + CFG.BEACH_X * SCALE, y0, (CFG.WATER_X - CFG.BEACH_X) * SCALE, SIZE);
    ctx.fillStyle = '#2e7fa8';
    ctx.fillRect(x0 + CFG.WATER_X * SCALE, y0, SIZE - CFG.WATER_X * SCALE, SIZE);
    // Streets.
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 2;
    for (let k = 0; k <= CFG.WORLD / CFG.GRID; k++) {
      const c = k * CFG.GRID * SCALE;
      ctx.beginPath();
      ctx.moveTo(x0, y0 + c);
      ctx.lineTo(x0 + SIZE, y0 + c);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x0 + c, y0);
      ctx.lineTo(x0 + c, y0 + SIZE);
      ctx.stroke();
    }
    // Buildings as faint blocks.
    ctx.fillStyle = 'rgba(220,220,220,0.35)';
    for (const b of NBN.city.buildings) {
      ctx.fillRect(x0 + b.x * SCALE, y0 + b.y * SCALE, Math.max(1, b.w * SCALE), Math.max(1, b.h * SCALE));
    }
    // Mission marker, in the target's own colour (same as its beacon ring).
    if (M.active && M.active.target) {
      const t = M.active.target;
      ctx.fillStyle = t.color || '#ff2e88';
      ctx.beginPath();
      ctx.arc(x0 + t.x * SCALE, y0 + t.y * SCALE, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Police as big blue dots with a white ring — never confused with traffic.
    for (const c of S.cars) {
      if (c.kind !== 'police') continue;
      ctx.fillStyle = '#2e7bff';
      ctx.beginPath();
      ctx.arc(x0 + c.x * SCALE, y0 + c.y * SCALE, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Traffic as pale dots so the player can spot a car to steal.
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (const c of S.cars) {
      if (c.kind !== 'traffic') continue;
      ctx.beginPath();
      ctx.arc(x0 + c.x * SCALE, y0 + c.y * SCALE, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Pistol pickup as a yellow diamond, until it is taken.
    if (!S.pistolTaken) {
      const pp = NBN.PLACES.pistolPickup;
      ctx.fillStyle = '#ffe14d';
      ctx.beginPath();
      ctx.moveTo(x0 + pp.x * SCALE, y0 + pp.y * SCALE - 5);
      ctx.lineTo(x0 + pp.x * SCALE + 5, y0 + pp.y * SCALE);
      ctx.lineTo(x0 + pp.x * SCALE, y0 + pp.y * SCALE + 5);
      ctx.lineTo(x0 + pp.x * SCALE - 5, y0 + pp.y * SCALE);
      ctx.closePath();
      ctx.fill();
    }
    // Player: white arrow.
    const p = S.player;
    ctx.save();
    ctx.translate(x0 + p.x * SCALE, y0 + p.y * SCALE);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
    // Frame label.
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('NEON BAY', x0, y0 - 10);
  }

  NBN.minimap = { drawMinimap };
})();

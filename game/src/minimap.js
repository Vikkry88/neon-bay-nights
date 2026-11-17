// The minimap: a small canvas drawn in the corner of the main canvas, showing the whole
// city at a glance — roads, the beach, the player arrow, the mission marker, police and
// enemies. North is up, like the world itself.

import { BEACH, PALETTE, ROAD_X, ROAD_Y, WORLD } from './config.js';

const MAP = { w: 190, h: 140, x: 16, y: 0 }; // y is set from the canvas height at draw time.

export function drawMinimap(ctx, state, viewHeight) {
  const sx = MAP.w / WORLD.width;
  const sy = MAP.h / WORLD.height;
  const x0 = MAP.x;
  const y0 = viewHeight - MAP.h - 16;
  ctx.save();
  ctx.fillStyle = 'rgba(16, 22, 35, 0.85)';
  ctx.fillRect(x0 - 4, y0 - 4, MAP.w + 8, MAP.h + 8);
  ctx.strokeStyle = PALETTE.panelBorder;
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 - 4, y0 - 4, MAP.w + 8, MAP.h + 8);
  // Land, beach and sea.
  ctx.fillStyle = '#5d8a4f';
  ctx.fillRect(x0, y0, MAP.w, MAP.h);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(x0, y0 + BEACH.sandTop * sy, MAP.w, (BEACH.waterTop - BEACH.sandTop) * sy);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(x0, y0 + BEACH.waterTop * sy, MAP.w, MAP.h - BEACH.waterTop * sy);
  // Roads.
  ctx.strokeStyle = '#3c414d';
  ctx.lineWidth = 3;
  for (const rx of ROAD_X) {
    ctx.beginPath();
    ctx.moveTo(x0 + rx * sx, y0);
    ctx.lineTo(x0 + rx * sx, y0 + MAP.h);
    ctx.stroke();
  }
  for (const ry of ROAD_Y) {
    ctx.beginPath();
    ctx.moveTo(x0, y0 + ry * sy);
    ctx.lineTo(x0 + MAP.w, y0 + ry * sy);
    ctx.stroke();
  }
  const dot = (wx, wy, color, r) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x0 + wx * sx, y0 + wy * sy, r, 0, Math.PI * 2);
    ctx.fill();
  };
  // Mission marker, pulsing.
  const target = state.mission.target();
  if (target) {
    const pulse = 4 + Math.sin(state.time * 5) * 1.5;
    dot(target.x, target.y, PALETTE.marker, pulse);
    ctx.strokeStyle = PALETTE.marker;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x0 + target.x * sx, y0 + target.y * sy, pulse + 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Target car (the repo coupe) gets its own marker.
  if (state.targetCar) dot(state.targetCar.x, state.targetCar.y, '#f2b134', 4);
  // Police in blue, enemies in red, the pickup in gold.
  for (const cop of state.policeCars) dot(cop.x, cop.y, '#4cc9f0', 3);
  for (const cop of state.footCops) dot(cop.x, cop.y, '#4cc9f0', 2.5);
  for (const e of state.enemies) dot(e.x, e.y, '#ef476f', 3);
  // Player arrow, pointing the way the player faces.
  const p = state.player;
  const px = x0 + p.x * sx;
  const py = y0 + p.y * sy;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

// Drawing only: the world's state and the current screen in, pixels out. A 1280x720
// camera view follows the player through Neon Bay, scaled to fit the window and centred,
// the margin filled with the backdrop colour. Flat shapes and canvas text; the HUD lives
// in hud.js and the minimap in minimap.js.

import { BEACH, FONT, PALETTE, ROAD_HALF, ROAD_X, ROAD_Y, WORLD } from './config.js';
import { lightState } from './city.js';
import { drawHud } from './hud.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const VIEW_W = 1280;
const VIEW_H = 720;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function font(size) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    return fonts.get(size);
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW_W, height / VIEW_H);
    view.x = (width - VIEW_W * view.scale) / 2;
    view.y = (height - VIEW_H * view.scale) / 2;
  }

  function text(value, x, y, size, color, align) {
    context.font = font(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function drawGround(state) {
    const city = state.city;
    // Grass base.
    context.fillStyle = PALETTE.grass;
    context.fillRect(0, 0, WORLD.width, WORLD.height);
    // Mown stripes for a little texture.
    context.fillStyle = PALETTE.grassDark;
    for (let y = 0; y < WORLD.height; y += 160) {
      context.fillRect(0, y, WORLD.width, 80);
    }
    // Parks.
    for (const park of city.parks) {
      context.fillStyle = PALETTE.park;
      context.fillRect(park.x, park.y, park.w, park.h);
      context.strokeStyle = '#d8c9a3';
      context.lineWidth = 6;
      context.strokeRect(park.x + 10, park.y + 10, park.w - 20, park.h - 20);
    }
    // Beach and sea.
    context.fillStyle = PALETTE.sand;
    context.fillRect(0, BEACH.sandTop, WORLD.width, BEACH.waterTop - BEACH.sandTop);
    context.fillStyle = PALETTE.water;
    context.fillRect(0, BEACH.waterTop, WORLD.width, WORLD.height - BEACH.waterTop);
    context.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    context.lineWidth = 3;
    for (let i = 0; i < 5; i += 1) {
      const wy = BEACH.waterTop + 18 + i * 16 + Math.sin(state.time * 1.2 + i * 1.7) * 4;
      context.beginPath();
      context.moveTo(0, wy);
      for (let x = 0; x <= WORLD.width; x += 120) {
        context.lineTo(x, wy + Math.sin(x / 140 + state.time + i) * 3);
      }
      context.stroke();
    }
    // Roads: sidewalk edge, asphalt, centre dashes.
    for (const rx of ROAD_X) {
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(rx - ROAD_HALF - 10, 0, ROAD_HALF * 2 + 20, BEACH.sandTop);
      context.fillStyle = PALETTE.road;
      context.fillRect(rx - ROAD_HALF, 0, ROAD_HALF * 2, BEACH.sandTop);
    }
    for (const ry of ROAD_Y) {
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(0, ry - ROAD_HALF - 10, WORLD.width, ROAD_HALF * 2 + 20);
      context.fillStyle = PALETTE.road;
      context.fillRect(0, ry - ROAD_HALF, WORLD.width, ROAD_HALF * 2);
    }
    context.fillStyle = PALETTE.roadLine;
    for (const rx of ROAD_X) {
      for (let y = 0; y < BEACH.sandTop; y += 64) {
        let inCrossing = false;
        for (const ry of ROAD_Y) if (Math.abs(y + 16 - ry) < ROAD_HALF + 10) inCrossing = true;
        if (!inCrossing) context.fillRect(rx - 2, y, 4, 32);
      }
    }
    for (const ry of ROAD_Y) {
      for (let x = 0; x < WORLD.width; x += 64) {
        let inCrossing = false;
        for (const rx of ROAD_X) if (Math.abs(x + 16 - rx) < ROAD_HALF + 10) inCrossing = true;
        if (!inCrossing) context.fillRect(x, ry - 2, 32, 4);
      }
    }
    // Crosswalks at intersections.
    context.fillStyle = 'rgba(244, 241, 232, 0.75)';
    for (const rx of ROAD_X) {
      for (const ry of ROAD_Y) {
        for (let i = -3; i <= 3; i += 1) {
          context.fillRect(rx + i * 12 - 4, ry - ROAD_HALF + 6, 8, 10);
          context.fillRect(rx + i * 12 - 4, ry + ROAD_HALF - 16, 8, 10);
        }
      }
    }
  }

  function drawBuildings(state) {
    for (const b of state.city.buildings) {
      context.fillStyle = 'rgba(0, 0, 0, 0.18)';
      context.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      context.fillStyle = b.color;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = b.roof;
      context.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
      context.fillStyle = 'rgba(255, 255, 255, 0.35)';
      const cols = Math.max(1, Math.floor(b.w / 34));
      const rows = Math.max(1, Math.floor(b.h / 34));
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          context.fillRect(b.x + 14 + c * 34, b.y + 14 + r * 34, 12, 12);
        }
      }
    }
    // Palms: trunk dot and a green crown.
    for (const palm of state.city.palms) {
      context.fillStyle = '#7a5a3a';
      context.beginPath();
      context.arc(palm.x, palm.y, 3, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.palm;
      context.beginPath();
      context.arc(palm.x, palm.y, 11, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#57a86a';
      context.beginPath();
      context.arc(palm.x - 4, palm.y - 4, 6, 0, Math.PI * 2);
      context.fill();
    }
    // Traffic lights at intersections.
    for (const light of state.city.lights) {
      const green = lightState(light, state.time) === 'green';
      context.fillStyle = '#22252c';
      context.fillRect(light.x + ROAD_HALF - 4, light.y + ROAD_HALF - 4, 8, 8);
      context.fillStyle = green ? '#06d6a0' : '#ef476f';
      context.beginPath();
      context.arc(light.x + ROAD_HALF, light.y + ROAD_HALF, 4, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawCar(car, isPlayerCar, time) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    // Shadow.
    context.fillStyle = 'rgba(0, 0, 0, 0.25)';
    roundRect(context, -26 + 3, -13 + 4, 52, 26, 8);
    context.fill();
    // Body.
    context.fillStyle = car.color;
    roundRect(context, -26, -13, 52, 26, 8);
    context.fill();
    // Roof and windshield.
    context.fillStyle = 'rgba(20, 30, 45, 0.85)';
    roundRect(context, -8, -10, 16, 20, 4);
    context.fill();
    context.fillStyle = 'rgba(180, 220, 240, 0.9)';
    context.fillRect(8, -10, 6, 20);
    // Headlights.
    context.fillStyle = '#fff8c9';
    context.fillRect(24, -10, 3, 5);
    context.fillRect(24, 5, 3, 5);
    // Brake lights.
    context.fillStyle = '#ef476f';
    context.fillRect(-27, -10, 3, 5);
    context.fillRect(-27, 5, 3, 5);
    if (car.kind === 'police') {
      context.fillStyle = '#f4f1e8';
      context.fillRect(-4, -13, 12, 26);
      const flash = Math.floor(time * 6) % 2 === 0;
      context.fillStyle = flash ? '#ef476f' : '#4cc9f0';
      context.beginPath();
      context.arc(-2, -6, 4, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = flash ? '#4cc9f0' : '#ef476f';
      context.beginPath();
      context.arc(-2, 6, 4, 0, Math.PI * 2);
      context.fill();
    }
    if (car.kind === 'target') {
      context.strokeStyle = PALETTE.marker;
      context.lineWidth = 3;
      roundRect(context, -28, -15, 56, 30, 9);
      context.stroke();
    }
    if (isPlayerCar) {
      context.strokeStyle = '#ffffff';
      context.lineWidth = 2;
      roundRect(context, -28, -15, 56, 30, 9);
      context.stroke();
    }
    context.restore();
    if (car.smoke > 0) {
      context.fillStyle = 'rgba(60, 65, 77, 0.5)';
      context.beginPath();
      context.arc(car.x - Math.cos(car.angle) * 22, car.y - Math.sin(car.angle) * 22, 8 + Math.sin(time * 9) * 2, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawPed(ped) {
    const bob = ped.down ? 0 : Math.sin(ped.walkPhase) * 2;
    context.save();
    context.translate(ped.x, ped.y + bob);
    if (ped.down) {
      context.rotate(Math.PI / 2);
      context.fillStyle = ped.color;
      context.beginPath();
      context.ellipse(0, 0, 14, 7, 0, 0, Math.PI * 2);
      context.fill();
    } else {
      context.fillStyle = 'rgba(0, 0, 0, 0.2)';
      context.beginPath();
      context.ellipse(0, 2, 10, 5, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = ped.color;
      context.beginPath();
      context.arc(0, 0, 10, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#f2c9a0';
      context.beginPath();
      context.arc(0, 0, 5, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  function drawPlayer(state) {
    const p = state.player;
    if (p.car) return;
    // Blink while invulnerable after a hit or at spawn.
    if (p.invulnerable > 0 && Math.floor(state.time * 10) % 2 === 0) return;
    const bob = p.moving ? Math.sin(p.walkPhase) * 2 : 0;
    context.save();
    context.translate(p.x, p.y + bob);
    context.fillStyle = 'rgba(0, 0, 0, 0.25)';
    context.beginPath();
    context.ellipse(0, 4, 12, 6, 0, 0, Math.PI * 2);
    context.fill();
    context.rotate(p.angle);
    // Body and head.
    context.fillStyle = PALETTE.playerShirt;
    context.beginPath();
    context.arc(0, 0, 12, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#f2c9a0';
    context.beginPath();
    context.arc(2, 0, 6, 0, Math.PI * 2);
    context.fill();
    // Gun or fist in front.
    context.fillStyle = p.hasPistol ? '#22252c' : '#f2c9a0';
    context.fillRect(10, -3, 10, 6);
    context.restore();
    // Spawn protection ring.
    if (p.invulnerable > 0.5) {
      context.strokeStyle = 'rgba(255, 209, 102, 0.7)';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(p.x, p.y, 20 + Math.sin(state.time * 6) * 3, 0, Math.PI * 2);
      context.stroke();
    }
  }

  function drawMarker(state) {
    const target = state.mission.target();
    if (!target) return;
    const bounce = Math.sin(state.time * 4) * 6;
    context.save();
    context.translate(target.x, target.y + bounce - 30);
    context.fillStyle = PALETTE.marker;
    context.beginPath();
    context.moveTo(0, -16);
    context.lineTo(12, 0);
    context.lineTo(0, 16);
    context.lineTo(-12, 0);
    context.closePath();
    context.fill();
    context.fillStyle = '#101623';
    context.beginPath();
    context.arc(0, 0, 4, 0, Math.PI * 2);
    context.fill();
    context.restore();
    // Ground ring.
    context.strokeStyle = 'rgba(255, 209, 102, 0.8)';
    context.lineWidth = 3;
    context.beginPath();
    context.ellipse(target.x, target.y, 30, 14, 0, 0, Math.PI * 2);
    context.stroke();
  }

  function drawWorld(state) {
    const cam = state.camera;
    const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    context.save();
    context.translate(VIEW_W / 2 - cam.x - shakeX, VIEW_H / 2 - cam.y - shakeY);
    drawGround(state);
    drawBuildings(state);
    // Pistol pickup.
    for (const pickup of state.pickups) {
      if (pickup.taken) continue;
      const pulse = 1 + Math.sin(state.time * 5) * 0.15;
      context.save();
      context.translate(pickup.x, pickup.y);
      context.scale(pulse, pulse);
      context.fillStyle = PALETTE.gold;
      context.beginPath();
      context.arc(0, 0, 12, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#101623';
      context.font = font(14);
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText('P', 0, 1);
      context.restore();
    }
    drawMarker(state);
    for (const car of state.cars) {
      if (!car.dead) drawCar(car, car === state.player.car, state.time);
    }
    for (const cop of state.policeCars) drawCar(cop, false, state.time);
    for (const ped of state.peds) drawPed(ped);
    for (const e of state.enemies) {
      context.save();
      context.translate(e.x, e.y);
      context.fillStyle = 'rgba(0, 0, 0, 0.25)';
      context.beginPath();
      context.ellipse(0, 4, 11, 5, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#8b2f3c';
      context.beginPath();
      context.arc(0, 0, 11, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#f2c9a0';
      context.beginPath();
      context.arc(0, 0, 5, 0, Math.PI * 2);
      context.fill();
      // Health bar.
      context.fillStyle = 'rgba(16, 22, 35, 0.7)';
      context.fillRect(-14, -24, 28, 5);
      context.fillStyle = PALETTE.red;
      context.fillRect(-14, -24, 28 * Math.max(0, e.health / 50), 5);
      context.restore();
    }
    for (const cop of state.footCops) {
      context.save();
      context.translate(cop.x, cop.y);
      context.fillStyle = PALETTE.cop;
      context.beginPath();
      context.arc(0, 0, 11, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#f2c9a0';
      context.beginPath();
      context.arc(0, 0, 5, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#101623';
      context.beginPath();
      context.arc(0, 0, 11, 0, 0, Math.PI);
      context.fill();
      context.restore();
    }
    drawPlayer(state);
    // Bullets.
    for (const b of state.bullets) {
      context.strokeStyle = '#ffd166';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
      context.lineTo(b.x, b.y);
      context.stroke();
    }
    // Particles.
    for (const pt of state.particles) {
      context.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      context.fillStyle = pt.color;
      context.beginPath();
      context.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    context.restore();
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 640;
    const height = 150 + lines.length * 32 + 70;
    const x = (VIEW_W - width) / 2;
    const y = (VIEW_H - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, width, height);
    context.strokeStyle = accent || PALETTE.panelBorder;
    context.lineWidth = 2;
    context.strokeRect(x, y, width, height);
    context.textBaseline = 'alphabetic';
    text(title, VIEW_W / 2, y + 72, 44, PALETTE.text, 'center');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], VIEW_W / 2, y + 126 + i * 32, 20, PALETTE.muted, 'center');
    }
    text(prompt, VIEW_W / 2, y + height - 34, 22, PALETTE.gold, 'center');
  }

  /** Paint one frame: the world, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, extra) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    // Clip to the logical view so the world never paints over the margin.
    context.save();
    context.beginPath();
    context.rect(0, 0, VIEW_W, VIEW_H);
    context.clip();
    drawWorld(state);
    if (screen === SCREEN_TITLE) {
      context.fillStyle = 'rgba(16, 22, 35, 0.55)';
      context.fillRect(0, 0, VIEW_W, VIEW_H);
      const best = extra && extra.best ? extra.best : 0;
      drawPanel('NEON BAY NIGHTS', [
        'A sun-soaked coastal city. One fixer. Five jobs. The whole Bay PD.',
        'Steal cars, lose the cops, work for Marla Voss and get paid.',
        'WASD move & drive  •  Mouse aim  •  Click shoot  •  Space punch  •  E steal car',
        `Best cash: $${best.toLocaleString('en-US')}    •    Saved cash: $${(extra && extra.money ? extra.money : 0).toLocaleString('en-US')}`,
        '',
      ], 'Press Space or click to start', PALETTE.panelBorder);
    } else if (screen === SCREEN_PLAY) {
      drawHud(context, state, fonts);
      if (extra && extra.banner) {
        const b = extra.banner;
        context.textBaseline = 'alphabetic';
        text(b.title, VIEW_W / 2, 190, 40, b.color || PALETTE.gold, 'center');
        if (b.line) text(b.line, VIEW_W / 2, 228, 22, PALETTE.text, 'center');
      }
    } else if (screen === SCREEN_PAUSED) {
      drawHud(context, state, fonts);
      drawPanel('Paused', ['The city waits for you.', 'M — mute sound'], 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      drawHud(context, state, fonts);
      const wasted = state.over === 'wasted';
      drawPanel(wasted ? 'WASTED' : 'BUSTED', [
        wasted ? 'The streets of Neon Bay got the better of you.' : 'The Bay PD caught up with you.',
        `You lost $100 in hospital bills and fines. Cash: $${state.money.toLocaleString('en-US')}`,
        'Your completed jobs are saved — the next run keeps them.',
      ], 'Press Space or click to try again', wasted ? PALETTE.red : PALETTE.blue);
    }
    context.restore();
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, view };
}

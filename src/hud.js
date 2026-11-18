// Neon Bay Nights — hud.js
// One job: the HUD — wanted stars, cash, health, speed, objective text
// (with distance to the objective), messages, mission banners and the
// red damage vignette.
//
// Round 3 polish: the objective line shows how far away the target is,
// and the controls hint moved up under the HEALTH panel — it used to sit
// on top of the minimap in the bottom-right corner.
(function () {
  'use strict';

  const NBN = window.NBN;
  const CFG = NBN.CFG;

  function drawStars(ctx, wanted, x, y) {
    ctx.font = '26px sans-serif';
    ctx.textAlign = 'left';
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < wanted ? '#ffe14d' : 'rgba(255,255,255,0.25)';
      ctx.fillText('★', x + i * 28, y);
    }
  }

  function drawBar(ctx, x, y, w, h, frac, color, bg) {
    ctx.fillStyle = bg || 'rgba(0,0,0,0.6)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x + 2, y + 2, (w - 4) * NBN.clamp(frac, 0, 1), h - 4);
  }

  function drawHud(ctx, vw, vh) {
    const S = NBN.world.getState();
    const M = NBN.missions.getState();
    const p = S.player;

    // Top-left: wanted stars + cash.
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(14, 12, 210, 74);
    drawStars(ctx, p.wanted, 24, 40);
    ctx.fillStyle = '#7CFF6B';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`$${Math.floor(p.money).toLocaleString('en-US')}`, 24, 72);

    // Top-right: health + ammo.
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(vw - 224, 12, 210, 74);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('HEALTH', vw - 214, 32);
    drawBar(ctx, vw - 214, 38, 190, 12, p.health / CFG.PLAYER_HEALTH, p.health > 30 ? '#7CFF6B' : '#ff3b30');
    ctx.fillStyle = '#fff';
    ctx.fillText(p.hasPistol ? `PISTOL  ${p.ammo} rounds` : 'PISTOL — pickup by the garage', vw - 214, 72);

    // Controls hint, top-right under the HEALTH panel (it used to overlap
    // the minimap in the bottom-right corner).
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(vw - 300, 96, 286, 22);
    ctx.fillStyle = '#cfd2d8';
    ctx.font = '12px sans-serif';
    ctx.fillText('WASD drive · E steal · Space fight · P pause', vw - 292, 111);

    // Bottom-left: speed when driving.
    if (p.inCar) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(14, vh - 74, 150, 54);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText(`${Math.round(Math.abs(p.inCar.speed) * 0.22)} mph`, 26, vh - 42);
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#cfd2d8';
      ctx.fillText(`car ${Math.round(p.inCar.health)}%`, 26, vh - 26);
    }

    // Objective line, top-center — with the distance to the target.
    const obj = currentObjective();
    if (obj) {
      ctx.font = 'bold 15px sans-serif';
      const w = ctx.measureText(obj).width + 28;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect((vw - w) / 2, 12, w, 30);
      ctx.fillStyle = '#ffe14d';
      ctx.textAlign = 'center';
      ctx.fillText(obj, vw / 2, 32);
      ctx.textAlign = 'left';
    }

    // Mission timer.
    if (M.active && M.active.def.timeLimit) {
      const t = Math.max(0, M.active.timer);
      ctx.fillStyle = t < 15 ? '#ff3b30' : '#fff';
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.ceil(t)}s`, vw / 2, 78);
      ctx.textAlign = 'left';
    }

    // Toast message.
    if (S.messageT > 0 && S.message) {
      ctx.font = '15px sans-serif';
      const w = ctx.measureText(S.message).width + 28;
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect((vw - w) / 2, vh - 110, w, 30);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(S.message, vw / 2, vh - 90);
      ctx.textAlign = 'left';
    }

    // Mission banner (start / complete).
    if (M.banner) {
      const a = Math.min(1, M.banner.t);
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, vh / 2 - 70, vw, 110);
      ctx.fillStyle = '#ff2e88';
      ctx.font = 'bold 34px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(M.banner.title, vw / 2, vh / 2 - 26);
      ctx.fillStyle = '#fff';
      ctx.font = '16px sans-serif';
      ctx.fillText(M.banner.sub, vw / 2, vh / 2 + 6);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
    }

    // "Press Enter for the next job" hint.
    if (!M.active && !M.failed && M.index < NBN.MISSIONS.length && !S.over) {
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffe14d';
      ctx.fillText(`Press Enter — next job: ${NBN.MISSIONS[M.index].name} ($${NBN.MISSIONS[M.index].reward})`, vw / 2, vh - 150);
      ctx.textAlign = 'left';
    }
    if (!M.active && M.index >= NBN.MISSIONS.length && !S.over) {
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#7CFF6B';
      ctx.fillText('All jobs complete — Neon Bay is yours. Free roam!', vw / 2, vh - 150);
      ctx.textAlign = 'left';
    }

    // Damage vignette: a clear red flash so a hit is never silent.
    if (S.flash > 0) {
      const g = ctx.createRadialGradient(vw / 2, vh / 2, vh * 0.3, vw / 2, vh / 2, vh * 0.75);
      g.addColorStop(0, 'rgba(255,0,0,0)');
      g.addColorStop(1, `rgba(255,0,0,${0.55 * S.flash})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, vw, vh);
    }
  }

  function currentObjective() {
    const M = NBN.missions.getState();
    if (!M.active) return null;
    const m = M.active;
    const d = m.def;
    let text = `Mission ${d.id}: ${d.name} — ${d.hint}`;
    if (d.id === 3 && m.stage === 1) text = 'Mission 3: The Getaway — lose the cops, then reach the safehouse';
    if (d.id === 4 && m.stage === 1) text = 'Mission 4: Repo Man — deliver the coupe to the garage, over 30% condition';
    if (d.id === 5 && m.stage === 1) text = 'Mission 5: The Bay Trust Job — lose the Bay PD, reach the safehouse';
    // Distance to the objective, in meters (10 world px = 1 m).
    if (m.target) {
      const S = NBN.world.getState();
      const meters = Math.round(NBN.dist(S.player.x, S.player.y, m.target.x, m.target.y) / 10);
      text += `  ·  ${meters}m`;
    }
    return text;
  }

  NBN.hud = { drawHud, currentObjective };
})();

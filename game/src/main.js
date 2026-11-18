// Neon Bay Nights — main.js
// One job: the game loop and the screens — title, playing, pause,
// mission fail, WASTED / BUSTED — plus the camera and the boot sequence.
(function () {
  'use strict';

  const NBN = window.NBN;
  const CFG = NBN.CFG;

  let canvas = null;
  let ctx = null;
  let screen = 'title'; // title | playing | paused | failed | over
  let lastT = 0;
  let booted = false;
  let shotApplied = false;

  const camera = { x: 0, y: 0 };

  function resize() {
    canvas.width = CFG.VIEW_W;
    canvas.height = CFG.VIEW_H;
  }

  function boot() {
    if (booted) return;
    booted = true;
    canvas = document.getElementById('game');
    NBN.canvas = canvas;
    ctx = canvas.getContext('2d');
    resize();
    NBN.city.buildCity();
    const save = NBN.save.load();
    NBN.world.init(save);
    NBN.missions.initFromSave(save);
    const S = NBN.world.getState();
    camera.x = S.player.x;
    camera.y = S.player.y;
    window.addEventListener('mousedown', () => NBN.audio.unlock(), { once: true });
    window.addEventListener('keydown', () => NBN.audio.unlock(), { once: true });
    requestAnimationFrame(frame);
  }

  function startGame() {
    screen = 'playing';
    NBN.audio.unlock();
    NBN.audio.ensure();
    NBN.audio.startEngine();
    NBN.audio.startSiren();
    NBN.audio.startMusic();
    const S = NBN.world.getState();
    const M = NBN.missions.getState();
    if (!M.active && M.index < NBN.MISSIONS.length) {
      NBN.world.say('Press Enter to take your first job from Marla Voss.', 6);
    }
    // Screenshot staging runs once, right after the game starts.
    const shot = NBN.shots.shotParam();
    if (shot > 0 && !shotApplied) {
      shotApplied = true;
      NBN.shots.applyShot(shot);
      camera.x = S.player.x;
      camera.y = S.player.y;
    }
    // Signal to headless harnesses that the game has started and the
    // first playing frame is about to render.
    window.__NBN_READY__ = true;
  }

  function frame(t) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
    lastT = t;
    const S = NBN.world.getState();

    if (screen === 'title') {
      drawTitle();
      if (NBN.input.hit('Enter') || NBN.input.mouse.clicked) startGame();
      NBN.input.endFrame();
      return;
    }
    if (screen === 'playing') {
      if (NBN.input.hit('KeyP') || NBN.input.hit('Escape')) {
        screen = 'paused';
        NBN.input.endFrame();
        return;
      }
      if (NBN.input.hit('Enter')) NBN.missions.tryStartNext();
      NBN.world.update(dt);
      if (S.over) {
        screen = 'over';
        NBN.save.save(S);
      }
      const M = NBN.missions.getState();
      if (M.failed) screen = 'failed';
    } else if (screen === 'paused') {
      drawPaused();
      // Silence the engine hum and siren while paused — the world is not
      // updating, so the last gain would drone on forever otherwise.
      NBN.audio.setEngine(0, false);
      NBN.audio.setSiren(false);
      if (NBN.input.hit('KeyP') || NBN.input.hit('Escape') || NBN.input.hit('Enter')) screen = 'playing';
      NBN.input.endFrame();
      return;
    } else if (screen === 'failed') {
      drawFailed();
      const M = NBN.missions.getState();
      if (NBN.input.hit('Enter') || NBN.input.hit('KeyR')) {
        NBN.missions.retryFailed();
        screen = 'playing';
      }
      NBN.input.endFrame();
      return;
    } else if (screen === 'over') {
      drawOver();
      if (NBN.input.hit('Enter') || NBN.input.hit('KeyR')) {
        restart();
      }
      NBN.input.endFrame();
      return;
    }

    // Camera: smooth follow, clamped to the world so no void shows, plus shake.
    const p = S.player;
    camera.x = NBN.lerp(camera.x, p.x, Math.min(1, dt * 5));
    camera.y = NBN.lerp(camera.y, p.y, Math.min(1, dt * 5));
    const vw = canvas.width;
    const vh = canvas.height;
    camera.x = NBN.clamp(camera.x, vw / 2, CFG.WORLD - vw / 2);
    camera.y = NBN.clamp(camera.y, vh / 2, CFG.WORLD - vh / 2);
    const shx = S.shake > 0 ? (Math.random() - 0.5) * S.shake : 0;
    const shy = S.shake > 0 ? (Math.random() - 0.5) * S.shake : 0;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, vw, vh);
    ctx.save();
    ctx.translate(vw / 2 - camera.x + shx, vh / 2 - camera.y + shy);
    NBN.render.drawWorld(ctx, camera, vw, vh);
    ctx.restore();
    NBN.minimap.drawMinimap(ctx, vw, vh);
    NBN.hud.drawHud(ctx, vw, vh);
    NBN.input.endFrame();
  }

  function restart() {
    const S = NBN.world.getState();
    // Keep money and completed missions; respawn safe in the park.
    NBN.world.init({ money: S.player.money, missionsDone: S.missionsDone.slice(), bestWanted: S.bestWanted });
    NBN.missions.initFromSave({ missionsDone: S.missionsDone.slice() });
    const S2 = NBN.world.getState();
    camera.x = S2.player.x;
    camera.y = S2.player.y;
    screen = 'playing';
    NBN.world.say('Back on your feet. Neon Bay is still waiting.', 4);
  }

  function panel(title, lines, accent) {
    const vw = canvas.width;
    const vh = canvas.height;
    ctx.fillStyle = 'rgba(8,10,24,0.82)';
    ctx.fillRect(0, 0, vw, vh);
    ctx.fillStyle = accent;
    ctx.font = 'bold 52px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, vw / 2, vh / 2 - 60);
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    lines.forEach((ln, i) => ctx.fillText(ln, vw / 2, vh / 2 - 10 + i * 30));
    ctx.textAlign = 'left';
  }

  function drawTitle() {
    const vw = canvas.width;
    const vh = canvas.height;
    // Dusk gradient sky over the city silhouette.
    const g = ctx.createLinearGradient(0, 0, 0, vh);
    g.addColorStop(0, '#1b1035');
    g.addColorStop(0.55, '#c94b7a');
    g.addColorStop(1, '#ff9d5c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vw, vh);
    // City skyline.
    ctx.fillStyle = '#120a24';
    let x = 0;
    const rng = NBN.rng;
    while (x < vw) {
      const w = 60 + rng() * 90;
      const h = 120 + rng() * 180;
      ctx.fillRect(x, vh - h - 120, w, h + 120);
      x += w + 8;
    }
    // Neon windows.
    ctx.fillStyle = '#22e6ff';
    for (let i = 0; i < 40; i++) ctx.fillRect(rng() * vw, vh - 120 - rng() * 260, 6, 8);
    ctx.fillStyle = '#ff2e88';
    ctx.font = 'bold 84px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('NEON BAY', vw / 2, 210);
    ctx.fillStyle = '#ffe14d';
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText('NIGHTS', vw / 2, 258);
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.fillText('A driver for hire. Five jobs from Marla Voss. One city that never sleeps.', vw / 2, 320);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#cfd2d8';
    ctx.fillText('WASD move / drive · Mouse aim · E steal / exit car · Space fight · P pause · M mute', vw / 2, 380);
    const save = NBN.save.load();
    if (save && save.missionsDone.length > 0) {
      ctx.fillStyle = '#7CFF6B';
      ctx.fillText(`Welcome back — $${save.money} saved, ${save.missionsDone.length} of 5 jobs done.`, vw / 2, 420);
    }
    const blink = Math.floor(Date.now() / 500) % 2 === 0;
    if (blink) {
      ctx.fillStyle = '#ffe14d';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('Press Enter to start', vw / 2, 500);
    }
    ctx.textAlign = 'left';
  }

  function drawPaused() {
    panel('PAUSED', ['The city waits for no one — except now.', '', 'Enter / P — resume', 'M — mute'], '#22e6ff');
  }

  function drawFailed() {
    const M = NBN.missions.getState();
    const f = M.failed;
    panel('JOB FAILED', [f ? f.title : 'Mission failed', f ? f.reason : '', '', 'Enter — retry the job'], '#ff3b30');
  }

  function drawOver() {
    const S = NBN.world.getState();
    const title = S.over === 'busted' ? 'BUSTED' : 'WASTED';
    panel(title, [
      S.over === 'busted' ? 'The Bay PD caught up with you.' : 'Neon Bay got the better of you this time.',
      `Cash kept: $${Math.floor(S.player.money)} · Jobs done: ${S.missionsDone.length} of 5`,
      '',
      'Enter — back on your feet',
    ], '#ff3b30');
  }

  NBN.camera = camera;
  NBN.main = { boot, startGame };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

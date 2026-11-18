// Neon Bay Nights — input.js
// One job: keyboard + mouse state, with edge-triggered presses.
(function () {
  'use strict';

  const NBN = window.NBN;

  const keys = Object.create(null); // held keys, by code
  const pressed = Object.create(null); // keys pressed since last frame
  const mouse = { x: 0, y: 0, down: false, clicked: false };

  const GAME_KEYS = [
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space',
    'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyP', 'KeyM', 'ShiftLeft', 'ShiftRight',
  ];

  function onKeyDown(e) {
    if (GAME_KEYS.includes(e.code)) e.preventDefault();
    if (!keys[e.code]) pressed[e.code] = true;
    keys[e.code] = true;
    if (e.code === 'KeyM') NBN.audio.toggleMute();
  }
  function onKeyUp(e) {
    keys[e.code] = false;
  }
  function onMouseMove(e) {
    const c = NBN.canvas;
    if (!c) return;
    const r = c.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) * (c.width / r.width);
    mouse.y = (e.clientY - r.top) * (c.height / r.height);
  }
  function onMouseDown(e) {
    if (e.button === 0) {
      mouse.down = true;
      mouse.clicked = true;
    }
  }
  function onMouseUp(e) {
    if (e.button === 0) mouse.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('blur', () => {
    for (const k of Object.keys(keys)) keys[k] = false;
  });

  NBN.input = {
    keys,
    pressed,
    mouse,
    down(code) {
      return !!keys[code];
    },
    // True once, on the frame the key went down.
    hit(code) {
      return !!pressed[code];
    },
    axis() {
      // -1..1 movement axes from WASD / arrows.
      let x = 0;
      let y = 0;
      if (keys.KeyA || keys.ArrowLeft) x -= 1;
      if (keys.KeyD || keys.ArrowRight) x += 1;
      if (keys.KeyW || keys.ArrowUp) y -= 1;
      if (keys.KeyS || keys.ArrowDown) y += 1;
      return { x, y };
    },
    endFrame() {
      for (const k of Object.keys(pressed)) pressed[k] = false;
      mouse.clicked = false;
    },
  };
})();

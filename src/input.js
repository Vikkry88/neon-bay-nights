// Neon Bay Nights — keyboard + mouse input.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { x: 0, y: 0 };
    this.mouseDown = false;
    this.clicked = false;
    const map = {
      KeyW: 'up', ArrowUp: 'up',
      KeyS: 'down', ArrowDown: 'down',
      KeyA: 'left', ArrowLeft: 'left',
      KeyD: 'right', ArrowRight: 'right',
      KeyE: 'use',
      KeyP: 'pause', Escape: 'pause',
      Enter: 'enter', Space: 'handbrake',
      ShiftLeft: 'run', ShiftRight: 'run',
    };
    window.addEventListener('keydown', (e) => {
      const a = map[e.code];
      if (a) {
        if (!this.keys.has(a)) this.pressed.add(a);
        this.keys.add(a);
        if (['up', 'down', 'left', 'right', 'handbrake'].includes(a)) e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      const a = map[e.code];
      if (a) this.keys.delete(a);
    });
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
      this.mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouseDown = true; this.clicked = true; }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
    });
    canvas.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      const r = canvas.getBoundingClientRect();
      this.mouse.x = (t.clientX - r.left) * (canvas.width / r.width);
      this.mouse.y = (t.clientY - r.top) * (canvas.height / r.height);
      this.clicked = true;
    }, { passive: true });
  }
  down(a) { return this.keys.has(a); }
  consume(a) {
    if (this.pressed.has(a)) { this.pressed.delete(a); return true; }
    return false;
  }
}

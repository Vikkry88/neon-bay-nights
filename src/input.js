// Keyboard + mouse state, updated from DOM events.
export function createInput(canvas) {
  const keys = new Set();
  const state = {
    keys, mouseX: 640, mouseY: 360, mouseDown: false,
    pressed: new Set(),
    down(k) { return keys.has(k); },
    wasPressed(k) { return state.pressed.has(k); },
    endFrame() { state.pressed.clear(); },
  };
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (!keys.has(k)) state.pressed.add(k);
    keys.add(k);
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    state.mouseX = (e.clientX - r.left) * (canvas.width / r.width);
    state.mouseY = (e.clientY - r.top) * (canvas.height / r.height);
  });
  canvas.addEventListener('mousedown', () => { state.mouseDown = true; state.pressed.add('mouse'); });
  window.addEventListener('mouseup', () => { state.mouseDown = false; });
  return state;
}
export function axis(input) {
  let x = 0, y = 0;
  if (input.down('a') || input.down('arrowleft')) x -= 1;
  if (input.down('d') || input.down('arrowright')) x += 1;
  if (input.down('w') || input.down('arrowup')) y -= 1;
  if (input.down('s') || input.down('arrowdown')) y += 1;
  return { x, y };
}

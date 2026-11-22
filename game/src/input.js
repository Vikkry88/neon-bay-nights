// Keyboard + mouse input. Tracks held keys, one-shot presses, mouse aim and
// the weapon-wheel hold (Q). Everything is plain DOM events; no network.

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  const input = {
    held,
    pressed,
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    wheelHeld: false,
    anyKey: false,
  };

  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) event.preventDefault();
    if (!held.has(key)) pressed.add(key);
    held.add(key);
    input.anyKey = true;
    if (key === 'q') input.wheelHeld = true;
  });
  window.addEventListener('keyup', (event) => {
    const key = event.key.toLowerCase();
    held.delete(key);
    if (key === 'q') input.wheelHeld = false;
  });
  window.addEventListener('blur', () => {
    held.clear();
    input.mouseDown = false;
    input.wheelHeld = false;
  });
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = (event.clientX - rect.left) * (canvas.width / rect.width);
    input.mouseY = (event.clientY - rect.top) * (canvas.height / rect.height);
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) input.mouseDown = true;
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) input.mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return input;
}

// Call once per frame after the game has read `pressed`.
export function clearPressed(input) {
  input.pressed.clear();
}

export function axisX(input) {
  let x = 0;
  if (input.held.has('a') || input.held.has('arrowleft')) x -= 1;
  if (input.held.has('d') || input.held.has('arrowright')) x += 1;
  return x;
}

export function axisY(input) {
  let y = 0;
  if (input.held.has('w') || input.held.has('arrowup')) y -= 1;
  if (input.held.has('s') || input.held.has('arrowdown')) y += 1;
  return y;
}

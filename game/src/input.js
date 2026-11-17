// Keyboard and pointer input. Held keys are read every frame as a movement vector; one-shot
// presses (confirm, pause, mute, interact, punch) are queued as bit flags and taken once by
// the loop, so a press between two frames is never lost and never counted twice. The mouse
// position is tracked in screen pixels and converted to world aim by the caller.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_INTERACT = 8;
export const ACTION_PUNCH = 16;
export const ACTION_CLICK = 32;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Enter']);
const PUNCH = new Set(['Space']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);
const INTERACT = new Set(['KeyE']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let mouseClicked = false;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      held.add(event.code);
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PUNCH.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PUNCH;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (INTERACT.has(event.code)) {
      if (!event.repeat) actions |= ACTION_INTERACT;
    } else {
      return;
    }
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    held.clear();
    mouseDown = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    mouseDown = true;
    mouseClicked = true;
    // Clicking also confirms on menu screens (start / restart); in play it is shooting,
    // so it carries its own flag and never starts a mission by accident.
    actions |= ACTION_CLICK;
  });
  window.addEventListener('pointerup', () => {
    mouseDown = false;
  });
  // Losing the window mid-drag (alt-tab, devtools) must not leave the trigger held down.
  window.addEventListener('pointercancel', () => {
    mouseDown = false;
  });

  function hasAny(codes) {
    for (const code of codes) if (held.has(code)) return true;
    return false;
  }

  return {
    /** Movement vector, each component -1, 0 or 1. */
    move() {
      return {
        x: (hasAny(RIGHT) ? 1 : 0) - (hasAny(LEFT) ? 1 : 0),
        y: (hasAny(DOWN) ? 1 : 0) - (hasAny(UP) ? 1 : 0),
      };
    },
    /** True while W/Up (accelerate) is held; used for driving. */
    up() { return hasAny(UP); },
    /** True while S/Down (brake/reverse) is held; used for driving. */
    down() { return hasAny(DOWN); },
    /** -1/0/1 steering from A/D or arrows; used for driving. */
    steer() { return (hasAny(RIGHT) ? 1 : 0) - (hasAny(LEFT) ? 1 : 0); },
    mouse() { return { x: mouseX, y: mouseY, down: mouseDown }; },
    /** True once per click; cleared when read. */
    takeClick() {
      const clicked = mouseClicked;
      mouseClicked = false;
      return clicked;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}

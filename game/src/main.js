// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between four screens: title, play, paused and game over.
//
// ?seed=N fixes the city's layout. ?shot=city|chase|mission|police (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets window.__shotReady for
// a screenshot.

import { CAR, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_MISSION_COMPLETE, EVENT_MISSION_FAIL, EVENT_WASTED } from './world.js';
import { ACTION_CLICK, ACTION_CONFIRM, ACTION_INTERACT, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createAudio } from './audio.js';
import { loadSave, readBest, writeBest, writeSave } from './save.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;
/** Seconds a mission result banner stays on screen. */
const BANNER_SECONDS = 3;
/** Cash lost to hospital bills and fines when wasted or busted. */
const DEATH_FINE = 100;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const save = loadSave();
const world = createWorld(createRandom(seed), save);
const renderer = createRenderer(canvas);
const audio = createAudio();

function persist() {
  writeSave({ money: world.state.money, done: world.state.done });
  if (world.state.money > readBest()) writeBest(world.state.money);
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, { best: 0, money: world.state.money });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let banner = null;
  let bannerUntil = 0;

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    // world.reset() keeps the saved money and completed jobs (it never touches them),
    // so a restart after being wasted or busted keeps everything the player earned.
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    banner = null;
    // The Space/click that started the game must not also fire as a punch or an
    // interact on the first frame of play.
    queuedInteract = false;
    queuedPunch = false;
    audio.unlock();
    announce('Playing. Explore Neon Bay, steal a car, press Enter to take a job.');
  }

  function endGame(kind) {
    screen = SCREEN_OVER;
    world.state.money = Math.max(0, world.state.money - DEATH_FINE);
    world.state.wanted = 0;
    persist();
    best = readBest();
    audio.fail();
    announce(kind === 'wasted' ? 'Wasted. Press Space or click to try again.' : 'Busted. Press Space or click to try again.');
  }

  function controls() {
    const move = input.move();
    const mouse = input.mouse();
    const view = renderer.view;
    const cam = world.state.camera;
    const aimX = cam.x - 640 + (mouse.x - view.x) / view.scale;
    const aimY = cam.y - 360 + (mouse.y - view.y) / view.scale;
    return {
      moveX: move.x,
      moveY: move.y,
      up: input.up(),
      down: input.down(),
      steer: input.steer(),
      aimX,
      aimY,
      firing: mouse.down,
      interact: false, // Set per-frame from the queued actions below.
      punch: false,
    };
  }

  // Interact (E) and punch (Space) are one-shot presses: remember them until the next step.
  let queuedInteract = false;
  let queuedPunch = false;

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, controls(), audio, true);
      return;
    }
    const ctl = controls();
    ctl.interact = queuedInteract;
    ctl.punch = queuedPunch;
    queuedInteract = false;
    queuedPunch = false;
    const events = world.step(STEP, ctl, audio, false);
    if (events & EVENT_MISSION_COMPLETE) {
      const def = world.missions.lastCompleted;
      banner = { title: 'JOB DONE', line: def ? `${def.name} — +$${def.reward}` : '', color: '#ffd166' };
      bannerUntil = performance.now() / 1000 + BANNER_SECONDS;
      audio.cash();
      audio.mission();
      persist();
      best = readBest();
      announce(`Job complete: ${def ? def.name : ''}.`);
    } else if (events & EVENT_MISSION_FAIL) {
      banner = { title: 'JOB FAILED', line: 'Marla is not happy. Press Enter to try the next job.', color: '#ef476f' };
      bannerUntil = performance.now() / 1000 + BANNER_SECONDS;
      audio.fail();
      announce('Job failed.');
    }
    if (events & EVENT_WASTED) endGame('wasted');
    else if (events & EVENT_BUSTED) endGame('busted');
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // Peek at the one-shot actions before handlePeeked consumes them, so E and Space
    // reach the world as this frame's interact / punch.
    const peeked = input.takeActions();
    if (peeked & ACTION_INTERACT) queuedInteract = true;
    if (peeked & ACTION_PUNCH) queuedPunch = true;
    handlePeeked(peeked);
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    const activeBanner = banner && now / 1000 < bannerUntil ? banner : null;
    if (!activeBanner) banner = null;
    renderer.draw(world.state, screen, { best, money: world.state.money, banner: activeBanner });
  }

  function handlePeeked(actions) {
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound muted.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER) {
      if (actions & (ACTION_CONFIRM | ACTION_CLICK | ACTION_PUNCH)) {
        audio.unlock();
        startGame();
      }
      return;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    if (actions & ACTION_CONFIRM) {
      if (!world.missions.active) {
        const next = world.missions.nextAvailable(world.state.done);
        if (next) {
          world.missions.start(next, world.missionHelpers);
          audio.phone();
          announce(`Job started: ${next.name}.`);
        } else {
          world.showMessage('All jobs done — Neon Bay is yours. Free roam!', 4);
        }
      }
    }
  }

  // Leaving the tab pauses a running game rather than letting the city run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
      persist();
    }
  });

  announce('Neon Bay Nights. Press Space or click to start.');
  // Debug handle for automated playtests: window.__nbn.world is the live simulation
  // and window.__nbn.screen() is the current screen. It changes nothing in the game.
  window.__nbn = { world, screen: () => screen };
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();

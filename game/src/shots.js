// The screenshot scenes behind ?shot=city|chase|mission|police. Each one puts the real world
// into a fixed, readable state (see world.stageScene), then steps it forward a short while
// with no input, so the frame is what a short game really looks like — traffic moving,
// police closing in, the mission marker live — and the same seed always gives the same frame.

import { STEP } from './config.js';
import { SCREEN_PLAY } from './render.js';

const SETTLE_SECONDS = 1.5;
const SAMPLE = 1 / 30;

const SILENT_AUDIO = {
  engine() {}, siren() {}, gunshot() {}, punch() {}, crash() {}, explosion() {},
  pickup() {}, cash() {}, mission() {}, fail() {}, click() {}, phone() {}, starDown() {},
};

function neutralControls(world, up) {
  const p = world.state.player;
  return {
    moveX: 0, moveY: 0, up: !!up, down: false, steer: 0,
    aimX: p.x, aimY: p.y - 100, firing: false, interact: false, punch: false,
  };
}

/**
 * Set `world` to the named scene (city, chase, mission or police; any other name is city)
 * and return the screen to draw over it and the best cash to show.
 */
export function stageShot(name, world) {
  const scene = name === 'chase' || name === 'mission' || name === 'police' ? name : 'city';
  world.stageScene(scene);
  // In the chase scene, skip the pickup step so the objective is the beach delivery.
  if (scene === 'chase' && world.missions.active) {
    world.missions.active.step = 1;
    world.missions.active.dwell = 0;
  }
  for (let t = 0; t < SETTLE_SECONDS; t += SAMPLE) {
    // In the chase scene the player holds the accelerator, so the frame shows speed.
    world.step(SAMPLE, neutralControls(world, scene === 'chase'), SILENT_AUDIO, false);
  }
  return { screen: SCREEN_PLAY, best: 0 };
}

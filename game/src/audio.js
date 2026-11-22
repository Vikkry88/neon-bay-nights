// audio.js — procedural WebAudio: engine, siren, shots, radio music.
// No audio files; everything is synthesized so the game works offline.
let ctx = null;
let master = null;
let engineOsc = null;
let engineGain = null;
let sirenOsc = null;
let sirenGain = null;
let sirenLfo = null;
let musicTimer = null;
let musicStep = 0;
let muted = false;
let station = 'Neon FM';

function ensureCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.55;
  master.connect(ctx.destination);
  return ctx;
}

export function audioResume() {
  const c = ensureCtx();
  if (c && c.state === 'suspended') c.resume();
}

export function setMuted(m) {
  muted = !!m;
  if (master) master.gain.value = muted ? 0 : 0.55;
  return muted;
}

export function isMuted() {
  return muted;
}

export function setEngine(speedKmh, driving) {
  const c = ensureCtx();
  if (!c) return;
  if (!engineOsc) {
    engineOsc = c.createOscillator();
    engineOsc.type = 'sawtooth';
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    engineGain = c.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(filter).connect(engineGain).connect(master);
    engineOsc.start();
  }
  const target = driving ? Math.min(0.12, 0.03 + Math.abs(speedKmh) / 2200) : 0;
  engineGain.gain.setTargetAtTime(target, c.currentTime, 0.12);
  engineOsc.frequency.setTargetAtTime(55 + Math.abs(speedKmh) * 1.15, c.currentTime, 0.1);
}

export function setSiren(active, intensity = 1) {
  const c = ensureCtx();
  if (!c) return;
  if (!sirenOsc) {
    sirenOsc = c.createOscillator();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 720;
    sirenGain = c.createGain();
    sirenGain.gain.value = 0;
    sirenLfo = c.createOscillator();
    sirenLfo.type = 'sine';
    sirenLfo.frequency.value = 0.7;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 180;
    sirenLfo.connect(lfoGain).connect(sirenOsc.frequency);
    sirenOsc.connect(sirenGain).connect(master);
    sirenOsc.start();
    sirenLfo.start();
  }
  sirenGain.gain.setTargetAtTime(active ? 0.045 * intensity : 0, c.currentTime, 0.2);
}

function blip(freq, dur, type = 'square', vol = 0.12, slideTo = null) {
  const c = ensureCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
  gain.gain.setValueAtTime(vol, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  osc.connect(gain).connect(master);
  osc.start();
  osc.stop(c.currentTime + dur + 0.02);
}

export function playShot(kind = 'pistol') {
  if (kind === 'shotgun') {
    blip(160, 0.22, 'sawtooth', 0.22, 45);
    blip(900, 0.06, 'square', 0.1, 200);
  } else if (kind === 'smg') {
    blip(520, 0.07, 'square', 0.11, 140);
  } else {
    blip(640, 0.1, 'square', 0.13, 160);
  }
}

export function playPunch() {
  blip(110, 0.1, 'sine', 0.16, 55);
}

export function playCash() {
  blip(880, 0.09, 'sine', 0.1);
  setTimeout(() => blip(1320, 0.12, 'sine', 0.1), 70);
}

export function playPickup() {
  blip(660, 0.08, 'triangle', 0.1);
  setTimeout(() => blip(990, 0.1, 'triangle', 0.1), 60);
}

export function playCrash() {
  blip(90, 0.28, 'sawtooth', 0.2, 38);
}

export function playHorn() {
  blip(392, 0.18, 'square', 0.08);
}

export function playUi() {
  blip(520, 0.05, 'sine', 0.07);
}

const NEON_NOTES = [220, 261.63, 329.63, 392, 329.63, 261.63, 196, 261.63];
const TALK_NOTES = [174.61, 196, 220, 196, 174.61, 146.83, 164.81, 196];

function musicTick() {
  if (station === 'Off') return;
  const notes = station === 'Neon FM' ? NEON_NOTES : TALK_NOTES;
  const note = notes[musicStep % notes.length];
  blip(note, station === 'Neon FM' ? 0.24 : 0.4, station === 'Neon FM' ? 'triangle' : 'sine', 0.045);
  if (musicStep % 4 === 0) blip(note / 2, 0.3, 'sine', 0.05);
  musicStep += 1;
}

export function setRadio(next) {
  station = next;
  ensureCtx();
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
  if (station !== 'Off') {
    musicTimer = setInterval(musicTick, station === 'Neon FM' ? 260 : 420);
  }
  return station;
}

export function getRadio() {
  return station;
}

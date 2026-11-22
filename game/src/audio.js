// WebAudio sound: engine hum, sirens, shots, pickups, UI blips and a two-station
// music loop (Neon FM synthwave arp / Bay Talk laid-back groove). All generated
// locally with oscillators — no audio files, no network.

import { RADIO_STATIONS } from './config.js';

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let beat = 0;
  let station = RADIO_STATIONS[0];
  const audio = { muted: false, ready: false };

  function ensureContext() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = audio.muted ? 0 : 0.5;
      master.connect(ctx.destination);
      audio.ready = true;
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, gainValue, slideTo) {
    if (!ensureContext() || audio.muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    gain.gain.setValueAtTime(gainValue, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noiseBurst(dur, gainValue, filterFreq) {
    if (!ensureContext() || audio.muted) return;
    const t = ctx.currentTime;
    const length = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainValue, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    source.connect(filter).connect(gain).connect(master);
    source.start(t);
  }

  audio.unlock = () => {
    if (ensureContext() && ctx.state === 'suspended') ctx.resume();
  };

  audio.setMuted = (muted) => {
    audio.muted = muted;
    if (master) master.gain.value = muted ? 0 : 0.5;
  };

  audio.shot = (weaponId) => {
    if (weaponId === 'shotgun') { noiseBurst(0.22, 0.5, 900); tone(140, 0.16, 'square', 0.2, 60); }
    else if (weaponId === 'smg') { noiseBurst(0.07, 0.3, 1800); }
    else if (weaponId === 'pistol') { noiseBurst(0.11, 0.35, 1400); tone(220, 0.08, 'square', 0.12, 90); }
    else { noiseBurst(0.05, 0.12, 600); }
  };

  audio.pickup = () => { tone(660, 0.09, 'sine', 0.2); tone(990, 0.14, 'sine', 0.16); };
  audio.cash = () => { tone(880, 0.08, 'triangle', 0.22); tone(1320, 0.16, 'triangle', 0.2); };
  audio.hit = () => { noiseBurst(0.12, 0.3, 500); };
  audio.crash = () => { noiseBurst(0.3, 0.45, 420); tone(90, 0.25, 'sawtooth', 0.18, 40); };
  audio.door = () => { tone(180, 0.07, 'square', 0.15, 120); };
  audio.blip = () => { tone(520, 0.06, 'sine', 0.14); };
  audio.alarm = () => { tone(740, 0.12, 'square', 0.16); tone(740, 0.12, 'square', 0.16); };
  audio.death = () => { tone(320, 0.7, 'sawtooth', 0.25, 60); };

  audio.setEngine = (speedRatio, active) => {
    if (!ensureContext()) return;
    if (!engineOsc) {
      engineOsc = ctx.createOscillator();
      engineGain = ctx.createGain();
      engineOsc.type = 'sawtooth';
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain).connect(master);
      engineOsc.start();
    }
    const target = active && !audio.muted ? 0.05 + speedRatio * 0.06 : 0;
    engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
    engineOsc.frequency.setTargetAtTime(55 + speedRatio * 165, ctx.currentTime, 0.1);
  };

  audio.setSiren = (active) => {
    if (!ensureContext()) return;
    if (!sirenOsc) {
      sirenOsc = ctx.createOscillator();
      sirenGain = ctx.createGain();
      sirenOsc.type = 'triangle';
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain).connect(master);
      sirenOsc.start();
    }
    const t = ctx.currentTime;
    sirenGain.gain.setTargetAtTime(active && !audio.muted ? 0.045 : 0, t, 0.2);
    if (active) {
      const phase = (t % 1.2) / 1.2;
      sirenOsc.frequency.setTargetAtTime(phase < 0.5 ? 720 : 960, t, 0.05);
    }
  };

  function scheduleBeat() {
    if (!ctx || audio.muted || station.id === 'off') return;
    const step = beat % 16;
    const note = station.mode[step % station.mode.length];
    const freq = station.root * Math.pow(2, note / 12);
    if (station.id === 'neonfm') {
      tone(freq * 2, 0.16, 'square', 0.05);
      if (step % 4 === 0) tone(station.root / 2, 0.3, 'triangle', 0.12);
      if (step % 2 === 1) noiseBurst(0.03, 0.03, 6000);
    } else {
      if (step % 2 === 0) tone(freq, 0.28, 'sine', 0.1);
      if (step % 8 === 4) tone(freq * 1.5, 0.2, 'triangle', 0.06);
    }
    beat += 1;
  }

  audio.setStation = (stationId) => {
    station = RADIO_STATIONS.find((s) => s.id === stationId) || RADIO_STATIONS[0];
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    if (station.id !== 'off' && ensureContext()) {
      const intervalMs = (60000 / station.tempo) / 2;
      musicTimer = setInterval(scheduleBeat, intervalMs);
    }
  };

  return audio;
}

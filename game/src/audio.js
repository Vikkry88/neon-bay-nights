// Neon Bay Nights — audio.js
// One job: all sound is synthesized with WebAudio — no audio files.
// Engine hum, sirens, gunshots, punches, pickups and a simple music loop.
(function () {
  'use strict';

  const NBN = window.NBN;

  let ctx = null;
  let master = null;
  let muted = false;
  let musicTimer = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let step = 0;

  // A lazy bassline loop: Am — F — C — G, one bar each, 8th-note steps.
  const BASS = [55, 55, 65.41, 55, 43.65, 43.65, 55, 43.65, 49, 49, 58.27, 49, 55, 55, 65.41, 55];
  const STEP_MS = 190;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      return true;
    } catch (err) {
      return false;
    }
  }

  function unlock() {
    if (ensure() && ctx.state === 'suspended') ctx.resume();
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, lowpass) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = vol || 0.3;
    if (lowpass) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lowpass;
      src.connect(f);
      f.connect(g);
    } else {
      src.connect(g);
    }
    g.connect(master);
    src.start(t);
  }

  function startEngine() {
    if (!ensure() || engineOsc) return;
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 60;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 500;
    engineOsc.connect(f);
    f.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
  }

  function setEngine(speed01, on) {
    if (!engineOsc || !engineGain) return;
    const t = ctx.currentTime;
    engineGain.gain.setTargetAtTime(on && !muted ? 0.05 + speed01 * 0.06 : 0, t, 0.1);
    engineOsc.frequency.setTargetAtTime(55 + speed01 * 140, t, 0.08);
  }

  function startSiren() {
    if (!ensure() || sirenOsc) return;
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 700;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.9;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 220;
    lfo.connect(lfoGain);
    lfoGain.connect(sirenOsc.frequency);
    sirenOsc.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();
    lfo.start();
    NBN.audio._sirenLfo = lfo;
  }

  function setSiren(on) {
    if (!sirenGain) return;
    sirenGain.gain.setTargetAtTime(on && !muted ? 0.045 : 0, ctx.currentTime, 0.2);
  }

  function startMusic() {
    if (!ensure() || musicTimer) return;
    step = 0;
    musicTimer = window.setInterval(() => {
      if (muted || !ctx) return;
      const bass = BASS[step % BASS.length];
      tone(bass, 0.22, 'triangle', 0.22);
      if (step % 2 === 0) noise(0.03, 0.05, 6000); // hat tick
      if (step % 8 === 4) tone(bass * 2, 0.12, 'square', 0.06); // sparkle
      step++;
    }, STEP_MS);
  }

  function stopMusic() {
    if (musicTimer) {
      window.clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  NBN.audio = {
    _sirenLfo: null,
    unlock,
    ensure,
    startEngine,
    setEngine,
    startSiren,
    setSiren,
    startMusic,
    stopMusic,
    gunshot() { noise(0.16, 0.5, 3000); tone(160, 0.1, 'square', 0.25, 60); },
    punch() { noise(0.09, 0.35, 900); },
    pickup() { tone(660, 0.09, 'sine', 0.25); window.setTimeout(() => tone(880, 0.12, 'sine', 0.25), 90); },
    cash() { tone(880, 0.1, 'sine', 0.25); window.setTimeout(() => tone(1174, 0.16, 'sine', 0.25), 100); },
    fail() { tone(220, 0.35, 'sawtooth', 0.2, 110); },
    missionStart() { tone(523, 0.12, 'square', 0.18); window.setTimeout(() => tone(659, 0.12, 'square', 0.18), 120); window.setTimeout(() => tone(784, 0.22, 'square', 0.18), 240); },
    missionDone() { [523, 659, 784, 1046].forEach((f, i) => window.setTimeout(() => tone(f, 0.2, 'square', 0.2), i * 130)); },
    explosion() { noise(0.7, 0.6, 700); tone(90, 0.5, 'sawtooth', 0.3, 35); },
    sirenBlip() { tone(950, 0.18, 'triangle', 0.15, 650); },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() { return muted; },
  };
})();

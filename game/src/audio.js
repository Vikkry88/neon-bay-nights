// Synthesized sound only: every effect and the music loop are built with WebAudio
// oscillators and noise, so the game loads no audio files and makes no network request.
// Audio starts on the first user gesture (browsers require it) and M toggles mute.

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let nextNoteTime = 0;
  let noteIndex = 0;

  // A lazy, laid-back bass line in A minor over a soft hat tick — Neon Bay at dusk.
  const BASS = [55, 0, 55, 65.41, 0, 55, 49, 0, 55, 0, 82.41, 0, 73.42, 0, 65.41, 0];
  const NOTE_LEN = 0.22;

  function ensure() {
    if (ctx) return true;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return false;
      ctx = new AudioCtx();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      // Engine hum: a low sawtooth whose pitch follows the car's speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 500;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Police siren: two alternating tones.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      startMusic();
      return true;
    } catch {
      return false;
    }
  }

  function startMusic() {
    if (musicTimer !== null || !ctx) return;
    nextNoteTime = ctx.currentTime + 0.1;
    noteIndex = 0;
    musicTimer = window.setInterval(() => {
      if (!ctx || muted) return;
      while (nextNoteTime < ctx.currentTime + 0.3) {
        const freq = BASS[noteIndex % BASS.length];
        if (freq > 0) {
          const osc = ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.value = freq;
          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0.5, nextNoteTime);
          gain.gain.exponentialRampToValueAtTime(0.001, nextNoteTime + NOTE_LEN);
          osc.connect(gain);
          gain.connect(musicGain);
          osc.start(nextNoteTime);
          osc.stop(nextNoteTime + NOTE_LEN + 0.02);
        }
        nextNoteTime += NOTE_LEN;
        noteIndex += 1;
      }
    }, 120);
  }

  function blip(freq, dur, type, volume, slideTo) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, volume, filterFreq) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(t);
  }

  return {
    /** Call from any user gesture so the browser unlocks audio. */
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    /** speed01: 0 (idle) to 1 (top speed); called every frame while driving. */
    engine(speed01, driving) {
      if (!ctx) return;
      if (!driving) {
        engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
        return;
      }
      engineGain.gain.setTargetAtTime(0.05 + speed01 * 0.05, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, ctx.currentTime, 0.08);
    },
    siren(on, time) {
      if (!ctx) return;
      if (!on) {
        sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
        return;
      }
      sirenGain.gain.setTargetAtTime(0.045, ctx.currentTime, 0.1);
      sirenOsc.frequency.setTargetAtTime(Math.sin(time * 4) > 0 ? 880 : 660, ctx.currentTime, 0.05);
    },
    gunshot() { noise(0.14, 0.5, 1800); blip(180, 0.1, 'square', 0.25, 60); },
    punch() { noise(0.09, 0.35, 500); blip(120, 0.08, 'sine', 0.3, 70); },
    crash() { noise(0.3, 0.5, 700); blip(90, 0.25, 'sawtooth', 0.3, 40); },
    explosion() { noise(0.7, 0.7, 400); blip(60, 0.6, 'sine', 0.5, 28); },
    pickup() { blip(660, 0.09, 'sine', 0.3); window.setTimeout(() => blip(990, 0.12, 'sine', 0.3), 90); },
    cash() { blip(880, 0.08, 'triangle', 0.3); window.setTimeout(() => blip(1174, 0.1, 'triangle', 0.3), 80); window.setTimeout(() => blip(1318, 0.16, 'triangle', 0.3), 170); },
    mission() { [523, 659, 784, 1046].forEach((f, i) => window.setTimeout(() => blip(f, 0.18, 'triangle', 0.3), i * 110)); },
    fail() { [392, 330, 262].forEach((f, i) => window.setTimeout(() => blip(f, 0.22, 'sawtooth', 0.22), i * 140)); },
    click() { blip(700, 0.05, 'square', 0.15); },
    phone() { blip(1200, 0.12, 'sine', 0.25); window.setTimeout(() => blip(1200, 0.12, 'sine', 0.25), 180); },
    /** A short two-note chime when a wanted star fades — the player hears the heat drop. */
    starDown() { blip(784, 0.1, 'triangle', 0.22); window.setTimeout(() => blip(587, 0.14, 'triangle', 0.22), 110); },
  };
}

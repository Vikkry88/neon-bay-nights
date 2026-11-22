// audio.js — procedural WebAudio sound for Neon Bay Nights (no audio files).
// Engine hum, sirens, gunshots, punches, crashes, horns, cash and two radio
// stations (Neon FM synth loop, Bay Talk mumble loop) plus Off.
export function initAudio(G) {
  const A = {
    ctx: null, master: null, engineOsc: null, engineGain: null,
    sirenOsc: null, sirenGain: null, sirenLfo: null,
    radioTimer: 0, radioStep: 0, muted: !!G.save.muted,
  };
  G.audio = A;

  A.ensure = function () {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      A.ctx = new AC();
      A.master = A.ctx.createGain();
      A.master.gain.value = A.muted ? 0 : 0.5;
      A.master.connect(A.ctx.destination);
      // Engine: sawtooth through lowpass, pitch follows speed.
      A.engineOsc = A.ctx.createOscillator();
      A.engineOsc.type = 'sawtooth';
      A.engineOsc.frequency.value = 55;
      const filt = A.ctx.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = 420;
      A.engineGain = A.ctx.createGain(); A.engineGain.gain.value = 0;
      A.engineOsc.connect(filt); filt.connect(A.engineGain); A.engineGain.connect(A.master);
      A.engineOsc.start();
      // Siren: sine wailing between two tones via LFO.
      A.sirenOsc = A.ctx.createOscillator();
      A.sirenOsc.type = 'triangle'; A.sirenOsc.frequency.value = 760;
      A.sirenLfo = A.ctx.createOscillator(); A.sirenLfo.frequency.value = 0.6;
      const lfoGain = A.ctx.createGain(); lfoGain.gain.value = 170;
      A.sirenLfo.connect(lfoGain); lfoGain.connect(A.sirenOsc.frequency);
      A.sirenGain = A.ctx.createGain(); A.sirenGain.gain.value = 0;
      A.sirenOsc.connect(A.sirenGain); A.sirenGain.connect(A.master);
      A.sirenOsc.start(); A.sirenLfo.start();
    } catch (err) { A.ctx = null; }
  };

  A.setMuted = function (m) {
    A.muted = m;
    if (A.master) A.master.gain.value = m ? 0 : 0.5;
  };

  function blip(freq, dur, type, vol, slideTo) {
    if (!A.ctx) return;
    const t = A.ctx.currentTime;
    const o = A.ctx.createOscillator(); const g = A.ctx.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(A.master); o.start(t); o.stop(t + dur + 0.02);
  }

  function noiseBurst(dur, vol, freq) {
    if (!A.ctx) return;
    const t = A.ctx.currentTime;
    const len = Math.max(1, Math.floor(A.ctx.sampleRate * dur));
    const buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = A.ctx.createBufferSource(); src.buffer = buf;
    const f = A.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 1800;
    const g = A.ctx.createGain(); g.gain.value = vol || 0.3;
    src.connect(f); f.connect(g); g.connect(A.master); src.start(t);
  }

  A.shot = function (kind) {
    if (kind === 'shotgun') { noiseBurst(0.28, 0.5, 900); blip(120, 0.18, 'square', 0.25, 40); }
    else if (kind === 'smg') { noiseBurst(0.08, 0.28, 2400); }
    else { noiseBurst(0.12, 0.32, 2000); blip(220, 0.08, 'square', 0.15, 60); }
  };
  A.punch = function () { noiseBurst(0.09, 0.25, 500); };
  A.crash = function (hard) { noiseBurst(hard ? 0.4 : 0.2, hard ? 0.5 : 0.3, 700); blip(80, 0.25, 'sawtooth', 0.2, 35); };
  A.cash = function () { blip(1320, 0.09, 'square', 0.18); setTimeout(() => blip(1760, 0.14, 'square', 0.18), 90); };
  A.horn = function () { blip(392, 0.35, 'square', 0.22); blip(494, 0.35, 'square', 0.16); };
  A.pickup = function () { blip(880, 0.1, 'sine', 0.2); setTimeout(() => blip(1174, 0.16, 'sine', 0.2), 80); };
  A.door = function () { noiseBurst(0.08, 0.2, 600); blip(180, 0.07, 'square', 0.12, 90); };

  // Radio: station 0 = Off, 1 = Neon FM (synth arp), 2 = Bay Talk (mumble).
  const NEON_NOTES = [220, 261.6, 329.6, 392, 329.6, 261.6, 293.7, 349.2];
  A.update = function (dt) {
    if (!A.ctx) return;
    const inCar = !!G.player.car;
    const speed01 = inCar ? Math.min(1, Math.abs(G.player.car.speed) / 42) : 0;
    if (A.engineGain) {
      A.engineGain.gain.value += ((inCar ? 0.05 + speed01 * 0.09 : 0) - A.engineGain.gain.value) * Math.min(1, dt * 6);
      A.engineOsc.frequency.value = 52 + speed01 * 130;
    }
    const wanted = G.police ? G.police.stars : 0;
    if (A.sirenGain) {
      const target = wanted > 0 ? 0.045 : 0;
      A.sirenGain.gain.value += (target - A.sirenGain.gain.value) * Math.min(1, dt * 3);
    }
    A.radioTimer -= dt;
    if (inCar && G.save.radio > 0 && A.radioTimer <= 0) {
      A.radioTimer = G.save.radio === 1 ? 0.24 : 0.5;
      A.radioStep = (A.radioStep + 1) % 64;
      if (G.save.radio === 1) {
        const n = NEON_NOTES[A.radioStep % NEON_NOTES.length];
        blip(n, 0.2, 'triangle', 0.07);
        if (A.radioStep % 4 === 0) blip(n / 2, 0.4, 'sine', 0.09);
      } else {
        blip(120 + (A.radioStep % 5) * 18, 0.16, 'sawtooth', 0.035, 90);
      }
    }
  };
  return A;
}

export const RADIO_NAMES = ['Radio Off', 'Neon FM', 'Bay Talk'];

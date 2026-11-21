// Synthesized WebAudio: engine hum, shots, sirens, tiny music loop. M mutes.
export function createAudio() {
  let ctx = null, master = null, musicTimer = null, step = 0, muted = false;
  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.35; master.connect(ctx.destination);
      return true;
    } catch { return false; }
  }
  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime, len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = vol || 0.3;
    src.connect(g); g.connect(master); src.start(t);
  }
  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.35; return muted; },
    get muted() { return muted; },
    shot() { noise(0.12, 0.4); tone(180, 0.08, 'square', 0.15, 60); },
    punch() { noise(0.07, 0.25); },
    crash() { noise(0.25, 0.45); tone(90, 0.2, 'sawtooth', 0.2, 40); },
    siren() { tone(700, 0.18, 'triangle', 0.08, 950); },
    cash() { tone(880, 0.09, 'sine', 0.25); setTimeout(() => tone(1320, 0.12, 'sine', 0.25), 90); },
    pickup() { tone(660, 0.08, 'sine', 0.2); },
    hurt() { tone(160, 0.15, 'sawtooth', 0.2, 80); },
    startMusic() {
      if (musicTimer || !ensure()) return;
      const bass = [110, 110, 131, 98, 110, 110, 147, 131];
      musicTimer = setInterval(() => {
        if (muted) return;
        const n = bass[step % bass.length];
        tone(n, 0.22, 'triangle', 0.12);
        if (step % 2 === 0) tone(n * 2, 0.12, 'square', 0.05);
        step++;
      }, 260);
    },
    stopMusic() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } },
  };
}

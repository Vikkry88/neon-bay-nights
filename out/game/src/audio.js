// Neon Bay Nights — WebAudio: engine hum, sirens, shots, pickups and the radio loop.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicTimer = null;
    this.step = 0;
    this.station = null;
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  tone(freq, dur, type = 'square', gain = 0.06, when = 0) {
    const ctx = this.ensure();
    if (!ctx || this.muted) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  shot() { this.tone(180, 0.09, 'sawtooth', 0.09); this.tone(90, 0.12, 'square', 0.05); }
  smg() { this.tone(240, 0.05, 'sawtooth', 0.06); }
  shotgun() { this.tone(110, 0.22, 'sawtooth', 0.13); this.tone(60, 0.28, 'square', 0.09); }
  punch() { this.tone(120, 0.08, 'triangle', 0.08); }
  pickup() { this.tone(660, 0.1, 'sine', 0.07); this.tone(880, 0.14, 'sine', 0.07, 0.08); }
  cash() { this.tone(990, 0.1, 'triangle', 0.08); this.tone(1320, 0.16, 'triangle', 0.08, 0.09); }
  crash() { this.tone(70, 0.25, 'sawtooth', 0.12); }
  door() { this.tone(300, 0.07, 'square', 0.05); }
  sirenTick(high) { this.tone(high ? 880 : 660, 0.16, 'triangle', 0.035); }
  fail() { this.tone(220, 0.3, 'sawtooth', 0.08); this.tone(160, 0.4, 'sawtooth', 0.08, 0.15); }
  win() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.08, i * 0.12)); }

  setStation(station) {
    this.station = station;
    if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
    if (!station || !station.bpm) return;
    const beat = 60000 / station.bpm / 2;
    this.musicTimer = setInterval(() => {
      if (this.muted) return;
      const root = station.id === 'neon' ? 220 : 196;
      const note = station.scale[this.step % station.scale.length] || 0;
      const freq = root * Math.pow(2, note / 12);
      this.tone(freq, 0.22, station.id === 'neon' ? 'square' : 'sine', 0.035);
      if (this.step % 4 === 0) this.tone(root / 2, 0.4, 'triangle', 0.05);
      this.step += 1;
    }, beat);
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }
}

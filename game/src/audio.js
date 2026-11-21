// Neon Bay Nights — WebAudio sound effects, all synthesized (no audio files).
export class Sfx {
  constructor() {
    this.ctx = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenT = 0;
  }
  resume() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        this.ctx = null;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }
  tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol || 0.08, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  noise(dur, vol) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.12, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1800;
    src.connect(f).connect(g).connect(this.ctx.destination);
    src.start(t);
  }
  shot() { this.resume(); this.noise(0.12, 0.16); this.tone(160, 0.08, 'square', 0.06, 60); }
  cash() { this.resume(); this.tone(880, 0.09, 'sine', 0.09); setTimeout(() => this.tone(1320, 0.12, 'sine', 0.09), 70); }
  pickup() { this.resume(); this.tone(520, 0.1, 'triangle', 0.1, 780); }
  door() { this.resume(); this.tone(220, 0.07, 'square', 0.05, 140); this.noise(0.05, 0.05); }
  crash() { this.resume(); this.noise(0.25, 0.18); this.tone(90, 0.2, 'sawtooth', 0.07, 45); }
  mission() { this.resume(); [523, 659, 784].forEach((f, i) => setTimeout(() => this.tone(f, 0.14, 'triangle', 0.09), i * 90)); }
  siren() {
    if (!this.ctx) return;
    const now = performance.now();
    if (now - this.sirenT < 520) return;
    this.sirenT = now;
    this.tone(700, 0.24, 'sine', 0.035, 980);
    setTimeout(() => this.tone(980, 0.24, 'sine', 0.035, 700), 260);
  }
  engine(level) {
    if (!this.ctx) return;
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineGain = this.ctx.createGain();
      this.engineOsc.type = 'sawtooth';
      this.engineGain.gain.value = 0;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 500;
      this.engineOsc.connect(f).connect(this.engineGain).connect(this.ctx.destination);
      this.engineOsc.start();
    }
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(55 + level * 130, t, 0.08);
    this.engineGain.gain.setTargetAtTime(level > 0.01 ? 0.028 + level * 0.03 : 0, t, 0.1);
  }
}

/** Tiny procedural sfx (no asset files). AudioContext is created lazily after a user gesture / XR session start. */
export class Sfx {
  private ctx: AudioContext | null = null;
  private ensure() { if (!this.ctx) { try { this.ctx = new (globalThis.AudioContext || (globalThis as any).webkitAudioContext)(); } catch { this.ctx = null; } } if (this.ctx?.state === 'suspended') this.ctx.resume().catch(() => {}); return this.ctx; }
  tone(freq: number, dur = 0.12, type: OscillatorType = 'sine', gain = 0.12, delay = 0) {
    const c = this.ensure(); if (!c) return; const t = c.currentTime + delay; const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  success(combo: number) { const f = 440 * Math.pow(2, Math.min(combo, 12) / 12 * (7 / 12) * 1.5); this.tone(f, 0.14, 'triangle', 0.14); this.tone(f * 1.5, 0.18, 'sine', 0.09, 0.06); }
  timeout() { this.tone(160, 0.22, 'sawtooth', 0.06); }
  tick() { this.tone(900, 0.03, 'square', 0.03); }
  start() { [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.15, 'triangle', 0.12, i * 0.07)); }
  end() { [784, 659, 523, 392].forEach((f, i) => this.tone(f, 0.2, 'triangle', 0.1, i * 0.09)); }
  best() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.22, 'sine', 0.12, i * 0.08)); }
}

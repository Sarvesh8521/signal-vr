/** Procedural dark ambience for LAST LIGHT: a low drifting pad that brightens with each wave, and a heartbeat when your light runs low. */
export class Ambience {
  private ctx: AudioContext | null = null; private pad: GainNode | null = null; private lp: BiquadFilterNode | null = null; private beat = 0; private on = false;
  start() {
    try {
      if (!this.ctx) {
        const AC = (window as any).AudioContext || (window as any).webkitAudioContext; const c: AudioContext = new AC(); this.ctx = c;
        this.lp = c.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 420; this.pad = c.createGain(); this.pad.gain.value = 0;
        [55, 82.41, 110.3, 164.8].forEach((f, i) => { const o = c.createOscillator(); o.type = i % 2 ? 'sawtooth' : 'triangle'; o.frequency.value = f; o.detune.value = (i - 1.5) * 7; o.connect(this.lp!); o.start(); });
        this.lp.connect(this.pad); this.pad.connect(c.destination);
      }
      this.ctx.resume?.(); this.on = true; this.pad!.gain.setTargetAtTime(0.07, this.ctx.currentTime, 0.8);
    } catch { /* audio unavailable */ }
  }
  stop() { this.on = false; if (this.ctx && this.pad) this.pad.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4); }
  tick(dt: number, light: number, wave: number) {
    if (!this.on || !this.ctx || !this.lp) return;
    this.lp.frequency.setTargetAtTime(380 + wave * 90, this.ctx.currentTime, 0.5);
    if (light < 40) { this.beat -= dt; if (this.beat <= 0) { this.beat = 0.55 + light / 80; this.thump(); } }
  }
  private thump() {
    const c = this.ctx!, o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(70, c.currentTime); o.frequency.exponentialRampToValueAtTime(38, c.currentTime + 0.18);
    g.gain.setValueAtTime(0.5, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.22); o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + 0.25);
  }
}

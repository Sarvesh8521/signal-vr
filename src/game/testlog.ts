import type { Features, Match } from '../pose/types';
import type { GameEvent } from './game';

const FK = ['thumb', 'index', 'middle', 'ring', 'pinky', 'pinch', 'spread'] as const;
interface Row { n: number; sum: number[]; sq: number[]; pred: Record<string, number>; ok: number; miss: number; ms: number; samples: number[][]; seen: number; acc: number[][]; }
const r2 = (x: number) => Math.round(x * 100) / 100;

/** Passive tester log: while someone plays normally, records per-target features, predictions and accept/timeout counts. Nothing leaves the device unless the tester taps Copy or Download. */
export class TestLog {
  private rows: Record<string, Row> = {}; private frames = 0; private lost = 0; private lbl: HTMLElement | null = null;
  constructor(ui = typeof document !== 'undefined') { if (ui) this.mount(); }
  private row(t: string): Row { return (this.rows[t] ||= { n: 0, sum: FK.map(() => 0), sq: FK.map(() => 0), pred: {}, ok: 0, miss: 0, ms: 0, samples: [], seen: 0, acc: [] }); }
  frame(target: string | null, phase: string, f: Features | null, m: Match | null, evs: GameEvent[], targetAgeMs: number) {
    if (!target || (phase !== 'playing' && phase !== 'teach')) return;
    const r = this.row(target);
    if (!f || !m) this.lost++;
    else {
      this.frames++; r.n++;
      for (let i = 0; i < FK.length; i++) { const v = f[FK[i]]; r.sum[i] += v; r.sq[i] += v * v; }
      r.pred[m.sign] = (r.pred[m.sign] || 0) + 1;
      if (r.n % 6 === 0) { const row = FK.map((k) => r2(f[k])); r.seen++; if (r.samples.length < 60) r.samples.push(row); else { const j = Math.floor(Math.random() * r.seen); if (j < 60) r.samples[j] = row; } }
    }
    for (const e of evs) { if (e.type === 'success') { r.ok++; r.ms += targetAgeMs; if (f && r.acc.length < 30) r.acc.push(FK.map((k) => r2(f[k]))); } else if (e.type === 'timeout') r.miss++; }
    if (this.lbl && (this.frames + this.lost) % 30 === 0) this.lbl.textContent = `SIGNAL test data: ${this.frames} frames`;
  }
  summary() {
    const signs: Record<string, unknown> = {};
    for (const [id, r] of Object.entries(this.rows)) {
      const mean: Record<string, number> = {}, sd: Record<string, number> = {};
      FK.forEach((k, i) => { const m = r.n ? r.sum[i] / r.n : 0; mean[k] = r2(m); sd[k] = r2(Math.sqrt(Math.max(0, (r.n ? r.sq[i] / r.n : 0) - m * m))); });
      signs[id] = { frames: r.n, accepted: r.ok, timeouts: r.miss, avgAcceptMs: r.ok ? Math.round(r.ms / r.ok) : null, predicted: r.pred, mean, sd, acceptedPoses: r.acc, samples: r.samples };
    }
    return { app: 'SIGNAL', build: 'tester-log-2', when: new Date().toISOString(), device: typeof navigator !== 'undefined' ? navigator.userAgent : '', frames: this.frames, trackingLostFrames: this.lost, signs };
  }
  json() { return JSON.stringify(this.summary()); }
  private mount() {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99999;font:13px system-ui;background:rgba(7,11,26,.92);color:#e2e8f0;padding:8px 10px;border-radius:10px;border:1px solid #22d3ee;display:flex;gap:8px;align-items:center';
    const lbl = document.createElement('span'); lbl.textContent = 'SIGNAL test data: 0 frames'; this.lbl = lbl; el.appendChild(lbl);
    const btn = (t: string, fn: () => void) => { const b = document.createElement('button'); b.textContent = t; b.style.cssText = 'background:#0e7490;color:#fff;border:0;border-radius:6px;padding:6px 10px;cursor:pointer'; b.onclick = fn; el.appendChild(b); };
    btn('Copy', () => { const s = this.json(); const done = () => { lbl.textContent = 'Copied! Paste it to Sarvesh'; };
      if (navigator.clipboard) navigator.clipboard.writeText(s).then(done, () => window.prompt('Copy this:', s)); else window.prompt('Copy this:', s); });
    btn('Download', () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([this.json()], { type: 'application/json' })); a.download = 'signal-test-data.json'; a.click(); });
    document.body.appendChild(el);
  }
}

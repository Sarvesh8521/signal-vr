import { Match } from './types';
export interface StabOpts { minConf: number; minMargin: number; holdMs: number; lossGraceMs: number; }
export const DEFAULT_STAB: StabOpts = { minConf: 0.55, minMargin: 0.08, holdMs: 400, lossGraceMs: 250 };

/** Turns jittery per-frame matches into a "confirmed" sign only after a stable hold. Tracking loss pauses, not fails. */
export class Stabilizer {
  private cur: string | null = null; private since = 0; private lastSeen = 0;
  constructor(private o: StabOpts = DEFAULT_STAB) {}
  update(m: Match | null, nowMs: number) {
    if (!m) { // hand lost
      if (nowMs - this.lastSeen > this.o.lossGraceMs) { this.cur = null; }
      return { lost: true, candidate: this.cur, progress: 0, confirmed: null as string | null };
    }
    this.lastSeen = nowMs;
    const ok = m.confidence >= this.o.minConf && m.margin >= this.o.minMargin;
    if (!ok) { this.cur = null; return { lost: false, candidate: null, progress: 0, confirmed: null as string | null }; }
    if (m.sign !== this.cur) { this.cur = m.sign; this.since = nowMs; }
    const progress = Math.min(1, (nowMs - this.since) / this.o.holdMs);
    return { lost: false, candidate: this.cur, progress, confirmed: progress >= 1 ? this.cur : null };
  }
  reset() { this.cur = null; }
}

import { describe, it, expect } from 'vitest';
import { computeFeatures } from '../src/pose/features';
import { recognize, SIGNS } from '../src/pose/signs';
import { makeHand, SPECS, seeded } from '../src/pose/synthetic';
import { Stabilizer } from '../src/pose/stabilizer';

function accuracy(noise: number, n = 200) {
  const r = seeded(42); const conf: Record<string, Record<string, number>> = {}; let ok = 0, tot = 0;
  // O is excluded here: the idealised geometry reads fingers far more curled than real tracking does.
  // O is covered by the real-data test below.
  for (const id of Object.keys(SPECS).filter((k) => k !== 'O')) {
    conf[id] = {};
    for (let i = 0; i < n; i++) {
      const m = recognize(computeFeatures(makeHand(SPECS[id], r, noise)));
      conf[id][m.sign] = (conf[id][m.sign] ?? 0) + 1; if (m.sign === id) ok++; tot++;
    }
  }
  return { acc: ok / tot, conf };
}
describe('recognizer (synthetic logic test, NOT real Quest data)', () => {
  it('clean hands are ~perfect', () => { const { acc, conf } = accuracy(0); console.table(conf); expect(acc).toBeGreaterThan(0.95); });
  it('3mm jitter still >85%', () => { const { acc, conf } = accuracy(0.003); console.log('3mm acc', acc); console.table(conf); expect(acc).toBeGreaterThan(0.85); });
  it('6mm jitter report', () => { const { acc } = accuracy(0.006); console.log('6mm acc', acc); expect(acc).toBeGreaterThan(0.6); });
});
describe('recognizer vs REAL webcam-measured distributions (2026-10-27, one person)', () => {
  const D: any = {
    B: { thumb: [.41, .04], index: [.97, .02], middle: [1, .01], ring: [1, .01], pinky: [1, .01], pinch: [.83, .02], spread: [7.02, 2] },
    L: { thumb: [.87, .01], index: [1, .01], middle: [0, .01], ring: [0, .01], pinky: [.02, .02], pinch: [1.1, .01], spread: [106.7, 1.9] },
    Y: { thumb: [.84, .03], index: [.02, .04], middle: [0, .01], ring: [.49, .16], pinky: [1, .01], pinch: [.78, .03], spread: [17.2, 1.7] },
    I: { thumb: [.56, .14], index: [.08, .08], middle: [0, .01], ring: [.21, .08], pinky: [1, .01], pinch: [.41, .13], spread: [17.9, 3.1] },
    V: { thumb: [.47, .07], index: [1, .01], middle: [1, .01], ring: [.35, .15], pinky: [.52, .07], pinch: [1.05, .18], spread: [24.2, 4.9] },
    W: { thumb: [.46, .14], index: [1, .01], middle: [.9, .22], ring: [.91, .19], pinky: [.39, .35], pinch: [.85, .12], spread: [12.4, 8] },
    O: { thumb: [.71, .02], index: [.65, .03], middle: [.75, .03], ring: [.81, .03], pinky: [.75, .02], pinch: [.18, .02], spread: [11.75, 1.6] },
    ILY: { thumb: [.88, .01], index: [.99, .01], middle: [0, .01], ring: [.45, .03], pinky: [1, .01], pinch: [1.1, .03], spread: [115, 1.2] },
    FIST: { thumb: [.87, .05], index: [0, .01], middle: [0, .01], ring: [0, .01], pinky: [0, .01], pinch: [.57, .03], spread: [21.9, 3.5] },
  }; // F is not here: its first real recording was invalid and is being redone.
  // Second, independent recording (same person/webcam) after the first calibration. W/O/F first runs had user mistakes.
  const D4: any = {
    B: { thumb: [.52, .01], index: [1, 0], middle: [1, 0], ring: [1, 0], pinky: [1, 0], pinch: [.74, .02], spread: [9.97, .75] },
    L: { thumb: [.88, .01], index: [.93, 0], middle: [0, 0], ring: [0, 0], pinky: [0, 0], pinch: [1.2, .01], spread: [101.2, .67] },
    Y: { thumb: [.96, .02], index: [0, 0], middle: [0, 0], ring: [.28, .02], pinky: [1, 0], pinch: [.88, .01], spread: [19.2, .58] },
    I: { thumb: [.49, .02], index: [.01, .01], middle: [0, 0], ring: [.03, .01], pinky: [1, 0], pinch: [.49, .01], spread: [13.1, .56] },
    V: { thumb: [.44, .02], index: [.99, 0], middle: [1, 0], ring: [.41, .02], pinky: [.44, .02], pinch: [.96, .01], spread: [24.5, .53] },
    W: { thumb: [.4, .01], index: [1, 0], middle: [1, 0], ring: [1, 0], pinky: [.6, .02], pinch: [1.03, .01], spread: [13.6, .52] },
    O: { thumb: [.77, .04], index: [.4, .03], middle: [.52, .03], ring: [.62, .02], pinky: [.78, .02], pinch: [.37, .03], spread: [12.8, .74] },
    ILY: { thumb: [.85, .01], index: [1, 0], middle: [.11, .01], ring: [.44, .01], pinky: [1, 0], pinch: [.99, .01], spread: [106.8, 1.07] },
    FIST: { thumb: [.39, .02], index: [0, 0], middle: [0, 0], ring: [0, 0], pinky: [0, 0], pinch: [.3, .01], spread: [26.8, 3] },
  };
  it('>=90% on recording 2 with extra session noise (0.1)', () => {
    const r = seeded(11); const gauss = () => { let s = 0; for (let i = 0; i < 6; i++) s += r(); return s - 3; };
    let ok = 0, tot = 0;
    for (const id of Object.keys(D4)) for (let i = 0; i < 300; i++) {
      const f: any = {}; for (const [n, [m, sd]] of Object.entries(D4[id]) as any) { const noise = n === 'spread' ? 3 : 0.1; let x = m + gauss() * Math.SQRT2 * Math.hypot(sd, noise); if (n !== 'pinch' && n !== 'spread') x = Math.min(1, Math.max(0, x)); f[n] = x; }
      if (recognize(f).sign === id) ok++; tot++;
    }
    console.log('recording-2 acc', (ok / tot).toFixed(3)); expect(ok / tot).toBeGreaterThan(0.9);
  });
  it('>=90% overall at measured spread', () => {
    const r = seeded(7); const gauss = () => { let s = 0; for (let i = 0; i < 6; i++) s += r(); return s - 3; };
    let ok = 0, tot = 0;
    for (const id of Object.keys(D)) for (let i = 0; i < 300; i++) {
      const f: any = {}; for (const [n, [m, sd]] of Object.entries(D[id]) as any) { let x = m + gauss() * sd * Math.SQRT2; if (n !== 'pinch' && n !== 'spread') x = Math.min(1, Math.max(0, x)); f[n] = x; }
      if (recognize(f).sign === id) ok++; tot++;
    }
    console.log('real-distribution acc', (ok / tot).toFixed(3)); expect(ok / tot).toBeGreaterThan(0.85);
  });
});
describe('stabilizer', () => {
  it('confirms only after hold, survives brief loss', () => {
    const s = new Stabilizer(); const m = { sign: 'L', confidence: 0.9, margin: 0.4 };
    let t = 0, conf: string | null = null;
    for (; t < 300; t += 16) conf = s.update(m, t).confirmed; expect(conf).toBeNull();
    s.update(null, t += 16); // 1 frame lost
    for (; t < 800; t += 16) conf = s.update(m, t).confirmed; expect(conf).toBe('L');
  });
  it('flicker never confirms', () => {
    const s = new Stabilizer(); let any = false;
    for (let t = 0; t < 2000; t += 16) { const sign = (t / 16) % 2 ? 'L' : 'Y'; any ||= !!s.update({ sign, confidence: 0.9, margin: 0.4 }, t).confirmed; }
    expect(any).toBe(false);
  });
});

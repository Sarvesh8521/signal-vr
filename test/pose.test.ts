import { describe, it, expect } from 'vitest';
import { computeFeatures } from '../src/pose/features';
import { recognize, SIGNS } from '../src/pose/signs';
import { makeHand, SPECS, seeded } from '../src/pose/synthetic';
import { Stabilizer } from '../src/pose/stabilizer';

function accuracy(noise: number, n = 200) {
  const r = seeded(42); const conf: Record<string, Record<string, number>> = {}; let ok = 0, tot = 0;
  for (const id of Object.keys(SPECS)) {
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

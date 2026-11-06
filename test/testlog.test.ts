import { describe, it, expect } from 'vitest';
import { TestLog } from '../src/game/testlog';
describe('TestLog', () => {
  it('aggregates frames per target, predictions, and accepts', () => {
    const t = new TestLog(false); const f: any = { thumb: .5, index: 1, middle: 1, ring: 1, pinky: 1, pinch: .7, spread: 9 };
    for (let i = 0; i < 12; i++) t.frame('B', 'playing', f, { sign: i < 10 ? 'B' : 'F', confidence: .9, margin: .4 }, [], 100);
    t.frame('B', 'playing', f, { sign: 'B', confidence: .9, margin: .4 }, [{ type: 'success', sign: 'B', points: 10, combo: 1, daily: false }], 800);
    t.frame('B', 'playing', null, null, [], 0); t.frame('B', 'menu', f, null, [], 0);
    const s: any = t.summary();
    expect(s.frames).toBe(13); expect(s.trackingLostFrames).toBe(1);
    expect(s.signs.B.predicted).toEqual({ B: 11, F: 2 }); expect(s.signs.B.accepted).toBe(1); expect(s.signs.B.avgAcceptMs).toBe(800);
    expect(s.signs.B.mean.index).toBe(1); expect(s.signs.B.samples.length).toBe(2); expect(s.signs.B.acceptedPoses.length).toBe(1);
  });
});

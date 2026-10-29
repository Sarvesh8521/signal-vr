import { describe, it, expect } from 'vitest';
import { Game, ROUND_MS } from '../src/game/game';
import { memoryStore } from '../src/game/store';
import { seeded } from '../src/pose/synthetic';
import { recordPlay, dailySign, currentStreak } from '../src/game/daily';

const good = (sign: string) => ({ sign, confidence: 0.9, margin: 0.4 });
function run(g: Game, ms: number, pick: (g: Game) => any, t0 = 1000, poke: string | null = null) {
  let t = t0; const evs: any[] = [];
  for (; t < t0 + ms; t += 16) evs.push(...g.update(t, { match: pick(g), poke: t === t0 ? poke : null }));
  return { t, evs };
}
describe('game loop', () => {
  it('first play teaches 3 signs then runs a round to results', () => {
    const g = new Game(memoryStore(), seeded(1), '2026-10-21');
    g.update(0, { match: null, poke: 'play' }); expect(g.phase).toBe('teach');
    const { t } = run(g, 9000, (g) => (g.target ? good(g.target) : null), 100);
    expect(g.phase).toBe('playing'); expect(g.seenTeach).toBe(true);
    run(g, ROUND_MS + 3000, (g) => (g.target ? good(g.target) : null), t);
    expect(g.phase).toBe('result'); expect(g.solved).toBeGreaterThan(20); expect(g.score).toBeGreaterThan(2000);
    expect(g.streak).toBe(1); expect(g.best).toBe(g.score); expect(g.newBest).toBe(true);
  });
  it('wrong sign never scores; timeouts reset combo', () => {
    const s = memoryStore(); s.set('seenTeach', '1'); const g = new Game(s, seeded(2), '2026-10-21');
    g.update(0, { match: null, poke: 'play' }); expect(g.phase).toBe('playing');
    const { evs } = run(g, 25000, (g) => good(g.target === 'B' ? 'L' : 'B'), 100);
    expect(evs.filter((e) => e.type === 'success').length).toBe(0); expect(evs.some((e) => e.type === 'timeout')).toBe(true); expect(g.combo).toBe(0);
  });
  it('timer pauses while hand is lost', () => {
    const s = memoryStore(); s.set('seenTeach', '1'); const g = new Game(s, seeded(3), '2026-10-21');
    g.update(0, { match: null, poke: 'play' }); run(g, 5000, () => null, 100);
    expect(g.timeLeft).toBeGreaterThan(ROUND_MS - 200); expect(g.trackingLost).toBe(true);
  });
  it('brief flicker/low confidence does not score', () => {
    const s = memoryStore(); s.set('seenTeach', '1'); const g = new Game(s, seeded(4), '2026-10-21');
    g.update(0, { match: null, poke: 'play' });
    const { evs } = run(g, 3000, (g) => ({ sign: g.target!, confidence: 0.3, margin: 0.05 }), 100);
    expect(evs.filter((e) => e.type === 'success').length).toBe(0);
  });
});
describe('streaks & daily', () => {
  it('increments on consecutive days, resets after a gap, once per day', () => {
    const s = memoryStore();
    expect(recordPlay(s, '2026-10-21').streak).toBe(1); expect(recordPlay(s, '2026-10-21').firstToday).toBe(false);
    expect(recordPlay(s, '2026-10-22').streak).toBe(2); expect(recordPlay(s, '2026-10-23').streak).toBe(3);
    expect(currentStreak(s, '2026-10-24')).toBe(3); expect(currentStreak(s, '2026-10-26')).toBe(0);
    expect(recordPlay(s, '2026-10-26').streak).toBe(1); expect(s.get('bestStreak')).toBe('3');
  });
  it('daily sign is deterministic', () => { const ids = ['A', 'B', 'C', 'D']; expect(dailySign('2026-10-21', ids)).toBe(dailySign('2026-10-21', ids)); });
});

import { coachHint } from '../src/game/coach';
import { SIGNS } from '../src/pose/signs';
import { computeFeatures } from '../src/pose/features';
import { makeHand, SPECS } from '../src/pose/synthetic';
import { Mastery, levelOf } from '../src/game/mastery';
describe('coach', () => {
  it('names a real correction when the hand is wrong', () => {
    const L = SIGNS.find((s) => s.id === 'L')!; const hint = coachHint(L, computeFeatures(makeHand(SPECS.Y)));
    expect(hint).toMatch(/index|pinky/);
  });
  it('says nothing when the hand is right', () => { const B = SIGNS.find((s) => s.id === 'B')!; expect(coachHint(B, computeFeatures(makeHand(SPECS.B)))).toBeNull(); });
});
describe('mastery', () => {
  it('levels up, persists, and weights weak signs higher', () => {
    const st = memoryStore(); const m = new Mastery(st); expect(m.weight('B')).toBeGreaterThan(4);
    let up = 0; for (let i = 0; i < 8; i++) if (m.hit('B').leveledUp) up++; expect(up).toBe(3); expect(m.level('B')).toBe(3);
    expect(new Mastery(st).level('B')).toBe(3); expect(m.weight('B')).toBeLessThan(m.weight('L')); expect(levelOf(0)).toBe(0);
  });
  it('first-five-minutes teaches B, L, then I-love-you', () => {
    const g = new Game(memoryStore(), seeded(5), '2026-10-21'); const seen: string[] = []; g.update(0, { match: null, poke: 'play' }).forEach((x) => x.type === 'target' && seen.push(x.sign));
    for (let t = 100; t < 9000; t += 16) { const e = g.update(t, { match: g.target ? good(g.target) : null, poke: null }); e.forEach((x) => x.type === 'target' && g.phase === 'teach' && seen.push(x.sign)); }
    expect(seen.slice(0, 3)).toEqual(['B', 'L', 'ILY']); expect(g.phase).toBe('playing');
  });
});

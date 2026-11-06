import { describe, it, expect } from 'vitest';
import { LastLight } from '../src/game/lastlight';
import { seeded } from '../src/pose/synthetic';
const run = (ll: LastLight, secs: number, pick: (ll: LastLight) => string | null) => { const evs: any[] = []; for (let t = 0; t < secs; t += 1 / 60) evs.push(...ll.update(1 / 60, pick(ll))); return evs; };
describe('LAST LIGHT engine', () => {
  it('spawns enemies from the dark and they approach', () => { const ll = new LastLight(seeded(1)); ll.start(); run(ll, 3, () => null); expect(ll.enemies.length).toBeGreaterThan(0); expect(ll.enemies[0].dist).toBeLessThan(3.4); });
  it('perfect play survives and scores; the right sign kills the nearest match', () => {
    const ll = new LastLight(seeded(2)); ll.start(); let k = 0; const evs = run(ll, 90, (g) => { const n = g.nearest(); return n && (k++ % 40 === 0) ? n.sign : null; });
    expect(ll.phase).toBe('play'); expect(ll.kills).toBeGreaterThan(15); expect(evs.some((e) => e.type === 'kill')).toBe(true); expect(ll.light).toBeGreaterThan(50);
  });
  it('doing nothing loses: shadows reach you, light drains, game ends once with a best score', () => {
    const ll = new LastLight(seeded(3)); ll.start(); const evs = run(ll, 120, () => null);
    expect(ll.phase).toBe('over'); expect(evs.filter((e) => e.type === 'over').length).toBe(1); expect(evs.filter((e) => e.type === 'hit').length).toBeGreaterThanOrEqual(8);
  });
  it('a wrong sign does nothing; FIST shockwave clears close shadows; O heals', () => {
    const ll = new LastLight(seeded(4)); ll.start(); ll.enemies = [{ id: 1, sign: 'B', az: 0, dist: 1.0, x: 0, y: 0, z: -1 }, { id: 2, sign: 'FIST', az: 0.1, dist: 1.4, x: 0, y: 0, z: -1.4 }, { id: 3, sign: 'L', az: 0.2, dist: 1.5, x: 0, y: 0, z: -1.5 }, { id: 4, sign: 'Y', az: 0, dist: 3, x: 0, y: 0, z: -3 }];
    ll.update(0.016, 'W'); expect(ll.kills).toBe(0); ll.update(0.016, 'FIST'); expect(ll.enemies.map((e) => e.id)).toEqual([4]);
    ll.light = 50; ll.enemies = [{ id: 9, sign: 'O', az: 0, dist: 2, x: 0, y: 0, z: -2 }]; ll.update(0.016, 'O'); expect(ll.light).toBeGreaterThanOrEqual(58);
  });
  it('letters unlock by wave', () => { const ll = new LastLight(seeded(5)); ll.start(); const seen = new Set<string>(); for (let t = 0; t < 120; t += 1 / 60) { ll.update(1 / 60, ll.nearest() && t % 0.4 < 1 / 60 ? ll.nearest()!.sign : null); ll.enemies.forEach((e) => seen.add(e.sign)); if (ll.time < 14) expect([...seen].every((s) => ['B', 'L', 'Y', 'I', 'FIST'].includes(s))).toBe(true); } expect(seen.has('V') || seen.has('O')).toBe(true); });
  it('a boss arrives on wave 4 and only dies when its word is spelled', () => {
    const ll = new LastLight(seeded(6)); ll.start(); ll.time = 44.9; ll.update(0.2, null); const b = ll.boss; expect(b).not.toBeNull(); expect(b!.word).toBe('BOWL');
    ll.update(0.016, 'L'); expect(ll.boss).not.toBeNull(); const evs: any[] = [];
    for (const c of 'BOWL') evs.push(...ll.update(0.016, c)); expect(ll.boss).toBeNull(); expect(evs.some((e) => e.type === 'kill' && e.special === 'boss')).toBe(true); expect(evs.filter((e) => e.type === 'bossHit').length).toBe(3);
  });
  it('two hands: two different signs at once burn two shadows', () => {
    const ll = new LastLight(seeded(7)); ll.start(); ll.enemies = [{ id: 1, sign: 'B', az: 0, dist: 2, x: 0, y: 0, z: -2 }, { id: 2, sign: 'L', az: 0.3, dist: 2.2, x: 0, y: 0, z: -2.2 }, { id: 3, sign: 'Y', az: -0.3, dist: 2.4, x: 0, y: 0, z: -2.4 }];
    ll.update(0.016, ['B', 'L']); expect(ll.kills).toBe(2); expect(ll.enemies.map((e) => e.sign)).toEqual(['Y']);
  });
  it('MR spawn distance is configurable (room scale)', () => { const ll = new LastLight(seeded(8), 2.4); ll.start(); for (let t = 0; t < 2; t += 1 / 60) ll.update(1 / 60, null); expect(ll.enemies[0].dist).toBeLessThanOrEqual(2.4); });
  it('nothing happens while paused (hands not tracked)', () => { const ll = new LastLight(seeded(9)); ll.start(); for (let t = 0; t < 5; t += 1 / 60) ll.update(1 / 60, null, true); expect(ll.enemies.length).toBe(0); expect(ll.time).toBe(0); });
  it('relaxed mode is slower and gentler', () => {
    const a = new LastLight(seeded(10)), b = new LastLight(seeded(10)); b.relaxed = true; a.start(); b.start(); for (let t = 0; t < 12; t += 1 / 60) { a.update(1 / 60, null); b.update(1 / 60, null); }
    expect(b.enemies[0].dist).toBeGreaterThan(a.enemies[0].dist);
    const c = new LastLight(seeded(11)); c.relaxed = true; c.start(); c.enemies = [{ id: 1, sign: 'B', az: 0, dist: 0.5, x: 0, y: 0, z: -0.5 }]; c.update(0.016, null); expect(c.light).toBe(93);
  });
  it('tutorial teaches B, L, Y one at a time, one shadow at a time, with no damage', () => {
    const ll = new LastLight(seeded(12), 3.4, () => 1, true); ll.start(); expect(ll.tutorial).toEqual(['B', 'L', 'Y']); const seen: string[] = [];
    for (let t = 0; t < 60 && ll.tutorial.length; t += 1 / 60) { ll.update(1 / 60, null); expect(ll.enemies.length).toBeLessThanOrEqual(1); if (ll.enemies[0] && !seen.includes(ll.enemies[0].sign)) seen.push(ll.enemies[0].sign); if (ll.enemies[0]) ll.update(0.016, ll.enemies[0].sign); }
    expect(ll.tutorial.length).toBe(0); expect(ll.light).toBe(100); expect(seen[0]).toBe('B');
  });
  it('abilities: B shields a hit, W slows, L chains, ILY heals', () => {
    const mk = (signs: string[], dists: number[]) => { const l = new LastLight(seeded(13)); l.start(); l.enemies = signs.map((s, i) => ({ id: i + 1, sign: s, az: 0, dist: dists[i], x: 0, y: 0, z: -dists[i] })); return l; };
    let l = mk(['B', 'Y'], [2, 0.56]); l.update(0.016, 'B'); expect(l.shield).toBe(1); const ev = l.update(1, null); expect(ev.some((e: any) => e.type === 'hit' && e.blocked)).toBe(true); expect(l.light).toBe(100);
    l = mk(['W', 'Y'], [2, 2.5]); l.update(0.016, 'W'); expect(l.slowT).toBeGreaterThan(3);
    l = mk(['L', 'L', 'Y'], [2, 2.4, 2.8]); l.update(0.016, 'L'); expect(l.enemies.map((e) => e.sign)).toEqual(['Y']);
    l = mk(['ILY'], [2]); l.light = 50; l.update(0.016, 'ILY'); expect(l.light).toBeGreaterThanOrEqual(54);
  });
  it('adaptive weights make weak signs spawn more often', () => {
    const w = (s: string) => (s === 'FIST' ? 12 : 1); const ll = new LastLight(seeded(14), 3.4, w); ll.start(); const c: Record<string, number> = {};
    for (let i = 0; i < 300; i++) { ll.enemies = []; (ll as any).spawn(); const s = ll.enemies[0].sign; c[s] = (c[s] || 0) + 1; } expect(c['FIST']).toBeGreaterThan((c['B'] || 1) * 3);
  });
});

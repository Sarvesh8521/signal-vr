import { describe, it, expect } from 'vitest';
import { Game, WORDS, ROUND_MS } from '../src/game/game';
import { memoryStore } from '../src/game/store';
import { seeded, } from '../src/pose/synthetic';
import { SIGNS } from '../src/pose/signs';
const good = (sign: string) => ({ sign, confidence: 0.9, margin: 0.4 });
describe('Signal Chain', () => {
  it('only uses letters that exist as signs', () => { const ids = new Set(SIGNS.map((s) => s.id)); for (const w of WORDS) for (const c of w) expect(ids.has(c)).toBe(true); });
  it('perfect play completes words with a bonus and a clean letter order', () => {
    const s = memoryStore(); s.set('seenTeach', '1'); const g = new Game(s, seeded(5), '2026-10-21');
    g.update(0, { match: null, poke: 'play' }); const chains: any[] = []; const targets: string[] = [];
    for (let t = 16; t < ROUND_MS + 2000; t += 16) { const ev = g.update(t, { match: g.target ? good(g.target) : null, poke: null }); for (const e of ev) { if (e.type === 'chain') chains.push(e); if (e.type === 'target') targets.push(e.sign); } }
    expect(chains.length).toBeGreaterThan(1); for (const c of chains) { expect(WORDS).toContain(c.word); expect(c.bonus).toBe(60 * c.word.length); }
    expect(g.chain === null || WORDS.includes(g.chain)).toBe(true);
  });
  it('a timeout breaks the chain and no bonus is paid', () => {
    const s = memoryStore(); s.set('seenTeach', '1'); const g = new Game(s, seeded(5), '2026-10-21');
    g.update(0, { match: null, poke: 'play' }); let t = 16; let broke = false, chain = 0;
    for (; t < 40000; t += 16) { const wantMiss = g.chain && g.chainPos === 1; const ev = g.update(t, { match: g.target && !wantMiss ? good(g.target) : { sign: 'FIST', confidence: 0.9, margin: 0.4 }, poke: null }); for (const e of ev) { if (e.type === 'chain') chain++; if (e.type === 'timeout' && wantMiss) broke = true; } if (broke) break; }
    expect(broke).toBe(true); expect(g.chain).toBeNull(); expect(chain).toBe(0);
  });
});

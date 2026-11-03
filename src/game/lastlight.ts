export type LLEvent =
  | { type: 'kill'; id: number; sign: string; x: number; y: number; z: number; points: number; combo: number; special: string | null }
  | { type: 'hit'; id: number; light: number }
  | { type: 'over'; score: number; best: number; kills: number };
export interface Enemy { id: number; sign: string; az: number; dist: number; x: number; y: number; z: number; }

// Letters unlock by wave so people learn the language while playing. O and F are the hardest on real hands.
const POOLS: string[][] = [['B', 'L', 'Y', 'I', 'FIST'], ['V', 'W', 'ILY'], ['O', 'F']];

/** LAST LIGHT engine: shadows close in, each carries a handshape, a held sign burns the nearest matching one. Pure logic, no rendering. */
export class LastLight {
  phase: 'menu' | 'play' | 'over' = 'menu'; light = 100; score = 0; combo = 0; bestCombo = 0; kills = 0; time = 0; best = 0; enemies: Enemy[] = [];
  private spawnT = 0; private nid = 1;
  constructor(private rand: () => number = Math.random) { try { this.best = Number(globalThis.localStorage?.getItem('signal:ll:best')) || 0; } catch { this.best = 0; } }
  get wave() { return 1 + Math.floor(this.time / 15); }
  start() { this.phase = 'play'; this.light = 100; this.score = 0; this.combo = 0; this.bestCombo = 0; this.kills = 0; this.time = 0; this.enemies = []; this.spawnT = 1.2; }
  nearest(): Enemy | null { let b: Enemy | null = null; for (const e of this.enemies) if (!b || e.dist < b.dist) b = e; return b; }
  private pool() { const w = this.wave, p = [...POOLS[0]]; if (w >= 3) p.push(...POOLS[1]); if (w >= 5) p.push(...POOLS[2]); return p; }
  private spawn() {
    const pool = this.pool(); let sign = pool[Math.floor(this.rand() * pool.length)];
    for (let i = 0; i < 4 && this.enemies.filter((e) => e.sign === sign).length >= 2; i++) sign = pool[Math.floor(this.rand() * pool.length)];
    const az = (this.rand() - 0.5) * 2, dist = 3.4;
    this.enemies.push({ id: this.nid++, sign, az, dist, x: Math.sin(az) * dist, z: -Math.cos(az) * dist, y: (this.rand() - 0.3) * 0.7 });
  }
  private remove(e: Enemy) { const i = this.enemies.indexOf(e); if (i >= 0) this.enemies.splice(i, 1); }
  private kill(e: Enemy, ev: LLEvent[], special: string | null) {
    this.remove(e); this.combo++; this.bestCombo = Math.max(this.bestCombo, this.combo); this.kills++;
    const points = 10 + 5 * Math.min(this.combo, 10); this.score += points; this.light = Math.min(100, this.light + 1);
    ev.push({ type: 'kill', id: e.id, sign: e.sign, x: e.x, y: e.y, z: e.z, points, combo: this.combo, special });
  }
  private cast(sign: string, ev: LLEvent[]) {
    const m = this.enemies.filter((e) => e.sign === sign).sort((a, b) => a.dist - b.dist)[0]; if (!m) return;
    this.kill(m, ev, null);
    if (sign === 'FIST') for (const e of [...this.enemies]) if (e.dist < 1.6) this.kill(e, ev, 'shockwave'); // emergency shockwave
    if (sign === 'V') { const n = this.nearest(); if (n) this.kill(n, ev, 'pierce'); } // pierces the next shadow too
    if (sign === 'O') this.light = Math.min(100, this.light + 8); // O restores light
  }
  update(dt: number, confirmed: string | null): LLEvent[] {
    const ev: LLEvent[] = []; if (this.phase !== 'play') return ev;
    this.time += dt; const w = this.wave, speed = Math.min(0.45, 0.16 + 0.02 * (w - 1)), cap = Math.min(7, 2 + w), every = Math.max(1.6, 3.6 - 0.25 * (w - 1));
    this.spawnT -= dt; if (this.spawnT <= 0) { if (this.enemies.length < cap) { this.spawn(); this.spawnT = every; } else this.spawnT = 0.4; }
    for (const e of [...this.enemies]) {
      e.dist -= speed * dt; e.x = Math.sin(e.az) * e.dist; e.z = -Math.cos(e.az) * e.dist;
      if (e.dist <= 0.55) { this.remove(e); this.light = Math.max(0, this.light - 14); this.combo = 0; ev.push({ type: 'hit', id: e.id, light: this.light }); }
    }
    if (confirmed) this.cast(confirmed, ev);
    if (this.light <= 0) {
      this.phase = 'over'; if (this.score > this.best) { this.best = this.score; try { globalThis.localStorage?.setItem('signal:ll:best', String(this.best)); } catch { /* ignore */ } }
      ev.push({ type: 'over', score: this.score, best: this.best, kills: this.kills });
    }
    return ev;
  }
}

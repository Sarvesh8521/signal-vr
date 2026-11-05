export type LLEvent =
  | { type: 'kill'; id: number; sign: string; x: number; y: number; z: number; points: number; combo: number; special: string | null }
  | { type: 'hit'; id: number; light: number }
  | { type: 'bossHit'; id: number; pos: number }
  | { type: 'wave'; wave: number; name: string }
  | { type: 'over'; score: number; best: number; kills: number };
export interface Enemy { id: number; sign: string; az: number; dist: number; x: number; y: number; z: number; word?: string; pos?: number; }

// Letters unlock by wave so people learn the language while playing. O and F are the hardest on real hands.
const NAMES = ['THE DUSK', 'THE SWARM', 'GLOOM', 'NIGHTFALL', 'THE HOLLOW', 'DEEP DARK'];
const BOSSES = ['BOWL', 'BOIL', 'OILY', 'BLOW']; // a boss falls only when you spell its word
const POOLS: string[][] = [['B', 'L', 'Y', 'I', 'FIST'], ['V', 'W', 'ILY'], ['O', 'F']];

/** LAST LIGHT engine: shadows close in, each carries a handshape, a held sign burns the nearest matching one. Pure logic, no rendering. */
export class LastLight {
  phase: 'menu' | 'play' | 'over' = 'menu'; light = 100; score = 0; combo = 0; bestCombo = 0; kills = 0; time = 0; best = 0; enemies: Enemy[] = [];
  private spawnT = 0; private nid = 1; private lastWave = 1; private bossDone = 0;
  constructor(private rand: () => number = Math.random, private spawnDist = 3.4) { try { this.best = Number(globalThis.localStorage?.getItem('signal:ll:best')) || 0; } catch { this.best = 0; } }
  get wave() { return 1 + Math.floor(this.time / 15); }
  get waveName() { return NAMES[(this.wave - 1) % NAMES.length]; }
  get boss(): Enemy | null { return this.enemies.find((e) => e.word) ?? null; }
  start() { this.phase = 'play'; this.light = 100; this.score = 0; this.combo = 0; this.bestCombo = 0; this.kills = 0; this.time = 0; this.enemies = []; this.spawnT = 1.2; this.lastWave = 1; this.bossDone = 0; }
  nearest(): Enemy | null { const bs = this.boss; if (bs) return bs; let b: Enemy | null = null; for (const e of this.enemies) if (!b || e.dist < b.dist) b = e; return b; }
  private pool() { const w = this.wave, p = [...POOLS[0]]; if (w >= 3) p.push(...POOLS[1]); if (w >= 5) p.push(...POOLS[2]); return p; }
  private spawn() {
    const pool = this.pool(); let sign = pool[Math.floor(this.rand() * pool.length)];
    for (let i = 0; i < 4 && this.enemies.filter((e) => e.sign === sign).length >= 2; i++) sign = pool[Math.floor(this.rand() * pool.length)];
    const az = (this.rand() - 0.5) * 2, dist = this.spawnDist;
    this.enemies.push({ id: this.nid++, sign, az, dist, x: Math.sin(az) * dist, z: -Math.cos(az) * dist, y: (this.rand() - 0.3) * 0.7 });
  }
  private spawnBoss() { const word = BOSSES[this.bossDone % BOSSES.length]; this.bossDone++; this.enemies.push({ id: this.nid++, sign: word[0], word, pos: 0, az: 0, dist: this.spawnDist + 0.4, x: 0, z: -(this.spawnDist + 0.4), y: 0.25 }); }
  private remove(e: Enemy) { const i = this.enemies.indexOf(e); if (i >= 0) this.enemies.splice(i, 1); }
  private kill(e: Enemy, ev: LLEvent[], special: string | null) {
    this.remove(e); this.combo++; this.bestCombo = Math.max(this.bestCombo, this.combo); this.kills++;
    const points = 10 + 5 * Math.min(this.combo, 10); this.score += points; this.light = Math.min(100, this.light + 1);
    ev.push({ type: 'kill', id: e.id, sign: e.sign, x: e.x, y: e.y, z: e.z, points, combo: this.combo, special });
  }
  private cast(sign: string, ev: LLEvent[]) {
    const b = this.boss;
    if (b && b.word && sign === b.word[b.pos!]) {
      b.pos!++;
      if (b.pos! >= b.word.length) { this.kill(b, ev, 'boss'); this.score += 200; this.light = Math.min(100, this.light + 20); for (const e of [...this.enemies]) this.kill(e, ev, 'shockwave'); }
      else { b.sign = b.word[b.pos!]; ev.push({ type: 'bossHit', id: b.id, pos: b.pos! }); }
      return;
    }
    const m = this.enemies.filter((e) => !e.word && e.sign === sign).sort((a, c) => a.dist - c.dist)[0]; if (!m) return;
    this.kill(m, ev, null);
    if (sign === 'FIST') for (const e of [...this.enemies]) if (!e.word && e.dist < 1.6) this.kill(e, ev, 'shockwave'); // emergency shockwave
    if (sign === 'V') { const n = this.enemies.filter((e) => !e.word).sort((a, c) => a.dist - c.dist)[0]; if (n) this.kill(n, ev, 'pierce'); } // pierces the next shadow too
    if (sign === 'O') this.light = Math.min(100, this.light + 8); // O restores light
  }
  update(dt: number, confirmed: string | string[] | null): LLEvent[] {
    const ev: LLEvent[] = []; if (this.phase !== 'play') return ev;
    this.time += dt; const w = this.wave, speed = Math.min(0.45, 0.16 + 0.02 * (w - 1)), cap = Math.min(7, 2 + w), every = Math.max(1.6, 3.6 - 0.25 * (w - 1));
    if (this.wave !== this.lastWave) { this.lastWave = this.wave; ev.push({ type: 'wave', wave: this.wave, name: this.waveName }); }
    if (this.bossDone < Math.floor(this.wave / 4) && !this.boss) this.spawnBoss();
    this.spawnT -= dt; if (this.spawnT <= 0) { if (this.enemies.filter((e) => !e.word).length < cap) { this.spawn(); if (this.wave >= 3 && this.rand() < 0.3 && this.enemies.filter((e) => !e.word).length < cap) this.spawn(); this.spawnT = every; } else this.spawnT = 0.4; }
    for (const e of [...this.enemies]) {
      e.dist -= (e.word ? speed * 0.45 : speed) * dt; e.x = Math.sin(e.az) * e.dist; e.z = -Math.cos(e.az) * e.dist;
      if (e.dist <= (e.word ? 0.8 : 0.55)) { this.remove(e); this.light = Math.max(0, this.light - (e.word ? 40 : 14)); this.combo = 0; ev.push({ type: 'hit', id: e.id, light: this.light }); }
    }
    for (const c of confirmed ? (Array.isArray(confirmed) ? confirmed : [confirmed]) : []) this.cast(c, ev); // each hand can cast its own sign
    if (this.light <= 0) {
      this.phase = 'over'; if (this.score > this.best) { this.best = this.score; try { globalThis.localStorage?.setItem('signal:ll:best', String(this.best)); } catch { /* ignore */ } }
      ev.push({ type: 'over', score: this.score, best: this.best, kills: this.kills });
    }
    return ev;
  }
}

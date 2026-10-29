import { Store } from './store';
export interface SignStat { xp: number; miss: number; }
export const LEVEL_XP = [1, 4, 8]; // xp needed for level 1, 2, 3 (3 = mastered)
export const levelOf = (xp: number) => LEVEL_XP.filter((x) => xp >= x).length;

/** Per-sign progress that persists between sessions: drives adaptive practice and the visible "Your Sky" growth. */
export class Mastery {
  private d: Record<string, SignStat> = {};
  constructor(private store: Store) { try { this.d = JSON.parse(store.get('mastery') ?? '{}') || {}; } catch { this.d = {}; } }
  private save() { this.store.set('mastery', JSON.stringify(this.d)); }
  stat(id: string): SignStat { return this.d[id] ?? { xp: 0, miss: 0 }; }
  level(id: string) { return levelOf(this.stat(id).xp); }
  hit(id: string): { leveledUp: boolean; level: number } { const s = { ...this.stat(id) }; const before = levelOf(s.xp); s.xp++; s.miss = Math.max(0, s.miss - 1); this.d[id] = s; this.save(); const level = levelOf(s.xp); return { leveledUp: level > before, level }; }
  miss(id: string) { const s = { ...this.stat(id) }; s.miss++; this.d[id] = s; this.save(); }
  /** Total stars lit in the player's sky: one per level gained across all signs. */
  stars(ids: string[]) { return ids.reduce((n, id) => n + this.level(id), 0); }
  mastered(ids: string[]) { return ids.filter((id) => this.level(id) >= 3).length; }
  /** Weight for adaptive picking: less-mastered and recently-missed signs come up more often. */
  weight(id: string) { return 1 + (3 - this.level(id)) * 1.5 + Math.min(this.stat(id).miss, 4) * 0.75; }
}

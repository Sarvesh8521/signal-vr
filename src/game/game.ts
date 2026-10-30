import { Match, Features } from '../pose/types';
import { Stabilizer, DEFAULT_STAB } from '../pose/stabilizer';
import { SIGNS } from '../pose/signs';
import { Mastery } from './mastery';
import { coachHint } from './coach';
import { Store } from './store';
import { dailySign, dayKey, recordPlay, currentStreak } from './daily';

export type Phase = 'menu' | 'teach' | 'playing' | 'result';
export type GameEvent =
  | { type: 'phase'; phase: Phase }
  | { type: 'target'; sign: string }
  | { type: 'success'; sign: string; points: number; combo: number; daily: boolean }
  | { type: 'timeout'; sign: string }
  | { type: 'chain'; word: string; bonus: number };
export interface Input { match: Match | null; poke: string | null; features?: Features | null; }

export const ROUND_MS = 60000, TARGET_TIMEOUT_MS = 10000, HINT_AFTER_MS = 3500, CELEBRATE_MS = 550;
const EASY = ['B', 'L', 'Y', 'I', 'FIST'];
// First five minutes: easiest win first, then an emotional payoff - your first real sentence.
const TEACH = ['B', 'L', 'ILY'];
const ALL = SIGNS.map((s) => s.id);
// Signal Chain words: spelled only with letters that recognise reliably on real hands.
export const WORDS = ['BOWL', 'BOIL', 'OILY', 'BLOW', 'VOW', 'LOW'];

export class Game {
  phase: Phase = 'menu';
  score = 0; combo = 0; bestCombo = 0; solved = 0; timeLeft = ROUND_MS;
  target: string | null = null; targetAge = 0; holdProgress = 0; trackingLost = false; celebrate = 0;
  teachIndex = 0; coach: string | null = null; private coachAt = 0; leveledUp: string | null = null; mastery: Mastery; best: number; streak: number; dailyId: string; newBest = false; roundStreak = 0;
  chain: string | null = null; chainPos = 0; private sinceChain = 0;
  private stab = new Stabilizer(DEFAULT_STAB); private prev: string | null = null; private now = 0;
  constructor(private store: Store, private rand: () => number = Math.random, private today = dayKey()) {
    this.mastery = new Mastery(store); this.best = Number(store.get('best') ?? 0); this.dailyId = dailySign(today, ALL); this.streak = currentStreak(store, today);
  }
  get showHint() { return this.phase === 'teach' || this.targetAge > HINT_AFTER_MS; }
  get seenTeach() { return this.store.get('seenTeach') === '1'; }

  private setPhase(p: Phase, ev: GameEvent[]) { this.phase = p; ev.push({ type: 'phase', phase: p }); }
  private pick(): string {
    const pool = this.solved < 4 ? EASY : ALL;
    let id: string; let guard = 0;
    do { id = this.rand() < 0.22 && this.solved >= 2 ? this.dailyId : this.weighted(pool); } while (id === this.prev && guard++ < 20);
    return id;
  }
  /** Adaptive practice: signs you know less / recently missed appear more often. */
  private weighted(pool: string[]): string {
    const w = pool.map((id) => this.mastery.weight(id)); let r = this.rand() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return pool[i]; } return pool[pool.length - 1];
  }
  private nextTarget(ev: GameEvent[], forced?: string) {
    this.coach = null; this.leveledUp = null;
    if (!forced && this.phase === 'playing') {
      if (!this.chain && this.sinceChain >= 5 && this.solved >= 3) { this.chain = WORDS[Math.floor(this.rand() * WORDS.length)]; this.chainPos = 0; }
      if (this.chain) forced = this.chain[this.chainPos];
    }
    this.target = forced ?? this.pick(); this.prev = this.target; this.targetAge = 0; this.holdProgress = 0; this.stab.reset();
    ev.push({ type: 'target', sign: this.target });
  }
  startRound(ev: GameEvent[] = []) {
    this.score = 0; this.combo = 0; this.bestCombo = 0; this.solved = 0; this.timeLeft = ROUND_MS; this.newBest = false; this.celebrate = 0; this.chain = null; this.chainPos = 0; this.sinceChain = 0;
    this.setPhase('playing', ev); this.nextTarget(ev); return ev;
  }
  startTeach(ev: GameEvent[] = []) { this.teachIndex = 0; this.setPhase('teach', ev); this.nextTarget(ev, TEACH[0]); return ev; }

  update(nowMs: number, input: Input): GameEvent[] {
    const dt = this.now ? Math.min(100, nowMs - this.now) : 0; this.now = nowMs; const ev: GameEvent[] = [];
    if (this.phase === 'menu' || this.phase === 'result') {
      if (input.poke === 'play') { if (this.phase === 'menu' && !this.seenTeach) this.startTeach(ev); else this.startRound(ev); }
      return ev;
    }
    this.trackingLost = input.match == null;
    if (this.celebrate > 0) {
      if (this.phase === 'playing') { this.timeLeft -= dt; if (this.timeLeft <= 0) { this.timeLeft = 0; this.finish(ev); return ev; } } // clock keeps running during celebration
      this.celebrate -= dt; if (this.celebrate <= 0) this.afterCelebrate(ev); return ev;
    }
    if (input.features && this.target && nowMs - this.coachAt > 350) { this.coachAt = nowMs; const def = SIGNS.find((x) => x.id === this.target); this.coach = def && this.targetAge > 2500 ? coachHint(def, input.features) : null; }
    const st = this.stab.update(input.match, nowMs);
    this.holdProgress = st.candidate === this.target ? st.progress : 0;
    if (this.trackingLost) return ev; // fair: pause timers while the hand is not tracked
    if (this.phase === 'playing') { this.timeLeft -= dt; if (this.timeLeft <= 0) { this.timeLeft = 0; this.finish(ev); return ev; } }
    this.targetAge += dt;
    if (st.confirmed && st.confirmed === this.target) { this.succeed(ev); return ev; }
    if (this.phase === 'playing' && this.targetAge >= TARGET_TIMEOUT_MS) { ev.push({ type: 'timeout', sign: this.target! }); this.mastery.miss(this.target!); this.combo = 0; this.chain = null; this.chainPos = 0; this.sinceChain = 0; this.nextTarget(ev); }
    return ev;
  }
  private succeed(ev: GameEvent[]) {
    const isDaily = this.target === this.dailyId; this.combo++; this.bestCombo = Math.max(this.bestCombo, this.combo);
    const speed = Math.round(50 * Math.max(0, 1 - this.targetAge / 6000)); const pts = (100 + speed + Math.min(this.combo, 10) * 10) * (isDaily ? 2 : 1);
    if (this.phase === 'playing') { this.score += pts; this.solved++; }
    const m = this.mastery.hit(this.target!); this.leveledUp = m.leveledUp ? this.target : null;
    if (this.phase === 'playing') {
      if (this.chain) { this.chainPos++; if (this.chainPos >= this.chain.length) { const bonus = 60 * this.chain.length; this.score += bonus; ev.push({ type: 'chain', word: this.chain, bonus }); this.chain = null; this.chainPos = 0; this.sinceChain = 0; } }
      else this.sinceChain++;
    }
    ev.push({ type: 'success', sign: this.target!, points: pts, combo: this.combo, daily: isDaily }); this.celebrate = this.phase === 'teach' && this.teachIndex === TEACH.length - 1 ? 2200 : CELEBRATE_MS; this.holdProgress = 1;
  }
  private afterCelebrate(ev: GameEvent[]) {
    if (this.phase === 'teach') {
      this.teachIndex++;
      if (this.teachIndex >= TEACH.length) { this.store.set('seenTeach', '1'); this.startRound(ev); } else this.nextTarget(ev, TEACH[this.teachIndex]);
    } else this.nextTarget(ev);
  }
  private finish(ev: GameEvent[]) {
    if (this.score > this.best) { this.best = this.score; this.newBest = true; this.store.set('best', String(this.best)); }
    this.streak = recordPlay(this.store, this.today).streak; this.target = null; this.setPhase('result', ev);
  }
}

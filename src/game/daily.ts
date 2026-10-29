import { Store } from './store';
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayNum = (k: string) => { const [y, m, d] = k.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); };
/** Same sign for everyone on a given date -> shared "Sign of the Day". */
export function dailySign(day: string, ids: string[]): string {
  let h = 2166136261; for (const c of day) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return ids[h % ids.length];
}
/** Call once when a round is completed. Returns the streak after counting today. */
export function recordPlay(store: Store, today: string): { streak: number; firstToday: boolean; bestStreak: number } {
  const last = store.get('lastDay'); let streak = Number(store.get('streak') ?? 0); let firstToday = false;
  if (last !== today) {
    firstToday = true;
    streak = last && dayNum(today) - dayNum(last) === 1 ? streak + 1 : 1;
    store.set('lastDay', today); store.set('streak', String(streak));
  }
  const bestStreak = Math.max(streak, Number(store.get('bestStreak') ?? 0)); store.set('bestStreak', String(bestStreak));
  return { streak, firstToday, bestStreak };
}
export const currentStreak = (store: Store, today: string) => {
  const last = store.get('lastDay'); const s = Number(store.get('streak') ?? 0);
  if (!last) return 0; const gap = dayNum(today) - dayNum(last); return gap <= 1 ? s : 0; // gap 1 = still alive, play today to extend
};

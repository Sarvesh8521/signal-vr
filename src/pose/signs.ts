import { Features, Match } from './types';

/** Target value + tolerance per feature. Tolerances are deliberately WIDE (tracking is noisy). */
type T = [number, number];
export interface SignDef { id: string; label: string; hint: string; t: Partial<Record<keyof Features, T>>; }

const UP: T = [1, 0.3], DOWN: T = [0, 0.3];
// Ring/pinky/middle often sit half-curled next to a raised finger on real hands: loose "down".
const LOOSE: T = [0.2, 0.4];
// Calibrated on real webcam hand data (2026-10-27). Quest data will refine these.
export const SIGNS: SignDef[] = [
  { id: 'B', label: 'B', hint: 'Flat hand, fingers together and straight up, thumb across the palm', t: { thumb: [0.4, 0.3], index: UP, middle: UP, ring: UP, pinky: UP, spread: [7, 10] } },
  { id: 'L', label: 'L', hint: 'Thumb and index straight (an L), other three fingers curled', t: { thumb: [0.87, 0.2], index: UP, middle: DOWN, ring: DOWN, pinky: DOWN } },
  { id: 'Y', label: 'Y', hint: 'Thumb and pinky out, other three curled', t: { thumb: [0.9, 0.12], index: DOWN, middle: DOWN, ring: LOOSE, pinky: UP, pinch: [0.85, 0.25] } },
  { id: 'I', label: 'I', hint: 'Only the pinky up, thumb tucked', t: { thumb: [0.5, 0.15], index: DOWN, middle: DOWN, ring: LOOSE, pinky: UP, pinch: [0.45, 0.2] } },
  { id: 'V', label: 'V', hint: 'Index and middle up and spread apart, others curled', t: { index: UP, middle: UP, ring: LOOSE, pinky: [0.4, 0.3], spread: [21, 10] } },
  { id: 'W', label: 'W', hint: 'Index, middle, ring up and spread; pinky held by the thumb', t: { index: UP, middle: UP, ring: UP, pinky: [0.5, 0.3], thumb: [0.43, 0.3], spread: [13, 6] } },
  { id: 'O', label: 'O', hint: 'All fingertips touch the thumb in a circle', t: { thumb: [0.74, 0.2], index: [0.52, 0.25], middle: [0.63, 0.25], ring: [0.71, 0.2], pinky: [0.62, 0.22], pinch: [0.27, 0.15] } },
  { id: 'F', label: 'F', hint: 'Thumb and index pinched, other three fingers straight up', t: { pinch: [0.25, 0.15], index: [0.7, 0.3], middle: [1, 0.15], ring: [1, 0.15], pinky: [1, 0.15], spread: [60, 30] } },
  { id: 'ILY', label: 'I love you', hint: 'Thumb, index and pinky out; middle and ring curled', t: { thumb: [0.88, 0.2], index: UP, middle: DOWN, ring: LOOSE, pinky: UP } },
  { id: 'FIST', label: 'S (fist)', hint: 'Close all four fingers into a fist', t: { index: DOWN, middle: DOWN, ring: DOWN, pinky: DOWN, pinch: [0.57, 0.25] } },
];

export function scoreSign(def: SignDef, f: Features): number {
  let sum = 0, n = 0, min = 1;
  for (const k in def.t) {
    const tt = def.t[k as keyof Features] as T; const z = (f[k as keyof Features] - tt[0]) / tt[1]; const g = Math.exp(-0.5 * z * z);
    sum += g; n++; if (g < min) min = g;
  }
  return n ? 0.5 * (sum / n) + 0.5 * min : 0; // one strong mismatch can't be averaged away
}
export function recognize(f: Features, set: SignDef[] = SIGNS): Match {
  let best = -1, second = 0, id = '';
  for (let i = 0; i < set.length; i++) { const v = scoreSign(set[i], f); if (v > best) { if (best > 0) second = best; best = v; id = set[i].id; } else if (v > second) second = v; }
  return { sign: id, confidence: best, margin: best - second };
}

import { Features } from '../pose/types';
import { SignDef } from '../pose/signs';
const FNAME: Record<string, string> = { index: 'index', middle: 'middle', ring: 'ring', pinky: 'pinky' };

/** Turns "what's wrong with your hand" into one plain-language correction. Deterministic, on-device, no network. */
export function coachHint(def: SignDef, f: Features, threshold = 1.4): string | null {
  let worstK: keyof Features | null = null, worst = 0, dev = 0;
  for (const [k, [mu, sigma]] of Object.entries(def.t) as [keyof Features, [number, number]][]) {
    const z = (f[k] - mu) / sigma; if (Math.abs(z) > Math.abs(worst) && Math.abs(z) > threshold) { worst = z; worstK = k; dev = z; }
  }
  if (!worstK) return null;
  if (worstK === 'thumb') return dev > 0 ? 'Tuck your thumb in' : 'Stretch your thumb out';
  if (worstK === 'pinch') return dev > 0 ? 'Bring thumb and index fingertips together' : 'Open thumb and index apart';
  if (worstK === 'spread') return dev > 0 ? 'Bring index and middle fingers together' : 'Spread index and middle fingers apart';
  return dev > 0 ? `Curl your ${FNAME[worstK]} finger` : `Straighten your ${FNAME[worstK]} finger`;
}

import { Joints, V3, Features, FINGERS } from './types';

const d = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));

function chain(j: Joints, name: string): V3[] {
  const base = name === 'thumb'
    ? ['thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip']
    : [`${name}-finger-phalanx-proximal`, `${name}-finger-phalanx-intermediate`, `${name}-finger-phalanx-distal`, `${name}-finger-tip`];
  return base.map((k) => j[k]);
}
/** straightness ratio: end-to-end distance / path length. ~1 straight, ~0.45 fully curled. */
function extension(pts: V3[]): number {
  let path = 0;
  for (let i = 1; i < pts.length; i++) path += d(pts[i - 1], pts[i]);
  const r = d(pts[0], pts[pts.length - 1]) / (path || 1e-6);
  return clamp((r - 0.5) / (0.95 - 0.5));
}
export function hasHand(j: Joints | null | undefined): j is Joints {
  return !!j && !!j['wrist'] && !!j['index-finger-tip'] && !!j['thumb-tip'] && !!j['pinky-finger-tip'];
}
export function computeFeatures(j: Joints): Features {
  const palm = d(j['wrist'], j['middle-finger-phalanx-proximal']) || 1e-6;
  // Thumb chain is almost always 'straight', so use abduction: tip distance from index knuckle / palm size.
  const abd = d(j['thumb-tip'], j['index-finger-metacarpal'] ?? j['index-finger-phalanx-proximal']) / palm;
  const f: any = { thumb: clamp((abd - 0.45) / (1.15 - 0.45)) };
  for (const n of FINGERS) f[n] = extension(chain(j, n));
  f.pinch = d(j['thumb-tip'], j['index-finger-tip']) / palm;
  const a = sub(j['index-finger-tip'], j['index-finger-phalanx-proximal']);
  const b = sub(j['middle-finger-tip'], j['middle-finger-phalanx-proximal']);
  const cos = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / ((Math.hypot(...a) * Math.hypot(...b)) || 1e-6);
  f.spread = (Math.acos(clamp(cos, -1, 1)) * 180) / Math.PI;
  return f as Features;
}

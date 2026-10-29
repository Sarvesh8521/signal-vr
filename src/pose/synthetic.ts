import { Joints, V3 } from './types';

/** Parametric synthetic hand (meters). Used ONLY for logic tests — NOT a substitute for real Quest data. */
export interface HandSpec {
  curl: { thumb: number; index: number; middle: number; ring: number; pinky: number }; // 0 straight .. 1 fully curled
  spreadDeg?: number;       // fan between index and middle (others follow)
  pinchTo?: 'index' | null; // pull thumb tip to index tip
  circle?: boolean;         // O shape: all tips toward thumb tip
}
const SEG = [0.045, 0.026, 0.02, 0.018];
const BASES: Record<string, number> = { index: -0.03, middle: -0.01, ring: 0.01, pinky: 0.03 };
const NAMES = ['phalanx-proximal', 'phalanx-intermediate', 'phalanx-distal', 'tip'];

function fingerChain(base: V3, curl: number, yaw: number): V3[] {
  const out: V3[] = []; let p: V3 = [...base] as V3; let ang = 0;
  for (let i = 0; i < 4; i++) {
    out.push([...p] as V3);
    ang += (i === 0 ? 0.5 : 0.95) * curl * (Math.PI / 2) * (i === 0 ? 1 : 1);
    const len = SEG[i];
    p = [p[0] + Math.sin(yaw) * Math.cos(ang) * len, p[1] + Math.cos(yaw) * Math.cos(ang) * len, p[2] - Math.sin(ang) * len];
  }
  return out;
}
export function makeHand(spec: HandSpec, rand: () => number = Math.random, noise = 0): Joints {
  const j: Joints = { wrist: [0, 0, 0] };
  const spread = ((spec.spreadDeg ?? 6) * Math.PI) / 180;
  const yaws: Record<string, number> = { index: -spread / 2, middle: spread / 2, ring: spread, pinky: spread * 1.6 };
  for (const f of ['index', 'middle', 'ring', 'pinky']) {
    const c = fingerChain([BASES[f], 0.09, 0], spec.curl[f as 'index'], yaws[f]);
    j[`${f}-finger-metacarpal`] = [BASES[f], 0.0, 0];
    NAMES.forEach((n, i) => (j[`${f}-finger-${n}`] = c[i]));
  }
  // thumb: interpolate tip between tucked (across palm) and out (abducted) by (1-curl)
  const out = 1 - spec.curl.thumb;
  const tb: V3 = [-0.03, 0.02, 0];
  const tucked: V3 = [-0.005, 0.05, -0.03], outP: V3 = [-0.095, 0.075, -0.005];
  const tip: V3 = [tucked[0] + (outP[0] - tucked[0]) * out, tucked[1] + (outP[1] - tucked[1]) * out, tucked[2] + (outP[2] - tucked[2]) * out];
  j['thumb-metacarpal'] = tb;
  j['thumb-phalanx-proximal'] = [tb[0] + (tip[0] - tb[0]) * 0.4, tb[1] + (tip[1] - tb[1]) * 0.4, tb[2] + (tip[2] - tb[2]) * 0.4];
  j['thumb-phalanx-distal'] = [tb[0] + (tip[0] - tb[0]) * 0.75, tb[1] + (tip[1] - tb[1]) * 0.75, tb[2] + (tip[2] - tb[2]) * 0.75];
  j['thumb-tip'] = tip;
  const lerp = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  if (spec.pinchTo === 'index' || spec.circle) {
    const tip = lerp(j['index-finger-tip'], [-0.012, 0.075, -0.035], spec.circle ? 1 : 0);
    if (spec.circle) {
      for (const f of ['index', 'middle', 'ring', 'pinky']) j[`${f}-finger-tip`] = lerp(j[`${f}-finger-tip`], tip, 0.8);
      j['index-finger-tip'] = tip;
    }
    j['thumb-tip'] = lerp(j['thumb-tip'], j['index-finger-tip'], 0.97);
    j['thumb-phalanx-distal'] = lerp(j['thumb-phalanx-distal'], j['index-finger-tip'], 0.6);
    j['thumb-phalanx-proximal'] = lerp(j['thumb-phalanx-proximal'], j['index-finger-tip'], 0.3);
  }
  if (noise > 0) {
    const g = () => { let s = 0; for (let i = 0; i < 6; i++) s += rand(); return (s - 3) / 1.0; }; // ~N(0,1)
    for (const k of Object.keys(j)) j[k] = [j[k][0] + g() * noise, j[k][1] + g() * noise, j[k][2] + g() * noise];
  }
  return j;
}

const C = (thumb: number, index: number, middle: number, ring: number, pinky: number) => ({ thumb, index, middle, ring, pinky });
export const SPECS: Record<string, HandSpec> = {
  B: { curl: C(0.7, 0, 0, 0, 0), spreadDeg: 0 },
  L: { curl: C(0, 0, 1, 1, 1) },
  Y: { curl: C(0, 1, 1, 1, 0) },
  I: { curl: C(0.7, 1, 1, 1, 0) },
  V: { curl: C(0.8, 0, 0, 1, 1), spreadDeg: 40 },
  W: { curl: C(0.7, 0, 0, 0, 1), spreadDeg: 18 },
  O: { curl: C(0.3, 0.45, 0.45, 0.45, 0.45), circle: true },
  F: { curl: C(0.4, 0.5, 0, 0, 0), pinchTo: 'index' },
  ILY: { curl: C(0, 0, 1, 1, 0) },
  FIST: { curl: C(0.8, 1, 1, 1, 1) },
};
export function seeded(seed: number) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

import { WebGLRenderer, Vector3 } from '@iwsdk/core';
import { Joints, Match, Features } from '../pose/types';
import { computeFeatures, hasHand } from '../pose/features';
import { recognize } from '../pose/signs';
import { makeHand, SPECS } from '../pose/synthetic';

const JOINT_NAMES = ['wrist', 'thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip',
  ...['index', 'middle', 'ring', 'pinky'].flatMap((f) => [`${f}-finger-metacarpal`, `${f}-finger-phalanx-proximal`, `${f}-finger-phalanx-intermediate`, `${f}-finger-phalanx-distal`, `${f}-finger-tip`])];

export interface HandFrame { match: Match | null; features: Features | null; tips: Vector3[]; tracked: number; }

/** Reads tracked hands from the XR session. Debug keys (1-9,0) inject synthetic poses so the whole loop is testable without a headset. */
export class HandInput {
  fakeSign: string | null = null; fakeTip: Vector3 | null = null; private v = new Vector3();
  constructor(private renderer: WebGLRenderer) {}
  private readXR(i: number): { j: Joints; tip: Vector3 } | null {
    const hand: any = this.renderer.xr.getHand(i); const js = hand?.joints; if (!js || !js['wrist'] || !js['wrist'].visible) return null;
    const j: Joints = {}; for (const n of JOINT_NAMES) { const o = js[n]; if (!o || !o.visible) return null; o.updateWorldMatrix(true, false); this.v.setFromMatrixPosition(o.matrixWorld); j[n] = [this.v.x, this.v.y, this.v.z]; }
    const t = j['index-finger-tip']; return hasHand(j) ? { j, tip: new Vector3(t[0], t[1], t[2]) } : null;
  }
  read(): HandFrame {
    const hands: { j: Joints; tip: Vector3 }[] = [];
    if (this.fakeSign && SPECS[this.fakeSign]) hands.push({ j: makeHand(SPECS[this.fakeSign]), tip: this.fakeTip ?? new Vector3(99, 99, 99) });
    else for (let i = 0; i < 2; i++) { const h = this.readXR(i); if (h) hands.push(h); }
    let best: Match | null = null, bf: Features | null = null;
    for (const h of hands) { const f = computeFeatures(h.j); const m = recognize(f); if (!best || m.confidence > best.confidence) { best = m; bf = f; } }
    return { match: best, features: bf, tips: hands.map((h) => h.tip), tracked: hands.length };
  }
}

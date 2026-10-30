import { WebGLRenderer, Vector3 } from '@iwsdk/core';
import { Joints, Match, Features } from '../pose/types';
import { computeFeatures, hasHand } from '../pose/features';
import { recognize } from '../pose/signs';
import { makeHand, SPECS } from '../pose/synthetic';

const JOINT_NAMES = ['wrist', 'thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip',
  ...['index', 'middle', 'ring', 'pinky'].flatMap((f) => [`${f}-finger-metacarpal`, `${f}-finger-phalanx-proximal`, `${f}-finger-phalanx-intermediate`, `${f}-finger-phalanx-distal`, `${f}-finger-tip`])];

const FAR = new Vector3(99, 99, 99);
export interface HandFrame { match: Match | null; features: Features | null; tips: Vector3[]; tracked: number; }

/** Reads tracked hands from the XR session. Debug keys (1-9,0) inject synthetic poses so the whole loop is testable without a headset. */
export class HandInput {
  fakeSign: string | null = null; fakeTip: Vector3 | null = null; private v = new Vector3();
  constructor(private renderer: WebGLRenderer) {}
  private bufJ: Joints[] = [0, 1].map(() => { const j: Joints = {}; for (const n of JOINT_NAMES) j[n] = [0, 0, 0]; return j; });
  private bufT = [new Vector3(), new Vector3()];
  private out: HandFrame = { match: null, features: null, tips: [], tracked: 0 };
  private bestM: Match | null = null; private bestF: Features | null = null;
  private readXR(i: number): boolean {
    const hand: any = this.renderer.xr.getHand(i); const js = hand?.joints; if (!js || !js['wrist'] || !js['wrist'].visible) return false;
    const j = this.bufJ[i];
    for (const n of JOINT_NAMES) { const o = js[n]; if (!o || !o.visible) return false; o.updateWorldMatrix(true, false); this.v.setFromMatrixPosition(o.matrixWorld); const q = j[n]; q[0] = this.v.x; q[1] = this.v.y; q[2] = this.v.z; }
    if (!hasHand(j)) return false; const t = j['index-finger-tip']; this.bufT[i].set(t[0], t[1], t[2]); return true;
  }
  private take(j: Joints, tip: Vector3) {
    const f = computeFeatures(j); const m = recognize(f); this.out.tips.push(tip);
    if (!this.bestM || m.confidence > this.bestM.confidence) { this.bestM = m; this.bestF = f; }
  }
  read(): HandFrame {
    const o = this.out; o.tips.length = 0; this.bestM = null; this.bestF = null;
    if (this.fakeSign && SPECS[this.fakeSign]) this.take(makeHand(SPECS[this.fakeSign]), this.fakeTip ?? FAR);
    else for (let i = 0; i < 2; i++) if (this.readXR(i)) this.take(this.bufJ[i], this.bufT[i]);
    o.match = this.bestM; o.features = this.bestF; o.tracked = o.tips.length; return o;
  }
}

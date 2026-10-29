import { Group, Mesh, SphereGeometry, CylinderGeometry, MeshBasicMaterial, Vector3, Quaternion, Color, AdditiveBlending } from '@iwsdk/core';
import { Joints } from '../pose/types';

const CHAINS: string[][] = [
  ['wrist', 'thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip'],
  ...['index', 'middle', 'ring', 'pinky'].map((f) => ['wrist', `${f}-finger-metacarpal`, `${f}-finger-phalanx-proximal`, `${f}-finger-phalanx-intermediate`, `${f}-finger-phalanx-distal`, `${f}-finger-tip`]),
];
const PALM: [string, string][] = [['index-finger-metacarpal', 'middle-finger-metacarpal'], ['middle-finger-metacarpal', 'ring-finger-metacarpal'], ['ring-finger-metacarpal', 'pinky-finger-metacarpal']];

/** Glowing "teacher hand" built from the same joint model the recognizer uses. */
export class GhostHand {
  readonly group = new Group(); private joints = new Map<string, Mesh>(); private bones: { a: string; b: string; m: Mesh }[] = [];
  private mat = new MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.95, depthWrite: false, blending: AdditiveBlending }); private boneMat = new MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.7, depthWrite: false, blending: AdditiveBlending });
  private up = new Vector3(0, 1, 0); private tmp = new Vector3(); private q = new Quaternion();
  constructor() {
    const sg = new SphereGeometry(0.0085, 10, 8); const cg = new CylinderGeometry(0.0035, 0.0035, 1, 6);
    const names = new Set<string>(); CHAINS.flat().forEach((n) => names.add(n)); PALM.flat().forEach((n) => names.add(n));
    names.forEach((n) => { const m = new Mesh(sg, this.mat); this.joints.set(n, m); this.group.add(m); });
    const pairs: [string, string][] = [...PALM]; CHAINS.forEach((c) => { for (let i = 1; i < c.length; i++) pairs.push([c[i - 1], c[i]]); });
    pairs.forEach(([a, b]) => { const m = new Mesh(cg, this.boneMat); this.bones.push({ a, b, m }); this.group.add(m); });
  }
  setColor(hex: number | string) { (this.mat.color as Color).set(hex as any); (this.boneMat.color as Color).set(hex as any); }
  setPose(j: Joints) {
    this.joints.forEach((m, n) => { const p = j[n]; if (p) m.position.set(p[0], p[1], p[2]); });
    for (const { a, b, m } of this.bones) {
      const pa = j[a], pb = j[b]; if (!pa || !pb) { m.visible = false; continue; } m.visible = true;
      this.tmp.set(pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]); const len = this.tmp.length() || 1e-6;
      m.position.set((pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2, (pa[2] + pb[2]) / 2); m.scale.set(1, len, 1);
      this.q.setFromUnitVectors(this.up, this.tmp.normalize()); m.quaternion.copy(this.q);
    }
  }
}

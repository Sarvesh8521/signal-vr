import { Group, Mesh, MeshBasicMaterial, SphereGeometry, CylinderGeometry, Vector3, Quaternion, AdditiveBlending } from '@iwsdk/core';
import { TextPlane, COLORS } from './ui';
import type { Enemy } from './lastlight';

const MAXE = 10, NP = 40, NB = 6, UP = new Vector3(0, 1, 0);
const txt = (s: string) => (s === 'FIST' ? 'S' : s);
interface Slot { g: Group; halo: Mesh; label: TextPlane; id: number; sign: string; }

/** Pooled visuals for LAST LIGHT: shadow wisps with letter labels, light beams, burst particles. */
export class LLView {
  group = new Group(); private slots: Slot[] = []; private parts: { m: Mesh; v: Vector3; life: number }[] = []; private beams: { m: Mesh; life: number }[] = [];
  private tmp = new Vector3(); private dir = new Vector3();
  constructor(scene: any) {
    for (let i = 0; i < MAXE; i++) {
      const g = new Group(), core = new Mesh(new SphereGeometry(0.085, 16, 12), new MeshBasicMaterial({ color: 0x0b0616 }));
      const halo = new Mesh(new SphereGeometry(0.14, 16, 12), new MeshBasicMaterial({ color: 0x7c3aed, transparent: true, opacity: 0.35, depthWrite: false, blending: AdditiveBlending }));
      const label = new TextPlane(0.24, 0.14); label.mesh.position.y = 0.2; g.add(core, halo, label.mesh); g.visible = false; this.group.add(g); this.slots.push({ g, halo, label, id: -1, sign: '' });
    }
    for (let i = 0; i < NP; i++) { const m = new Mesh(new SphereGeometry(0.012, 6, 6), new MeshBasicMaterial({ color: 0xfde68a, transparent: true, depthWrite: false, blending: AdditiveBlending })); m.visible = false; this.group.add(m); this.parts.push({ m, v: new Vector3(), life: 0 }); }
    for (let i = 0; i < NB; i++) { const m = new Mesh(new CylinderGeometry(0.006, 0.006, 1, 6, 1, true), new MeshBasicMaterial({ color: 0x67e8f9, transparent: true, depthWrite: false, blending: AdditiveBlending })); m.visible = false; this.group.add(m); this.beams.push({ m, life: 0 }); }
    scene.add(this.group);
  }
  sync(enemies: Enemy[], head: Vector3, t: number) {
    for (const s of this.slots) if (s.id !== -1 && !enemies.some((e) => e.id === s.id)) { s.id = -1; s.g.visible = false; }
    for (const e of enemies) {
      let s = this.slots.find((x) => x.id === e.id);
      if (!s) { s = this.slots.find((x) => x.id === -1); if (!s) continue; s.id = e.id; s.g.visible = true; }
      if (s.sign !== e.sign) { s.sign = e.sign; s.label.set(txt(e.sign), { size: 0.1, color: COLORS.amber, weight: '900' }); }
      s.g.position.set(head.x + e.x, head.y + e.y, head.z + e.z);
      const near = Math.max(0, Math.min(1, 1 - (e.dist - 0.55) / 2.4)); s.halo.scale.setScalar(1 + near * 0.8 + Math.sin(t * 5 + e.id) * 0.08);
      (s.halo.material as MeshBasicMaterial).color.setRGB(0.49 + 0.5 * near, 0.23 * (1 - near), 0.93 - 0.7 * near); s.label.mesh.lookAt(head);
    }
  }
  fire(from: Vector3, x: number, y: number, z: number) {
    const b = this.beams.find((q) => q.life <= 0); if (!b) return; this.tmp.set(x, y, z); this.dir.subVectors(this.tmp, from); const len = this.dir.length(); if (len < 0.01) return;
    this.dir.divideScalar(len); b.m.position.copy(from).addScaledVector(this.dir, len / 2); b.m.scale.set(1, len, 1); b.m.quaternion.copy(new Quaternion().setFromUnitVectors(UP, this.dir)); b.life = 0.22; b.m.visible = true;
  }
  puff(x: number, y: number, z: number, color: string) {
    let n = 0; for (const p of this.parts) { if (n >= 10) break; if (p.life > 0) continue; n++; p.m.position.set(x, y, z); (p.m.material as MeshBasicMaterial).color.set(color); p.m.visible = true; p.life = 0.5 + Math.random() * 0.4;
      const a = Math.random() * 6.283, b = Math.acos(2 * Math.random() - 1), s = 0.4 + Math.random() * 0.6; p.v.set(Math.sin(b) * Math.cos(a) * s, Math.sin(b) * Math.sin(a) * s, Math.cos(b) * s); }
  }
  tick(dt: number) {
    for (const p of this.parts) if (p.life > 0) { p.life -= dt; p.m.position.addScaledVector(p.v, dt); (p.m.material as MeshBasicMaterial).opacity = Math.max(0, p.life / 0.9); if (p.life <= 0) p.m.visible = false; }
    for (const b of this.beams) if (b.life > 0) { b.life -= dt; (b.m.material as MeshBasicMaterial).opacity = Math.max(0, b.life / 0.22); if (b.life <= 0) b.m.visible = false; }
  }
}

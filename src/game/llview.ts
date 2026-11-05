import { Group, Mesh, MeshBasicMaterial, SphereGeometry, CylinderGeometry, RingGeometry, ShaderMaterial, Color, Vector3, Quaternion, AdditiveBlending, BackSide, DoubleSide } from '@iwsdk/core';
import { TextPlane, COLORS } from './ui';
import type { Enemy } from './lastlight';

const MAXE = 10, NP = 48, NB = 6, NR = 5, UP = new Vector3(0, 1, 0);
const txt = (s: string) => (s === 'FIST' ? 'S' : s);
const VS = 'varying vec3 vN; varying vec3 vV; uniform float uT; void main(){ vec3 p = position + normal * 0.012 * sin(uT * 6.0 + position.y * 40.0); vec4 mv = modelViewMatrix * vec4(p, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }';
const FS = 'varying vec3 vN; varying vec3 vV; uniform vec3 uRim; uniform float uNear; void main(){ float f = pow(1.0 - max(dot(normalize(vN), normalize(vV)), 0.0), 2.2); gl_FragColor = vec4(vec3(0.02, 0.0, 0.05) + uRim * f * (1.2 + uNear * 1.6), 1.0); }';
const add = (c: number, o = 1) => new MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: AdditiveBlending });
interface Slot { g: Group; body: ShaderMaterial; halo: Mesh; wisps: Mesh[]; label: TextPlane; id: number; sign: string; boss: boolean; }

/** Visuals for LAST LIGHT: shadow creatures (rim-lit, eyes, orbiting wisps), the Light core you defend, light beams, bursts, hit flash. */
export class LLView {
  group = new Group(); private slots: Slot[] = []; private parts: { m: Mesh; v: Vector3; life: number }[] = []; private beams: { m: Mesh; life: number }[] = []; private rings: { m: Mesh; life: number }[] = [];
  private tmp = new Vector3(); private dir = new Vector3(); private q = new Quaternion(); private flashV = 0; private flash: Mesh; private core = new Group(); private orb: Mesh; private coreHalo: Mesh;
  constructor(scene: any) {
    for (let i = 0; i < MAXE; i++) {
      const g = new Group(), body = new ShaderMaterial({ uniforms: { uT: { value: 0 }, uRim: { value: new Color(0x7c3aed) }, uNear: { value: 0 } }, vertexShader: VS, fragmentShader: FS });
      const halo = new Mesh(new SphereGeometry(0.11, 16, 12), add(0x7c3aed, 0.03)), wisps: Mesh[] = [];
      g.add(new Mesh(new SphereGeometry(0.09, 24, 16), body), halo);
      for (const sx of [-1, 1]) { const eye = new Mesh(new SphereGeometry(0.011, 8, 8), add(0xffffff, 1)); eye.position.set(sx * 0.032, 0.018, 0.078); g.add(eye); }
      for (let w = 0; w < 3; w++) { const m = new Mesh(new SphereGeometry(0.009, 8, 8), add(0xc4b5fd, 0.9)); wisps.push(m); g.add(m); }
      const label = new TextPlane(0.34, 0.14); label.mesh.position.y = 0.2; g.add(label.mesh); g.visible = false; this.group.add(g); this.slots.push({ g, body, halo, wisps, label, id: -1, sign: '', boss: false });
    }
    for (let i = 0; i < NP; i++) { const m = new Mesh(new SphereGeometry(0.012, 6, 6), add(0xfde68a)); m.visible = false; this.group.add(m); this.parts.push({ m, v: new Vector3(), life: 0 }); }
    for (let i = 0; i < NB; i++) { const m = new Mesh(new CylinderGeometry(0.006, 0.006, 1, 6, 1, true), add(0x67e8f9)); m.visible = false; this.group.add(m); this.beams.push({ m, life: 0 }); }
    for (let i = 0; i < NR; i++) { const m = new Mesh(new RingGeometry(0.9, 1, 40), new MeshBasicMaterial({ color: 0x67e8f9, transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide })); m.visible = false; this.group.add(m); this.rings.push({ m, life: 0 }); }
    this.flash = new Mesh(new SphereGeometry(1.2, 16, 12), new MeshBasicMaterial({ color: 0xff2244, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending, side: BackSide })); this.group.add(this.flash);
    this.orb = new Mesh(new SphereGeometry(0.028, 20, 14), add(0xfde68a, 0.95)); this.coreHalo = new Mesh(new SphereGeometry(0.06, 16, 12), add(0xf59e0b, 0.16)); this.core.add(this.orb, this.coreHalo); this.group.add(this.core);
    scene.add(this.group);
  }
  sync(enemies: Enemy[], head: Vector3, t: number) {
    for (const s of this.slots) if (s.id !== -1 && !enemies.some((e) => e.id === s.id)) { s.id = -1; s.g.visible = false; }
    for (const e of enemies) {
      let s = this.slots.find((x) => x.id === e.id);
      if (!s) { s = this.slots.find((x) => x.id === -1); if (!s) continue; s.id = e.id; s.g.visible = true; s.sign = ''; }
      const boss = !!e.word; if (s.boss !== boss) { s.boss = boss; s.g.scale.setScalar(boss ? 3.2 : 1); s.body.uniforms.uRim.value.set(boss ? 0xff5a1f : 0x7c3aed); }
      const lab = boss ? e.word!.split('').map((c, i) => (i === e.pos ? '[' + c + ']' : c)).join(' ') : txt(e.sign);
      if (s.sign !== lab) { s.sign = lab; s.label.set(lab, { size: boss ? 0.045 : 0.1, color: boss ? COLORS.red : COLORS.amber, weight: '900' }); }
      s.label.mesh.position.y = boss ? 0.14 : 0.2; s.g.position.set(head.x + e.x, head.y + e.y, head.z + e.z); s.g.lookAt(head);
      const near = Math.max(0, Math.min(1, 1 - (e.dist - 0.55) / 2.4)); s.body.uniforms.uT.value = t; s.body.uniforms.uNear.value = near; s.halo.scale.setScalar(1 + near * 0.6 + Math.sin(t * 5 + e.id) * 0.08);
      (s.halo.material as MeshBasicMaterial).color.setRGB(boss ? 1 : 0.49 + 0.5 * near, boss ? 0.35 : 0.23 * (1 - near), boss ? 0.1 : 0.93 - 0.7 * near);
      s.wisps.forEach((w, i) => { const a = t * 2 + i * 2.1; w.position.set(Math.cos(a) * 0.13, Math.sin(a * 1.3) * 0.05, Math.sin(a) * 0.13); });
    }
  }
  setLight(light: number, head: Vector3, t: number) {
    const k = Math.max(0, Math.min(1, light / 100)); this.core.position.set(head.x, head.y - 0.34, head.z - 0.6); this.flash.position.copy(head);
    const pulse = 1 + Math.sin(t * (2 + (1 - k) * 8)) * 0.1; this.orb.scale.setScalar((0.45 + k * 0.9) * pulse); this.coreHalo.scale.setScalar((0.5 + k * 1.2) * pulse);
    (this.orb.material as MeshBasicMaterial).color.setRGB(1, 0.35 + 0.5 * k, 0.15 * k);
    (this.flash.material as MeshBasicMaterial).opacity = this.flashV + (k < 0.35 ? 0.05 + 0.04 * Math.sin(t * 8) : 0);
  }
  hitFlash() { this.flashV = 0.4; }
  ring(x: number, y: number, z: number, head: Vector3, color: string) { const r = this.rings.find((q) => q.life <= 0); if (!r) return; r.m.position.set(x, y, z); r.m.lookAt(head); (r.m.material as MeshBasicMaterial).color.set(color); r.life = 0.4; r.m.visible = true; }
  fire(from: Vector3, x: number, y: number, z: number) {
    const b = this.beams.find((q) => q.life <= 0); if (!b) return; this.tmp.set(x, y, z); this.dir.subVectors(this.tmp, from); const len = this.dir.length(); if (len < 0.01) return;
    this.dir.divideScalar(len); b.m.position.copy(from).addScaledVector(this.dir, len / 2); b.m.scale.set(1, len, 1); b.m.quaternion.copy(this.q.setFromUnitVectors(UP, this.dir)); b.life = 0.22; b.m.visible = true;
  }
  puff(x: number, y: number, z: number, color: string) {
    let n = 0; for (const p of this.parts) { if (n >= 12) break; if (p.life > 0) continue; n++; p.m.position.set(x, y, z); (p.m.material as MeshBasicMaterial).color.set(color); p.m.visible = true; p.life = 0.5 + Math.random() * 0.4;
      const a = Math.random() * 6.283, b = Math.acos(2 * Math.random() - 1), s = 0.4 + Math.random() * 0.7; p.v.set(Math.sin(b) * Math.cos(a) * s, Math.sin(b) * Math.sin(a) * s, Math.cos(b) * s); }
  }
  tick(dt: number) {
    this.flashV = Math.max(0, this.flashV - dt * 0.9);
    for (const p of this.parts) if (p.life > 0) { p.life -= dt; p.m.position.addScaledVector(p.v, dt); (p.m.material as MeshBasicMaterial).opacity = Math.max(0, p.life / 0.9); if (p.life <= 0) p.m.visible = false; }
    for (const b of this.beams) if (b.life > 0) { b.life -= dt; (b.m.material as MeshBasicMaterial).opacity = Math.max(0, b.life / 0.22); if (b.life <= 0) b.m.visible = false; }
    for (const r of this.rings) if (r.life > 0) { r.life -= dt; r.m.scale.setScalar(0.05 + (1 - r.life / 0.4) * 0.55); (r.m.material as MeshBasicMaterial).opacity = Math.max(0, (r.life / 0.4) * 0.8); if (r.life <= 0) r.m.visible = false; }
  }
}

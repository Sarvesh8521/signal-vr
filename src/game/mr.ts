import { Group, Mesh, MeshBasicMaterial, RingGeometry, SphereGeometry, CylinderGeometry, Matrix4, Vector3, Quaternion, AdditiveBlending, DoubleSide } from '@iwsdk/core';

/** Opt-in mixed-reality signal node (?mr=1): look at a real wall or table, sign, and a node lands there. Uses plain WebXR hit-test. Needs a Quest to verify. */
export class MrNode {
  placed = false; private src: any = null; private asked = false; private energy = 0; private bloomT = 0; private big = 1;
  private reticle: Mesh; private node = new Group(); private orb: Mesh; private ring: Mesh; private beam: Mesh;
  private m = new Matrix4(); private p = new Vector3(); private q = new Quaternion(); private s = new Vector3(); private up = new Vector3();
  constructor(scene: any, private renderer: any) {
    const add = { transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide } as const;
    this.reticle = new Mesh(new RingGeometry(0.05, 0.065, 40).rotateX(-Math.PI / 2), new MeshBasicMaterial({ color: 0x5eead4, opacity: 0.8, ...add }));
    this.reticle.matrixAutoUpdate = false; this.reticle.visible = false; scene.add(this.reticle);
    this.orb = new Mesh(new SphereGeometry(0.035, 24, 16), new MeshBasicMaterial({ color: 0xfde68a, opacity: 0.95, ...add })); this.orb.position.y = 0.06;
    this.ring = new Mesh(new RingGeometry(0.06, 0.07, 48).rotateX(-Math.PI / 2), new MeshBasicMaterial({ color: 0x5eead4, opacity: 0.7, ...add }));
    this.beam = new Mesh(new CylinderGeometry(0.004, 0.012, 0.5, 12, 1, true), new MeshBasicMaterial({ color: 0x93c5fd, opacity: 0.35, ...add })); this.beam.position.y = 0.25;
    this.node.add(this.orb, this.ring, this.beam); this.node.visible = false; scene.add(this.node);
  }
  update(dt: number, t: number) {
    const xr = this.renderer.xr, session = xr.getSession?.();
    if (!session) { this.reticle.visible = false; return; }
    if (!this.asked) {
      this.asked = true;
      session.requestReferenceSpace('viewer').then((vs: any) => session.requestHitTestSource?.({ space: vs })).then((s: any) => { this.src = s ?? null; }).catch(() => {});
      session.addEventListener('end', () => { this.src = null; this.asked = false; });
    }
    const frame = xr.getFrame?.(), ref = xr.getReferenceSpace?.();
    if (this.src && frame && ref && !this.placed) {
      const hits = frame.getHitTestResults(this.src), pose = hits.length ? hits[0].getPose(ref) : null;
      if (pose) { this.m.fromArray(pose.transform.matrix); this.reticle.matrix.copy(this.m); this.reticle.visible = true; } else this.reticle.visible = false;
    } else if (this.placed) this.reticle.visible = false;
    this.energy = Math.max(0, this.energy - dt * 1.5); this.bloomT = Math.max(0, this.bloomT - dt * 0.5);
    if (this.placed) {
      this.orb.scale.setScalar((1 + this.energy * 0.5 + this.bloomT) * (1 + Math.sin(t * 3) * 0.06));
      this.ring.scale.setScalar(this.big * (1 + this.bloomT * 1.5) * (1 + this.energy * 0.2));
    }
  }
  hit() { if (!this.placed) this.place(); else this.energy = 1; }
  bloom() { this.bloomT = 1; }
  private place() {
    if (!this.reticle.visible) return;
    this.m.decompose(this.p, this.q, this.s); this.node.position.copy(this.p); this.node.quaternion.copy(this.q);
    const horizontal = this.up.set(0, 1, 0).applyQuaternion(this.q).y > 0.7; // table/floor: tall beam; wall: wide portal ring
    this.big = horizontal ? 1 : 2.2; this.beam.scale.y = horizontal ? 1 : 0.5; this.node.visible = true; this.placed = true; this.energy = 1.5;
  }
}

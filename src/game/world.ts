import { WebGLRenderTarget, Scene, OrthographicCamera, PlaneGeometry, Group, Mesh, BoxGeometry, SphereGeometry, CircleGeometry, ConeGeometry, CylinderGeometry, InstancedMesh, Object3D, ShaderMaterial, Color, Vector3, Points, BufferGeometry, Float32BufferAttribute, AdditiveBlending, BackSide, DoubleSide } from '@iwsdk/core';

const NOISE = 'float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); } float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y); } float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 3; i++) { s += a * n(p); p *= 2.03; a *= 0.5; } return s; }';
const U = () => ({ uT: { value: 0 }, uL: { value: 1 }, uP: { value: 0 }, uI: { value: 1 }, uR: { value: 1 }, uC: { value: new Vector3() } });

const SKY_V = 'varying vec3 vD; void main(){ vD = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; }';
const SKY_F = NOISE + ' varying vec3 vD; uniform float uT; uniform float uL; uniform float uI; void main(){ vec3 d = normalize(vD); float y = d.y;' +
  ' vec3 c = mix(vec3(0.02, 0.01, 0.05), vec3(0.07, 0.03, 0.17), smoothstep(-0.1, 0.25, y)); c = mix(c, vec3(0.01, 0.02, 0.07), smoothstep(0.25, 0.9, y));' +
  ' vec2 uv = d.xz / (abs(y) + 0.35) * 1.6 + vec2(uT * 0.01, 0.0); float neb = fbm(uv * 1.5 + fbm(uv * 2.0 + uT * 0.02));' +
  ' vec3 tint = mix(vec3(0.6, 0.1, 0.22), vec3(0.16, 0.34, 0.8), uL); c += tint * pow(neb, 2.2) * 0.6 * smoothstep(-0.05, 0.4, y);' +
  ' float au = (1.0 - smoothstep(0.0, 0.5, abs(y - 0.3 - 0.05 * sin(d.x * 6.0 + uT * 0.3)))) * fbm(vec2(d.x * 5.0 + uT * 0.05, d.z * 5.0)); c += vec3(0.1, 0.9, 0.7) * au * 0.3 * uL;' +
  ' vec3 sd = normalize(vec3(0.25, mix(-0.12, 0.22, smoothstep(0.15, 0.85, uI)), -0.94)); float sdt = max(dot(d, sd), 0.0); c += vec3(1.0, 0.55, 0.25) * pow(sdt, 260.0) * 1.6 + vec3(0.9, 0.35, 0.2) * pow(sdt, 16.0) * 0.3;' +
  ' vec2 sp = floor(d.xz / (abs(y) + 0.2) * 90.0 + d.y * 40.0); float st = step(0.9965, h(sp)) * (0.5 + 0.5 * sin(uT * 3.0 + h(sp) * 50.0)); c += vec3(0.8, 0.9, 1.0) * st * smoothstep(0.0, 0.3, y); c *= smoothstep(0.0, 0.3, uI);' +
  ' gl_FragColor = vec4(c, 1.0); }';
// The sky is expensive per pixel, so it is baked into a texture and only re-baked when the light level or intro changes.
const BAKE_V = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const BAKE_F = SKY_F.replace('varying vec3 vD;', 'varying vec2 vUv;').replace('vec3 d = normalize(vD);', 'float ph = vUv.x * 6.2831853, th = (1.0 - vUv.y) * 3.1415927; vec3 d = vec3(-cos(ph) * sin(th), cos(th), sin(ph) * sin(th));');
const DOME_V = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const DOME_F = 'uniform sampler2D tSky; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tSky, vUv).rgb, 1.0); }';
const GROUND_V = 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
const GROUND_F = NOISE + ' varying vec3 vW; uniform float uT; uniform float uL; uniform float uP; uniform float uI; uniform float uR; uniform vec3 uC; void main(){ vec2 p = vW.xz - uC.xz; float r = length(p); float a = atan(p.y, p.x);' +
  ' vec3 base = vec3(0.015, 0.012, 0.03) + vec3(0.02, 0.015, 0.05) * fbm(p * 0.35); float ring = 0.0;' +
  ' for (int i = 0; i < 4; i++) { float rr = 1.1 + float(i) * 1.15; ring += (1.0 - smoothstep(0.0, 0.035, abs(r - rr))) * smoothstep(float(i) * 0.12 + 0.15, float(i) * 0.12 + 0.3, uI) * smoothstep(float(i) - 0.5, float(i) + 0.5, 1.0 + uR * 3.0) * (0.5 + 0.5 * sin(a * (12.0 + float(i) * 6.0) + uT * (0.5 + float(i) * 0.2))); }' +
  ' float ticks = (1.0 - smoothstep(0.0, 0.02, abs(fract(a * 24.0 / 6.2831) - 0.5) - 0.46)) * step(3.2, r) * step(r, 3.5); vec3 glow = mix(vec3(0.9, 0.2, 0.2), vec3(0.25, 0.85, 1.0), uL);' +
  ' vec3 c = base + glow * (ring * 0.9 + ticks * 0.6) * (0.35 + 0.65 * uL) + vec3(1.0, 0.8, 0.4) * uP * (1.0 - smoothstep(0.0, 5.0, r)) * 0.25; vec3 V = normalize(vW - cameraPosition); vec3 R = normalize(vec3(V.x, abs(V.y), V.z)); float fr = pow(1.0 - abs(V.y), 3.0); vec3 sdr = normalize(vec3(0.25, mix(-0.12, 0.22, smoothstep(0.15, 0.85, uI)), -0.94)); float sref = pow(max(dot(R, sdr), 0.0), 30.0); vec3 tnt = mix(vec3(0.6, 0.1, 0.22), vec3(0.16, 0.34, 0.8), uL);' +
  ' c += (vec3(1.0, 0.55, 0.25) * sref * 1.2 + tnt * fbm(R.xz / (R.y + 0.3) * 1.5 + uT * 0.02) * 0.35) * fr * exp(-r * 0.04); c = mix(vec3(0.05, 0.035, 0.11), c, exp(-r * 0.06)); c *= smoothstep(0.0, 0.3, uI); gl_FragColor = vec4(c, 1.0); }';
const MONO_V = 'varying vec3 vN; varying vec3 vW; void main(){ mat4 m = modelMatrix * instanceMatrix; vec4 w = m * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(m) * normal); gl_Position = projectionMatrix * viewMatrix * w; }';
const MONO_F = 'uniform float uT; uniform float uL; uniform float uI; uniform vec3 uC; varying vec3 vN; varying vec3 vW; void main(){ vec3 v = normalize(cameraPosition - vW); float f = pow(1.0 - max(dot(normalize(vN), v), 0.0), 2.5);' +
  ' float rune = step(0.93, fract(vW.y * 0.8 + sin(vW.x * 3.0 + vW.z * 2.0) * 0.1)) * (0.4 + 0.6 * sin(uT * 1.5 + vW.y)); vec3 glow = mix(vec3(0.9, 0.2, 0.3), vec3(0.35, 0.45, 1.0), uL);' +
  ' vec3 c = vec3(0.006, 0.005, 0.014) + glow * (f * 0.45 + rune * 0.55 * uL * uI); float d = length(vW.xz - uC.xz); c = mix(vec3(0.05, 0.035, 0.11), c, exp(-d * 0.03)); c *= smoothstep(0.1, 0.4, uI); gl_FragColor = vec4(c, 1.0); }';
const EMB_V = 'attribute vec4 aS; uniform float uT; uniform vec3 uC; varying float vA; void main(){ float t = uT * aS.w + aS.x * 20.0; vec3 p = vec3(aS.x * 14.0 - 7.0, mod(aS.y * 9.0 + t * 0.35, 9.0), aS.z * 14.0 - 7.0); p.x += sin(t + aS.z * 6.0) * 0.4; p.z += cos(t * 0.8 + aS.x * 6.0) * 0.4; p += vec3(uC.x, 0.0, uC.z);' +
  ' vec4 mv = viewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = (aS.w * 3.0 + 2.0) * 5.0 / max(-mv.z, 0.5); vA = smoothstep(0.0, 1.5, p.y) * (1.0 - smoothstep(6.0, 9.0, p.y)); }';
const EMB_F = 'varying float vA; uniform float uL; uniform float uI; void main(){ float d = length(gl_PointCoord - 0.5); float a = (1.0 - smoothstep(0.0, 0.5, d)); vec3 col = mix(vec3(1.0, 0.45, 0.2), vec3(0.5, 0.85, 1.0), uL); gl_FragColor = vec4(col * a, a * vA * uI); }';
const SHAFT_V = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const SHAFT_F = 'uniform float uT; uniform float uL; uniform float uI; varying vec2 vUv; void main(){ float a = pow(vUv.y, 1.5) * 0.16 * uI * (0.6 + 0.4 * sin(uT * 0.6 + vUv.x * 18.85)); vec3 col = mix(vec3(1.0, 0.3, 0.25), vec3(0.45, 0.8, 1.0), uL); gl_FragColor = vec4(col * a, a); }';
const mat = (vs: string, fs: string, extra: object = {}) => new ShaderMaterial({ uniforms: U(), vertexShader: vs, fragmentShader: fs, ...extra });

/** The other world: a procedural nebula sky with a dying sun, a runed obsidian arena floor, ring of glowing monoliths, drifting embers and light shafts. All shaders, a handful of draw calls. */
export class Arena {
  group = new Group(); private mats: ShaderMaterial[] = []; private debris: InstancedMesh; private heavy: Object3D[] = []; private dBase: { p: Vector3; r: number; s: number }[] = []; private o = new Object3D();
  private rt: WebGLRenderTarget; private bakeScene = new Scene(); private bakeCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1); private bakeT = -9; private bL = -9; private bI = -9;
  constructor(scene: any, private renderer: any) {
    const reg = (m: ShaderMaterial) => { this.mats.push(m); return m; };
    this.rt = new WebGLRenderTarget(1024, 512); this.bakeScene.add(new Mesh(new PlaneGeometry(2, 2), reg(mat(BAKE_V, BAKE_F))));
    const sky = new Mesh(new SphereGeometry(60, 32, 20), new ShaderMaterial({ uniforms: { tSky: { value: this.rt.texture } }, vertexShader: DOME_V, fragmentShader: DOME_F, side: BackSide, depthWrite: false })); sky.renderOrder = -20; sky.frustumCulled = false; this.group.add(sky);
    const ground = new Mesh(new CircleGeometry(48, 64).rotateX(-Math.PI / 2), reg(mat(GROUND_V, GROUND_F))); ground.frustumCulled = false; this.group.add(ground);
    const N = 18, mono = new InstancedMesh(new ConeGeometry(1, 1, 4, 1), reg(mat(MONO_V, MONO_F)), N), o = new Object3D(); let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < N; i++) { const a = (i / N) * 6.2831 + rnd() * 0.3, r = 20 + rnd() * 12, hgt = 9 + rnd() * 14, w = 0.9 + rnd() * 1.4; o.position.set(Math.cos(a) * r, hgt / 2 - 0.2, Math.sin(a) * r); o.rotation.set((rnd() - 0.5) * 0.12, rnd() * 3, (rnd() - 0.5) * 0.12); o.scale.set(w, hgt, w); o.updateMatrix(); mono.setMatrixAt(i, o.matrix); }
    mono.frustumCulled = false; this.group.add(mono);
    // broken gateways (two pillars and a lintel) and floating debris: a ruined world
    const gm = reg(mat(MONO_V, MONO_F)), gates = new InstancedMesh(new BoxGeometry(1, 1, 1), gm, 18);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.2831 + 0.4, r = 15 + rnd() * 8, hh = 7 + rnd() * 3; for (let k = 0; k < 3; k++) { const side = k === 2 ? 0 : (k === 0 ? -1 : 1); o.position.set(Math.cos(a) * r - Math.sin(a) * side * 2.6, k === 2 ? hh : hh / 2, Math.sin(a) * r + Math.cos(a) * side * 2.6); o.rotation.set(0, -a + 1.5708, k === 2 ? 0 : (rnd() - 0.5) * 0.08); o.scale.set(k === 2 ? 6.4 : 0.9, k === 2 ? 0.8 : hh, 0.9); o.updateMatrix(); gates.setMatrixAt(i * 3 + k, o.matrix); } }
    gates.frustumCulled = false; this.group.add(gates);
    this.debris = new InstancedMesh(new BoxGeometry(1, 1, 1), gm, 40); for (let i = 0; i < 40; i++) { const a = rnd() * 6.2831, r = 5 + rnd() * 13; this.dBase.push({ p: new Vector3(Math.cos(a) * r, 1.5 + rnd() * 7, Math.sin(a) * r), r: rnd() * 3, s: 0.25 + rnd() * 0.7 }); }
    this.debris.frustumCulled = false; this.group.add(this.debris);
    const E = 1400, pos = new Float32Array(E * 3), aS = new Float32Array(E * 4); for (let i = 0; i < E; i++) { aS[i * 4] = rnd(); aS[i * 4 + 1] = rnd(); aS[i * 4 + 2] = rnd(); aS[i * 4 + 3] = 0.5 + rnd(); }
    const eg = new BufferGeometry(); eg.setAttribute('position', new Float32BufferAttribute(pos, 3)); eg.setAttribute('aS', new Float32BufferAttribute(aS, 4));
    const em = new Points(eg, reg(mat(EMB_V, EMB_F, { transparent: true, depthWrite: false, blending: AdditiveBlending }))); em.frustumCulled = false; this.group.add(em); this.heavy.push(em, this.debris);
    const shaftM = reg(mat(SHAFT_V, SHAFT_F, { transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide }));
    for (let i = 0; i < 3; i++) { const s = new Mesh(new CylinderGeometry(0.2, 2.4, 16, 24, 1, true), shaftM); const a = i * 2.1 + 0.6; s.position.set(Math.cos(a) * 7, 8, Math.sin(a) * 7); this.group.add(s); this.heavy.push(s); }
    scene.add(this.group);
  }
  /** Quality fallback: hides embers, light shafts and debris if the headset frame rate drops. */
  setQuality(level: number) { for (const o of this.heavy) o.visible = level < 1; }
  update(t: number, light: number, head: Vector3, pulse: number, intro = 1, restore = 1) {
    for (const m of this.mats) { const u = m.uniforms; u.uR.value = restore; u.uT.value = t; u.uL.value = Math.max(0.05, light); u.uP.value = pulse; u.uI.value = intro; u.uC.value.set(head.x, 0, head.z); }
    for (let i = 0; this.debris.visible && i < this.dBase.length; i++) { const d = this.dBase[i]; this.o.position.set(d.p.x, d.p.y + Math.sin(t * 0.5 + i) * 0.25, d.p.z); this.o.rotation.set(t * 0.1 * d.r, t * 0.07 * d.r + i, t * 0.05); this.o.scale.setScalar(d.s); this.o.updateMatrix(); this.debris.setMatrixAt(i, this.o.matrix); }
    this.debris.instanceMatrix.needsUpdate = true;
    const L = Math.max(0.05, light);
    if (t - this.bakeT > 0.15 && (Math.abs(L - this.bL) > 0.03 || Math.abs(intro - this.bI) > 0.01)) {
      const r = this.renderer, prev = r.getRenderTarget(), xr = r.xr.enabled; r.xr.enabled = false; r.setRenderTarget(this.rt); r.render(this.bakeScene, this.bakeCam); r.setRenderTarget(prev); r.xr.enabled = xr;
      this.bakeT = t; this.bL = L; this.bI = intro;
    }
  }
}

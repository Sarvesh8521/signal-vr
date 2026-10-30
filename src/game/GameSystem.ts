import { createSystem, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SphereGeometry, Points, PointsMaterial, BufferGeometry, Float32BufferAttribute, Color, Vector3, CanvasTexture, AdditiveBlending, BackSide, RingGeometry, DoubleSide } from '@iwsdk/core';
import { Game, GameEvent, ROUND_MS } from './game';
import { TestLog } from './testlog';
import { MrNode } from './mr';
import { startWebcam } from './webcam';
function glowTex(): CanvasTexture { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d')!; const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new CanvasTexture(c); }
const GLOW = glowTex();

import { makeStore } from './store';
import { HandInput } from './handInput';
import { GhostHand } from './ghost';
import { TextPlane, COLORS } from './ui';
import { Sfx } from './audio';
import { SIGNS } from '../pose/signs';
import { makeHand, SPECS } from '../pose/synthetic';

const label = (id: string | null) => (id ? SIGNS.find((s) => s.id === id)?.label ?? id : '');
const hint = (id: string | null) => (id ? SIGNS.find((s) => s.id === id)?.hint ?? '' : '');
const DEBUG = typeof location !== 'undefined' && /[?&]debug/.test(location.search);
const RECORD = typeof location !== 'undefined' && /[?&]record/.test(location.search);
const MR = typeof location !== 'undefined' && /[?&]mr/.test(location.search);
const WEBCAM = typeof location !== 'undefined' && /[?&]webcam/.test(location.search);

export class GameSystem extends createSystem({}) {
  private game!: Game; private handIn!: HandInput; private sfx = new Sfx();
  private root = new Group(); private menu = new Group(); private playG = new Group(); private result = new Group();
  private ghost = new GhostHand(); private ghostPose = '';
  private title!: TextPlane; private tag!: TextPlane; private menuInfo!: TextPlane; private btn!: TextPlane; private btnWorld = new Vector3();
  private hud!: TextPlane; private letter!: TextPlane; private hintT!: TextPlane; private banner!: TextPlane; private floatT!: TextPlane; private dbg!: TextPlane;
  private barBack!: Mesh; private barFill!: Mesh; private resT!: TextPlane; private btn2!: TextPlane; private btn2World = new Vector3();
  private parts: { m: Mesh; v: Vector3; life: number }[] = []; private pulse = 0; private floatLife = 0; private stars!: Points; private touching: Record<string, boolean> = {}; private pokeCool = 0; private keyPoke = false;
  private lastTickSec = -1;
  private tlog: TestLog | null = RECORD ? new TestLog() : null; private camOn = WEBCAM ? startWebcam((j) => { this.handIn.override = j; }).catch((e) => { console.warn('webcam mode failed', e); alert('Webcam mode could not start: ' + (e && e.message ? e.message : e)); }) : null; private domeMat!: MeshBasicMaterial; private wave!: Mesh; private waveT = 1; private restore = (() => { try { return globalThis.localStorage?.getItem('signal:seenTeach') ? 0.6 : 0.12; } catch { return 0.12; } })(); private chainT!: TextPlane; private mr: MrNode | null = null; private sky!: Points; private skyKey = ''; private trail!: Points; private trailPos!: Float32Array; private trailCol!: Float32Array; private trailHead = 0; private lastTips: Vector3[] = [];

  init(): void {
    this.game = new Game(makeStore()); this.handIn = new HandInput(this.renderer);
    const scene = this.scene; scene.background = new Color(COLORS.bg); scene.add(this.root); this.root.position.set(0, 1.3, -0.8);
    { const dg = new SphereGeometry(30, 24, 16), dc: number[] = [], dp = dg.getAttribute('position'), top = new Color(0x1b0a3a), mid = new Color(0x0a1230), bot = new Color(0x02040c), tc = new Color();
      for (let i = 0; i < dp.count; i++) { const h = dp.getY(i) / 30; (h > 0 ? tc.copy(mid).lerp(top, Math.min(1, h * 1.4)) : tc.copy(mid).lerp(bot, Math.min(1, -h * 1.4))); dc.push(tc.r, tc.g, tc.b); }
      dg.setAttribute('color', new Float32BufferAttribute(dc, 3)); this.domeMat = new MeshBasicMaterial({ vertexColors: true, side: BackSide, depthWrite: false }); const dome = new Mesh(dg, this.domeMat); dome.renderOrder = -10; scene.add(dome); }

    this.root.add(this.menu, this.playG, this.result);
    // stars
    const N = 500, pos: number[] = []; for (let i = 0; i < N; i++) { const r = 3 + Math.random() * 5, a = Math.random() * 6.283, e = (Math.random() - 0.5) * 2.4; pos.push(Math.cos(a) * r, e * 2, Math.sin(a) * r); }
    const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(pos, 3)); this.stars = new Points(g, new PointsMaterial({ color: 0x8be9fd, size: 0.09, map: GLOW, transparent: true, opacity: 0.8, depthWrite: false, blending: AdditiveBlending })); scene.add(this.stars);
    // "Your Sky": each sign owns a 3-star cluster that lights up as you master it (visible growth between sessions)
    { const n = SIGNS.length * 3, sp: number[] = [], sc: number[] = [];
      SIGNS.forEach((_, i) => { const az = (-70 + (140 * i) / (SIGNS.length - 1)) * Math.PI / 180, el = (14 + (i % 3) * 13) * Math.PI / 180;
        for (let k = 0; k < 3; k++) { const a = az + (k - 1) * 0.045, e = el + (k === 1 ? 0.05 : 0), r = 2.4; sp.push(Math.sin(a) * Math.cos(e) * r, 1.3 + Math.sin(e) * r - 0.3, -Math.cos(a) * Math.cos(e) * r); sc.push(0.18, 0.2, 0.3); } });
      const sg = new BufferGeometry(); sg.setAttribute('position', new Float32BufferAttribute(sp, 3)); sg.setAttribute('color', new Float32BufferAttribute(sc, 3));
      this.sky = new Points(sg, new PointsMaterial({ size: 0.16, map: GLOW, vertexColors: true, sizeAttenuation: true, transparent: true, depthWrite: false, blending: AdditiveBlending })); scene.add(this.sky); void n; }
    { const T = 60; this.trailPos = new Float32Array(T * 3).fill(-99); this.trailCol = new Float32Array(T * 3); const tg = new BufferGeometry(); tg.setAttribute('position', new Float32BufferAttribute(this.trailPos, 3)); tg.setAttribute('color', new Float32BufferAttribute(this.trailCol, 3));
      this.trail = new Points(tg, new PointsMaterial({ size: 0.035, map: GLOW, vertexColors: true, sizeAttenuation: true, transparent: true, depthWrite: false, blending: AdditiveBlending })); this.trail.frustumCulled = false; scene.add(this.trail); }
    if (MR) { scene.background = null; scene.children.forEach((c) => { if (c.renderOrder === -10) c.visible = false; }); this.stars.visible = false; this.mr = new MrNode(scene, this.renderer); }
    this.wave = new Mesh(new RingGeometry(0.92, 1, 72), new MeshBasicMaterial({ color: 0x5eead4, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending, side: DoubleSide })); this.wave.position.copy(this.root.position); scene.add(this.wave);

    // menu
    this.title = new TextPlane(0.7, 0.2); this.title.mesh.position.set(0, 0.2, 0); this.menu.add(this.title.mesh);
    this.tag = new TextPlane(0.8, 0.09); this.tag.mesh.position.set(0, 0.07, 0); this.menu.add(this.tag.mesh);
    this.menuInfo = new TextPlane(0.8, 0.2); this.menuInfo.mesh.position.set(0, -0.08, 0); this.menu.add(this.menuInfo.mesh);
    this.btn = new TextPlane(0.3, 0.11); this.btn.mesh.position.set(0, -0.2, 0.2); this.menu.add(this.btn.mesh);
    // play
    this.hud = new TextPlane(0.8, 0.09); this.hud.mesh.position.set(0, 0.42, 0); this.playG.add(this.hud.mesh);
    this.ghost.group.scale.setScalar(2.2); this.ghost.group.rotation.y = Math.PI; this.ghost.group.position.set(-0.26, -0.12, 0); this.playG.add(this.ghost.group);
    this.letter = new TextPlane(0.42, 0.24); this.letter.mesh.position.set(0.22, 0.12, 0); this.playG.add(this.letter.mesh);
    this.barBack = new Mesh(new PlaneGeometry(0.4, 0.025), new MeshBasicMaterial({ color: 0x1e293b })); this.barBack.position.set(0.22, -0.03, 0); this.playG.add(this.barBack);
    const fg = new PlaneGeometry(0.4, 0.025); fg.translate(0.2, 0, 0); this.barFill = new Mesh(fg, new MeshBasicMaterial({ color: 0x22d3ee })); this.barFill.position.set(0.02, -0.03, 0.001); this.playG.add(this.barFill);
    this.hintT = new TextPlane(0.5, 0.1); this.hintT.mesh.position.set(0.22, -0.11, 0); this.playG.add(this.hintT.mesh);
    this.banner = new TextPlane(0.9, 0.08); this.banner.mesh.position.set(0, -0.3, 0.05); this.playG.add(this.banner.mesh);
    this.floatT = new TextPlane(0.4, 0.08); this.floatT.mesh.position.set(0.22, 0.25, 0.02); this.playG.add(this.floatT.mesh);
    this.chainT = new TextPlane(0.5, 0.07); this.chainT.mesh.position.set(0.22, 0.31, 0.02); this.playG.add(this.chainT.mesh);
    // result
    this.resT = new TextPlane(0.8, 0.4); this.resT.mesh.position.set(0, 0.1, 0); this.result.add(this.resT.mesh);
    this.btn2 = new TextPlane(0.34, 0.11); this.btn2.mesh.position.set(0, -0.2, 0.2); this.result.add(this.btn2.mesh);
    if (DEBUG) { this.dbg = new TextPlane(0.9, 0.16); this.dbg.mesh.position.set(0, -0.42, 0.1); this.root.add(this.dbg.mesh); }
    // particles
    const pg = new SphereGeometry(0.008, 6, 5); for (let i = 0; i < 48; i++) { const m = new Mesh(pg, new MeshBasicMaterial({ color: 0xffffff, transparent: true })); m.visible = false; this.root.add(m); this.parts.push({ m, v: new Vector3(), life: 0 }); }
    // desktop/dev controls: digits = hold a synthetic sign, Space = poke button
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', (e) => { const i = '1234567890'.indexOf(e.key); if (i >= 0 && DEBUG) this.handIn.fakeSign = Object.keys(SPECS)[i]; if (e.key === ' ') this.keyPoke = true; });
      window.addEventListener('keyup', (e) => { if ('1234567890'.includes(e.key)) this.handIn.fakeSign = null; });
      (window as any).__signal = { game: this.game, input: this.handIn };
    }
    this.layout(); this.applyEvents([{ type: 'phase', phase: 'menu' }]);
  }

  private burst(color: string) {
    const c = new Color(color); let n = 0; for (const p of this.parts) { if (n >= 28) break; if (p.life > 0) continue; n++;
      p.m.position.set(0.22, 0.12, 0.02); (p.m.material as MeshBasicMaterial).color.copy(c); (p.m.material as MeshBasicMaterial).opacity = 1; p.m.visible = true; p.life = 0.8 + Math.random() * 0.4;
      const a = Math.random() * 6.283, s = 0.15 + Math.random() * 0.35; p.v.set(Math.cos(a) * s, Math.sin(a) * s + 0.1, (Math.random() - 0.5) * 0.2); }
  }
  private applyEvents(evs: GameEvent[]) {
    for (const e of evs) {
      if (e.type === 'phase') {
        this.menu.visible = e.phase === 'menu'; this.playG.visible = e.phase === 'teach' || e.phase === 'playing'; this.result.visible = e.phase === 'result';
        if (e.phase === 'playing' || e.phase === 'teach') this.sfx.start(); if (e.phase === 'result') { this.sfx.end(); if (this.game.newBest) setTimeout(() => this.sfx.best(), 700); }
      } else if (e.type === 'target') { this.setGhost(e.sign); this.ghost.setColor(0x22d3ee); }
      else if (e.type === 'success') {
        this.sfx.success(e.combo); this.mr?.hit(); this.burst(e.daily ? COLORS.amber : COLORS.green); this.pulse = 0.35; this.ghost.setColor(0x4ade80); this.waveT = 0; this.restore = this.game.phase === 'teach' && e.sign === 'ILY' ? 1 : Math.min(1, this.restore + 0.1);
        this.floatT.set(`+${e.points}${e.daily ? '  DAILY x2' : ''}${e.combo >= 3 ? `   COMBO ${e.combo}` : ''}${this.game.leveledUp === e.sign ? '   STAR LIT!' : ''}${this.game.phase === 'teach' && e.sign === 'ILY' ? '\nYOU JUST SIGNED: I LOVE YOU' : ''}`, { color: e.daily ? COLORS.amber : COLORS.green, size: 0.04 }); this.floatLife = 1;
      } else if (e.type === 'timeout') this.sfx.timeout();
      else if (e.type === 'chain') { this.sfx.best(); this.mr?.bloom(); this.burst(COLORS.amber); this.pulse = 0.6; this.floatT.set(`${e.word}!  +${e.bonus}`, { color: COLORS.amber, size: 0.05 }); this.floatLife = 1.4; }
    }
  }
  private setGhost(id: string) { if (this.ghostPose === id) return; this.ghostPose = id; this.ghost.setPose(makeHand(SPECS[id])); }
  private layout() { this.root.updateWorldMatrix(true, true); }

  update(delta: number): void {
    const now = performance.now(); const dt = Math.min(0.05, delta || 0.016);
    const frame = this.handIn.read();
    // poke detection (index fingertip near a button) + keyboard Space
    let poke: string | null = null; this.pokeCool -= dt;
    const targets: [string, Mesh, Vector3, boolean][] = [['play', this.btn.mesh, this.btnWorld, this.menu.visible || this.result.visible]];
    this.btn2.mesh.visible = this.result.visible; this.btn.mesh.visible = this.menu.visible;
    const bm = this.result.visible ? this.btn2.mesh : this.btn.mesh; bm.getWorldPosition(this.btnWorld);
    if (this.menu.visible || this.result.visible) {
      const touching = frame.tips.some((t) => t.distanceTo(this.btnWorld) < 0.055);
      if (touching && !this.touching.play && this.pokeCool <= 0) { poke = 'play'; this.pokeCool = 0.8; } this.touching.play = touching;
      if (this.keyPoke) { poke = 'play'; this.pokeCool = 0.8; }
    }
    this.keyPoke = false;
    const tgt = this.game.target, ph = this.game.phase, age = this.game.targetAge;
    const evs = this.game.update(now, { match: frame.match, poke, features: frame.features }); this.applyEvents(evs);
    this.tlog?.frame(tgt, ph, frame.features, frame.match, evs, age);
    this.render(frame, dt);
  }

  private updateTrail(frame: ReturnType<HandInput['read']>) {
    const T = 60, pa = this.trail.geometry.getAttribute('position'), ca = this.trail.geometry.getAttribute('color');
    for (let k = 0; k < frame.tips.length; k++) { const t = frame.tips[k]; if (t.x > 50) continue; const l = this.lastTips[k]; if (l && l.distanceToSquared(t) < 2.5e-5) continue; (this.lastTips[k] ||= t.clone()).copy(t); this.trailHead = (this.trailHead + 1) % T; pa.setXYZ(this.trailHead, t.x, t.y, t.z); }
    for (let i = 0; i < T; i++) { const age = (this.trailHead - i + T) % T, f = Math.pow(Math.max(0, 1 - age / 50), 1.6); ca.setXYZ(i, 0.08 * f, 0.55 * f, 0.7 * f); }
    pa.needsUpdate = true; ca.needsUpdate = true;
  }
  private render(frame: ReturnType<HandInput['read']>, dt: number) {
    this.updateTrail(frame); this.mr?.update(dt, performance.now() / 1000);
    const g = this.game; const t = performance.now() / 1000;
    this.stars.rotation.y += dt * 0.01;
    { const r = this.restore; this.domeMat.color.setScalar(0.3 + 0.7 * r); (this.stars.material as PointsMaterial).opacity = 0.25 + 0.55 * r; if (this.sky) (this.sky.material as PointsMaterial).opacity = 0.4 + 0.6 * r;
      const wm = this.wave.material as MeshBasicMaterial; if (this.waveT < 1) { this.waveT = Math.min(1, this.waveT + dt * 0.9); wm.opacity = (1 - this.waveT) * 0.6; this.wave.scale.setScalar(0.1 + this.waveT * 7); } else wm.opacity = 0; }
    { const lv = SIGNS.map((x) => g.mastery.level(x.id)); const key = lv.join(''); if (key !== this.skyKey) { this.skyKey = key; const col = this.sky.geometry.getAttribute('color'); lv.forEach((L, i) => { for (let k = 0; k < 3; k++) { const on = L > k; col.setXYZ(i * 3 + k, on ? 1 : 0.18, on ? 0.82 : 0.2, on ? 0.25 : 0.3); } }); col.needsUpdate = true; } (this.sky.material as PointsMaterial).opacity = 0.75 + Math.sin(t * 1.3) * 0.2; }
    if (this.menu.visible) {
      this.title.set('SIGNAL', { size: 0.15, color: COLORS.cyan, weight: '900' });
      this.tag.set('Learn sign language. With your hands.', { size: 0.036, color: COLORS.white, weight: '500' });
      const lines = [g.streak > 0 ? `STREAK  ${g.streak} DAY${g.streak > 1 ? 'S' : ''}` : 'START YOUR STREAK TODAY', `SIGN OF THE DAY  ${label(g.dailyId)}  (2x points)`, `YOUR SKY  ${g.mastery.stars(SIGNS.map((x) => x.id))} / ${SIGNS.length * 3} STARS`, g.best > 0 ? `BEST  ${g.best}` : 'Raise a hand and tap PLAY with your finger'];
      this.menuInfo.set(lines.join('\n'), { size: 0.03, color: COLORS.amber, lineHeight: 1.4 });
      const near = frame.tips.some((p) => p.distanceTo(this.btnWorld) < 0.12);
      this.btn.set('PLAY', { size: 0.055, bg: near ? COLORS.cyan : 'rgba(34,211,238,0.28)', border: COLORS.cyan, color: near ? '#001018' : COLORS.cyan, radius: 0.05 });
      this.btn.mesh.scale.setScalar(1 + Math.sin(t * 3) * 0.03);
    }
    if (this.playG.visible) {
      const teach = g.phase === 'teach'; const sec = Math.ceil(g.timeLeft / 1000);
      this.hud.set(teach ? `LEARN  ${g.teachIndex + 1} / 3` : `SCORE ${g.score}      TIME ${sec}      COMBO x${g.combo}`, { size: 0.04, color: !teach && sec <= 10 ? COLORS.red : COLORS.white });
      this.letter.set(label(g.target), { size: label(g.target).length > 3 ? 0.075 : 0.2, weight: '900', color: g.celebrate > 0 ? COLORS.green : COLORS.white });
      this.hintT.set(g.coach ?? (g.showHint ? hint(g.target) : 'Copy the glowing hand'), { size: 0.026, color: g.coach ? COLORS.green : g.showHint ? COLORS.amber : COLORS.dim, weight: '500' });
      this.barFill.scale.x = Math.max(0.001, g.holdProgress); (this.barFill.material as MeshBasicMaterial).color.set(g.celebrate > 0 ? 0x4ade80 : 0x22d3ee);
      this.banner.mesh.visible = g.trackingLost; this.banner.set(frame.tracked === 0 ? 'Show your hand to the headset  (timer paused)' : '', { size: 0.03, color: COLORS.red, bg: COLORS.panel });
      if (!teach && sec <= 10 && sec !== this.lastTickSec && sec > 0 && !g.trackingLost) { this.lastTickSec = sec; this.sfx.tick(); }
      this.pulse = Math.max(0, this.pulse - dt); const k = 2.2 * (1 + this.pulse * 0.7); this.ghost.group.scale.setScalar(k); this.ghost.group.position.y = -0.12 + Math.sin(t * 1.6) * 0.008; this.ghost.group.rotation.y = Math.PI + Math.sin(t * 0.8) * 0.55; this.ghost.group.rotation.x = -0.2;
      { const w = g.chain; this.chainT.set(w ? w.split('').map((c, i) => (i === g.chainPos ? '[' + c + ']' : c)).join(' ') : (this.mr && !this.mr.placed ? 'LOOK AT A WALL OR TABLE, THEN SIGN' : ''), { size: 0.045, color: COLORS.amber }); }
      this.floatLife = Math.max(0, this.floatLife - dt * 1.4); this.floatT.mesh.visible = this.floatLife > 0; this.floatT.mesh.position.y = 0.25 + (1 - this.floatLife) * 0.12; (this.floatT.mesh.material as MeshBasicMaterial).opacity = Math.min(1, this.floatLife * 1.5);
    }
    if (this.result.visible) {
      const stars = g.score > 3500 ? 3 : g.score > 2000 ? 2 : g.score > 800 ? 1 : 0;
      this.resT.set(`ROUND COMPLETE\n${g.score}\n${g.newBest ? 'NEW BEST!' : `best ${g.best}`}   ${'*'.repeat(stars)}${'-'.repeat(3 - stars)}\n${g.solved} ${g.solved === 1 ? 'sign' : 'signs'}   best combo ${g.bestCombo}   streak ${g.streak}d`, { size: 0.05, color: COLORS.white, lineHeight: 1.5 });
      const near = frame.tips.some((p) => p.distanceTo(this.btnWorld) < 0.12);
      this.btn2.set('AGAIN', { size: 0.055, bg: near ? COLORS.magenta : 'rgba(232,121,249,0.28)', border: COLORS.magenta, color: near ? '#190020' : COLORS.magenta, radius: 0.05 });
    }
    for (const p of this.parts) { if (p.life <= 0) continue; p.life -= dt; p.m.position.addScaledVector(p.v, dt); p.v.y -= dt * 0.25; (p.m.material as MeshBasicMaterial).opacity = Math.max(0, p.life); if (p.life <= 0) p.m.visible = false; }
    if (DEBUG && this.dbg) { const f = frame.features, m = frame.match; this.dbg.set(m && f ? `hands ${frame.tracked}  best ${m.sign} c=${m.confidence.toFixed(2)} m=${m.margin.toFixed(2)}\next T${f.thumb.toFixed(2)} I${f.index.toFixed(2)} M${f.middle.toFixed(2)} R${f.ring.toFixed(2)} P${f.pinky.toFixed(2)}  pinch ${f.pinch.toFixed(2)} spread ${f.spread.toFixed(0)}` : `hands ${frame.tracked}  (no hand)`, { size: 0.024, color: '#a7f3d0', bg: 'rgba(0,0,0,0.6)' }); }
  }
}

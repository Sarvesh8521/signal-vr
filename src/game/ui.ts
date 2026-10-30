import { CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, LinearFilter } from '@iwsdk/core';

export interface TextStyle { color?: string; size?: number; weight?: string; align?: CanvasTextAlign; bg?: string; border?: string; radius?: number; lineHeight?: number; }
const PX = 1400; // canvas pixels per meter

/** A plane that renders text via canvas. Redraws only when text/style changes. */
export class TextPlane {
  readonly mesh: Mesh; private cv: HTMLCanvasElement; private cx: CanvasRenderingContext2D; private tex: CanvasTexture; private lt = ''; private ls: TextStyle = {};
  constructor(readonly w: number, readonly h: number) {
    this.cv = document.createElement('canvas'); this.cv.width = Math.max(64, Math.round(w * PX)); this.cv.height = Math.max(64, Math.round(h * PX));
    this.cx = this.cv.getContext('2d')!; this.tex = new CanvasTexture(this.cv); this.tex.colorSpace = SRGBColorSpace; this.tex.minFilter = LinearFilter; this.tex.generateMipmaps = false;
    this.mesh = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: false }));
  }
  set(text: string, s: TextStyle = {}) {
    const a = this.ls; if (text === this.lt && s.color === a.color && s.size === a.size && s.weight === a.weight && s.align === a.align && s.bg === a.bg && s.border === a.border && s.radius === a.radius && s.lineHeight === a.lineHeight) return;
    this.lt = text; this.ls = { ...s };
    const { cx, cv } = this; cx.clearRect(0, 0, cv.width, cv.height);
    if (s.bg) { const r = (s.radius ?? 0.02) * PX; cx.fillStyle = s.bg; cx.beginPath(); cx.roundRect(2, 2, cv.width - 4, cv.height - 4, r); cx.fill(); if (s.border) { cx.strokeStyle = s.border; cx.lineWidth = 6; cx.stroke(); } }
    const size = (s.size ?? 0.04) * PX; cx.font = `${s.weight ?? '700'} ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    cx.fillStyle = s.color ?? '#fff'; cx.textBaseline = 'middle'; cx.textAlign = s.align ?? 'center';
    const lines = text.split('\n'); const lh = size * (s.lineHeight ?? 1.2); const x = cx.textAlign === 'left' ? 0.03 * PX : cx.textAlign === 'right' ? cv.width - 0.03 * PX : cv.width / 2;
    lines.forEach((ln, i) => cx.fillText(ln, x, cv.height / 2 + (i - (lines.length - 1) / 2) * lh));
    this.tex.needsUpdate = true;
  }
}
export const COLORS = { bg: 0x070b1a, cyan: '#22d3ee', magenta: '#e879f9', amber: '#fbbf24', green: '#4ade80', red: '#f87171', dim: '#94a3b8', white: '#f8fafc', panel: 'rgba(15,23,42,0.82)' };

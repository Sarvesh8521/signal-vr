// src/pose/types.ts
var FINGERS = ["index", "middle", "ring", "pinky"];

// src/pose/features.ts
var d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
var sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
var clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
function chain(j, name) {
  const base = name === "thumb" ? ["thumb-metacarpal", "thumb-phalanx-proximal", "thumb-phalanx-distal", "thumb-tip"] : [`${name}-finger-phalanx-proximal`, `${name}-finger-phalanx-intermediate`, `${name}-finger-phalanx-distal`, `${name}-finger-tip`];
  return base.map((k) => j[k]);
}
function extension(pts) {
  let path = 0;
  for (let i = 1; i < pts.length; i++) path += d(pts[i - 1], pts[i]);
  const r = d(pts[0], pts[pts.length - 1]) / (path || 1e-6);
  return clamp((r - 0.5) / (0.95 - 0.5));
}
function hasHand(j) {
  return !!j && !!j["wrist"] && !!j["index-finger-tip"] && !!j["thumb-tip"] && !!j["pinky-finger-tip"];
}
function computeFeatures(j) {
  const palm = d(j["wrist"], j["middle-finger-phalanx-proximal"]) || 1e-6;
  const abd = d(j["thumb-tip"], j["index-finger-metacarpal"] ?? j["index-finger-phalanx-proximal"]) / palm;
  const f = { thumb: clamp((abd - 0.45) / (1.15 - 0.45)) };
  for (const n of FINGERS) f[n] = extension(chain(j, n));
  f.pinch = d(j["thumb-tip"], j["index-finger-tip"]) / palm;
  const a = sub(j["index-finger-tip"], j["index-finger-phalanx-proximal"]);
  const b = sub(j["middle-finger-tip"], j["middle-finger-phalanx-proximal"]);
  const cos = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (Math.hypot(...a) * Math.hypot(...b) || 1e-6);
  f.spread = Math.acos(clamp(cos, -1, 1)) * 180 / Math.PI;
  return f;
}

// src/pose/signs.ts
var UP = [1, 0.3];
var DOWN = [0, 0.3];
var LOOSE = [0.2, 0.4];
var SIGNS = [
  { id: "B", label: "B", hint: "Flat hand, fingers together and straight up, thumb across the palm", t: { thumb: [0.4, 0.3], index: UP, middle: UP, ring: UP, pinky: UP, spread: [7, 10] } },
  { id: "L", label: "L", hint: "Thumb and index straight (an L), other three fingers curled", t: { thumb: [0.87, 0.2], index: UP, middle: DOWN, ring: DOWN, pinky: DOWN } },
  { id: "Y", label: "Y", hint: "Thumb and pinky out, other three curled", t: { thumb: [0.9, 0.12], index: DOWN, middle: DOWN, ring: LOOSE, pinky: UP, pinch: [0.85, 0.25] } },
  { id: "I", label: "I", hint: "Only the pinky up, thumb tucked", t: { thumb: [0.5, 0.15], index: DOWN, middle: DOWN, ring: LOOSE, pinky: UP, pinch: [0.45, 0.2] } },
  { id: "V", label: "V", hint: "Index and middle up and spread apart, others curled", t: { index: UP, middle: UP, ring: LOOSE, pinky: [0.4, 0.3], spread: [24, 10] } },
  { id: "W", label: "W", hint: "Index, middle, ring up and spread; pinky held by the thumb", t: { index: UP, middle: UP, ring: UP, pinky: [0.5, 0.3], thumb: [0.43, 0.3], spread: [13, 6] } },
  { id: "O", label: "O", hint: "All fingertips touch the thumb in a circle", t: { thumb: [0.74, 0.2], index: [0.52, 0.25], middle: [0.63, 0.25], ring: [0.71, 0.2], pinky: [0.76, 0.15], pinch: [0.27, 0.15] } },
  { id: "F", label: "F", hint: "Thumb and index pinched, other three fingers straight up", t: { pinch: [0.25, 0.15], middle: [1, 0.15], ring: [1, 0.15], pinky: [1, 0.15] } },
  { id: "ILY", label: "I love you", hint: "Thumb, index and pinky out; middle and ring curled", t: { thumb: [0.88, 0.2], index: UP, middle: DOWN, ring: LOOSE, pinky: UP } },
  { id: "FIST", label: "S (fist)", hint: "Close all four fingers into a fist", t: { index: DOWN, middle: DOWN, ring: DOWN, pinky: DOWN, pinch: [0.57, 0.25] } }
];
function scoreSign(def, f) {
  let sum = 0, n = 0, min = 1;
  for (const [k, [mu, sigma]] of Object.entries(def.t)) {
    const z = (f[k] - mu) / sigma;
    const g = Math.exp(-0.5 * z * z);
    sum += g;
    n++;
    if (g < min) min = g;
  }
  return n ? 0.5 * (sum / n) + 0.5 * min : 0;
}
function recognize(f, set = SIGNS) {
  const scores = set.map((s) => ({ s: s.id, v: scoreSign(s, f) })).sort((a, b) => b.v - a.v);
  return { sign: scores[0].s, confidence: scores[0].v, margin: scores[0].v - (scores[1]?.v ?? 0) };
}

// src/pose/stabilizer.ts
var DEFAULT_STAB = { minConf: 0.55, minMargin: 0.08, holdMs: 400, lossGraceMs: 250 };
var Stabilizer = class {
  constructor(o = DEFAULT_STAB) {
    this.o = o;
    this.cur = null;
    this.since = 0;
    this.lastSeen = 0;
  }
  update(m, nowMs) {
    if (!m) {
      if (nowMs - this.lastSeen > this.o.lossGraceMs) {
        this.cur = null;
      }
      return { lost: true, candidate: this.cur, progress: 0, confirmed: null };
    }
    this.lastSeen = nowMs;
    const ok = m.confidence >= this.o.minConf && m.margin >= this.o.minMargin;
    if (!ok) {
      this.cur = null;
      return { lost: false, candidate: null, progress: 0, confirmed: null };
    }
    if (m.sign !== this.cur) {
      this.cur = m.sign;
      this.since = nowMs;
    }
    const progress = Math.min(1, (nowMs - this.since) / this.o.holdMs);
    return { lost: false, candidate: this.cur, progress, confirmed: progress >= 1 ? this.cur : null };
  }
  reset() {
    this.cur = null;
  }
};

// src/game/coach.ts
var FNAME = { index: "index", middle: "middle", ring: "ring", pinky: "pinky" };
function coachHint(def, f, threshold = 1.4) {
  let worstK = null, worst = 0, dev = 0;
  for (const [k, [mu, sigma]] of Object.entries(def.t)) {
    const z = (f[k] - mu) / sigma;
    if (Math.abs(z) > Math.abs(worst) && Math.abs(z) > threshold) {
      worst = z;
      worstK = k;
      dev = z;
    }
  }
  if (!worstK) return null;
  if (worstK === "thumb") return dev > 0 ? "Tuck your thumb in" : "Stretch your thumb out";
  if (worstK === "pinch") return dev > 0 ? "Bring thumb and index fingertips together" : "Open thumb and index apart";
  if (worstK === "spread") return dev > 0 ? "Bring index and middle fingers together" : "Spread index and middle fingers apart";
  return dev > 0 ? `Curl your ${FNAME[worstK]} finger` : `Straighten your ${FNAME[worstK]} finger`;
}
export {
  SIGNS,
  Stabilizer,
  coachHint,
  computeFeatures,
  hasHand,
  recognize,
  scoreSign
};

import type { Joints } from '../pose/types';

const CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const NAMES = ['wrist', 'thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip',
  ...['index', 'middle', 'ring', 'pinky'].flatMap((f) => [`${f}-finger-phalanx-proximal`, `${f}-finger-phalanx-intermediate`, `${f}-finger-phalanx-distal`, `${f}-finger-tip`])];

/** Desktop "no headset" mode (?webcam=1): feeds real webcam hand landmarks into the game through the same recognizer. Not Quest tracking. */
export async function startWebcam(onHand: (j: Joints | null) => void): Promise<void> {
  const mp: any = await import(/* @vite-ignore */ `${CDN}/+esm`);
  const fs = await mp.FilesetResolver.forVisionTasks(`${CDN}/wasm`);
  const make = (delegate: string) => mp.HandLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task', delegate }, runningMode: 'VIDEO', numHands: 1 });
  let hl: any; try { hl = await make('GPU'); } catch { hl = await make('CPU'); }
  const v = document.createElement('video'); v.playsInline = true; v.muted = true;
  v.style.cssText = 'position:fixed;right:8px;bottom:8px;width:200px;border-radius:10px;transform:scaleX(-1);opacity:.85;z-index:99998;border:1px solid #22d3ee';
  v.srcObject = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } }); document.body.appendChild(v); await v.play();
  let last = -1;
  const loop = () => {
    if (v.currentTime !== last) {
      last = v.currentTime; const w = hl.detectForVideo(v, performance.now()).worldLandmarks?.[0];
      if (!w) onHand(null);
      else {
        const j: Joints = {}; NAMES.forEach((n, i) => { j[n] = [w[i].x, w[i].y, w[i].z]; });
        for (const f of ['index', 'middle', 'ring', 'pinky']) { const a = j['wrist'], b = j[`${f}-finger-phalanx-proximal`]; j[`${f}-finger-metacarpal`] = [a[0] + (b[0] - a[0]) * 0.35, a[1] + (b[1] - a[1]) * 0.35, a[2] + (b[2] - a[2]) * 0.35]; }
        onHand(j);
      }
    }
    requestAnimationFrame(loop);
  };
  loop();
}

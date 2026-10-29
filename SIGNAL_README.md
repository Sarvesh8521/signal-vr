# SIGNAL — dev notes
Run: `npm install && npm run dev` (opens the IWER emulator window).
Tests: `npx vitest run` (pose engine + game loop, synthetic data only).

Desktop/emulator debug controls (no headset needed):
- Hold keys 1-9, 0 = inject a synthetic hand: B L Y I V W O F ILY FIST
- Space = "poke" the PLAY / AGAIN button
- Add `?debug=1` to the URL = live overlay (best match, confidence, per-finger extension) — testers screenshot this.

Status: logic tested; 3D layout/visuals NOT yet verified in a browser. Real-hand accuracy NOT yet verified.

## v0.3 additions
- Webcam validator: run `npm run dev`, open `/webcam/index.html`. Real hands, MediaPipe tracker -> checks our sign rules. Copy results to Claude.
- "Your Sky": each sign owns 3 stars that light as you master it (persists between sessions).
- Smart coach: after ~2.5s of struggling it names the exact correction ("Curl your pinky finger").
- Adaptive practice: weak/missed signs come up more often.
- First five minutes: teaches B, then L, then "I love you" (payoff).
- Rebuild the webcam bundle after editing src/pose: `npx esbuild src/pose/index.ts --bundle --format=esm --outfile=public/webcam/pose.js`

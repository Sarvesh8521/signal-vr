# SIGNAL: LAST LIGHT

**Your hands are the only light.** A seated, controller-free survival game for Meta Quest where American Sign Language fingerspelling is your weapon. Built for the Meta VR Start Developer Competition 2026 (Gaming, New Experience).

**Play:** https://signal-vr.vercel.app (Quest Browser, tap Enter XR, use bare hands)

## The game
Shadows drift toward you out of the dark. Each carries a glowing letter and the teacher hand shows the handshape. Hold the sign for a moment and a beam of light burns the shadow. Use both hands: each hand casts its own sign.

| Sign | Ability |
|---|---|
| B | Raises a barrier that blocks the next hit |
| W | Slows every shadow for a few seconds |
| L | Chains: also burns the next L |
| V | Pierces the next shadow |
| O | Restores light |
| ILY | Heals a little |
| S (fist) | Shockwave that burns shadows close to you |
| Y, I, F | Plain kills |

Waves speed up every 15 seconds and unlock letters as you go. On waves 4, 8... a boss arrives that only dies when you spell its word (BOWL, BOIL, OILY, BLOW). Your first run is a short tutorial (B, L, Y, one shadow at a time, no damage). Mastery of each sign is saved, brightens your world, and makes weak signs appear more often.

Seated and hands-only. **Relaxed Mode** (menu) slows shadows and halves damage. The game pauses while your hands are not tracked.

## Scope
A curated fingerspelling game with 10 handshapes: B, L, Y, I, V, W, O, F, "I love you" and S. It is not a full sign language course: ASL also uses movement, facial expression and its own grammar.

## Modes
- `?classic=1`: the original 60-second round version with daily signs.
- `?webcam=1`: play with a webcam hand on desktop Chrome (not Quest tracking). Shown automatically as a card on devices without WebXR.
- `?mr=1`: experimental mixed reality. Shadows spawn at room scale and nodes planted on real surfaces link into a constellation. Needs a Quest 3; not yet verified on hardware.
- `?record=1`: local tester log with Copy and Download buttons (nothing is sent anywhere): per-sign casts with the exact hand's features, kills, hits, tracking loss and frame timing.
- `?debug=1`: number keys inject synthetic hands (desktop testing only).

## How it works
Quest hand joints become seven features (thumb, four finger extensions, pinch, index-middle spread), matched against sign templates; a stabilizer needs confidence, a runner-up margin and a 400 ms hold. Templates were calibrated on webcam recordings and two Quest 3 sessions (56 accepted signs); the Quest poses are kept as regression tests (`test/quest.test.ts`). This is evidence from a small number of sessions, not a generalization claim, and Quest frame rate has not been independently benchmarked.

- `src/pose`: features, sign templates, stabilizer
- `src/game/lastlight.ts`: pure game engine (tested without rendering)
- `src/game/llview.ts`, `world.ts`: shadow creatures and the procedural arena (the sky is baked to a texture; heavy effects hide if frame rate drops)
- `src/game/handInput.ts`, `webcam.ts`, `mr.ts`, `testlog.ts`

## Develop
Node 22+. `npm install`, `npm run dev` (IWSDK emulator) or `npm run dev:runtime`, `npm run typecheck`, `npm test`, `npm run build`. CI runs typecheck, tests and build on every push.

Built with the Immersive Web SDK, Three.js, TypeScript and Vite. MediaPipe is loaded only in the desktop webcam mode. All audio is generated in code; all art is procedural.

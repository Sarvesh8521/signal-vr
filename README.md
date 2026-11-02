# SIGNAL: your hands are the only language the world understands

A seated, controller-free ASL fingerspelling game for Meta Quest, built for the Meta VR Start Developer Competition 2026 (Gaming, New Experience).

**Play:** https://signal-vr.vercel.app (open in the Quest Browser, tap Enter XR, use bare hands)

## How to play
Copy the glowing teacher hand. Hold each sign for about a second and the world brightens. Rounds are 60 seconds. Short words (BOWL, BOIL, OILY, BLOW, VOW, LOW) appear as Signal Chains for bonus points. Your Sky records the letters you master.

## Scope
SIGNAL is a curated fingerspelling game with 10 handshapes: B, L, Y, I, V, W, O, F, "I love you" and the fist. It is not a full sign language course. ASL also uses movement, facial expression and its own grammar.

## No headset?
- `?webcam=1` plays the game with your webcam hand (desktop Chrome). This is for trying the game, not Quest tracking.
- `?mr=1` is an experimental mixed-reality mode: look at a wall or table and sign to place a signal node.
- `?record=1` shows Copy/Download buttons for a local tester log. Nothing is sent anywhere.

## How it works
Quest hand joints are reduced to finger-curl, thumb, pinch and spread measurements, matched against sign templates with a stability hold. Templates were calibrated with webcam recordings and two Quest 3 sessions (56 signs accepted). Frame-rate numbers are reported in the tester log.

## Build
Node 22+, then `npm install`, `npm run dev:runtime`, `npm test`, `npm run build`. Built with the Immersive Web SDK, Three.js, TypeScript and Vite. MediaPipe is loaded only in the desktop webcam mode. All audio is generated in code.

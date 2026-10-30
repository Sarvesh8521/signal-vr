import { World, SessionMode } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { GameSystem } from './game/GameSystem.js';

const MR = /[?&]mr/.test(location.search);
const options: any = MR ? { ...(projectOptions as any), xr: { ...(projectOptions as any).xr, sessionMode: SessionMode.ImmersiveAR, features: { ...(projectOptions as any).xr?.features, hitTest: true } } } : projectOptions;
World.create(document.getElementById('scene-container') as HTMLDivElement, options).then((world) => {
  world.registerSystem(GameSystem);
});

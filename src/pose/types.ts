export type V3 = [number, number, number];
export type Joints = Record<string, V3>;
export const FINGERS = ['index', 'middle', 'ring', 'pinky'] as const;

export interface Features {
  thumb: number; index: number; middle: number; ring: number; pinky: number; // 0 curled .. 1 straight
  pinch: number;   // thumb-tip to index-tip distance / palm size
  spread: number;  // angle index vs middle (deg)
}
export interface Match { sign: string; confidence: number; margin: number; }

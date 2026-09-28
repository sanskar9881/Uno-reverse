import { randomIndex } from '../random';

export const BOTTLE_MIN_PLAYERS = 2;
export const BOTTLE_MAX_PLAYERS = 12;

export type BottleSpinLength = 'short' | 'normal' | 'long';

export const BOTTLE_SPIN_DURATION_MS: [number, number] = [3000, 6000];

/** The angle (degrees, clockwise from 12 o'clock) at which player `index` of `count` sits. */
export function playerAngle(index: number, count: number): number {
  return (360 / count) * index;
}

/**
 * Picks who the bottle lands on: uniformly among all players, excluding the spinner
 * unless `canLandOnSelf` is set.
 */
export function pickTarget(playerCount: number, spinnerIndex: number, canLandOnSelf: boolean): number {
  if (canLandOnSelf || playerCount === 1) return randomIndex(playerCount);
  const others = playerCount - 1;
  const pick = randomIndex(others);
  return pick < spinnerIndex ? pick : pick + 1;
}

/** The rotation (degrees, can exceed 360, includes `fullSpins` extra turns) that points the bottle at `targetIndex`. */
export function rotationToTarget(targetIndex: number, playerCount: number, fullSpins: number): number {
  const angle = playerAngle(targetIndex, playerCount);
  return fullSpins * 360 + angle;
}

/** Inverse of rotationToTarget: which player does this final rotation point at? */
export function landingIndex(rotation: number, playerCount: number): number {
  const w = 360 / playerCount;
  const local = (((rotation % 360) + 360) % 360) / w;
  return Math.round(local) % playerCount;
}

export function randomBottleSpinDuration(): number {
  const [min, max] = BOTTLE_SPIN_DURATION_MS;
  return min + Math.random() * (max - min);
}

/** A realistic deceleration with a slight wobble as it settles. */
export function easeOutWobble(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  const base = 1 - Math.pow(1 - clamped, 3);
  const wobble = clamped > 0.85 ? Math.sin((clamped - 0.85) * 40) * (1 - clamped) * 0.4 : 0;
  return base + wobble * 0.02;
}

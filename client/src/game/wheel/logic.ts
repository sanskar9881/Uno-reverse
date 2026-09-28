export const WHEEL_MIN_NAMES = 2;
export const WHEEL_MAX_NAMES = 100;
export const WHEEL_SHARE_MAX_BYTES = 2000;

import { randomIndex } from '../random';

export type SpinLength = 'short' | 'normal' | 'long';

/** [min, max] spin duration in ms for each length option. */
export const SPIN_DURATION_MS: Record<SpinLength, [number, number]> = {
  short: [3000, 4200],
  normal: [4000, 7000],
  long: [7000, 10000],
};

export { randomIndex };

export function pickWinner(count: number): number {
  return randomIndex(count);
}

/**
 * The angle (degrees, measured clockwise from the pointer at 12 o'clock) that segment
 * `index` of `segments` occupies, in the wheel's own unrotated frame.
 */
export function segmentAngle(segments: number): number {
  return 360 / segments;
}

/**
 * The total clockwise rotation to apply to the wheel so that, once it stops, the
 * pointer (fixed at the top) lands on `index`, at a random spot inside the segment
 * (never exactly the center or edge) after `fullSpins` extra full turns.
 */
export function targetRotation(index: number, segments: number, fullSpins: number, spotInSegment = Math.random() * 0.7 + 0.15): number {
  const w = segmentAngle(segments);
  const targetLocalAngle = (index + spotInSegment) * w;
  const base = ((360 - (targetLocalAngle % 360)) % 360 + 360) % 360;
  return fullSpins * 360 + base;
}

/** Inverse of targetRotation: which segment index does this final rotation land the pointer on? */
export function landingIndex(rotation: number, segments: number): number {
  const w = segmentAngle(segments);
  const localAngle = (((-rotation) % 360) + 360) % 360;
  const index = Math.floor(localAngle / w);
  return Math.min(segments - 1, Math.max(0, index));
}

export interface WheelShare {
  title: string;
  names: string[];
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(value.length + ((4 - (value.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Encodes a wheel as base64url JSON for the URL hash. Returns null if it wouldn't fit. */
export function encodeWheelShare(wheel: WheelShare): string | null {
  const json = JSON.stringify(wheel);
  const bytes = new TextEncoder().encode(json);
  if (bytes.byteLength > WHEEL_SHARE_MAX_BYTES) return null;
  return toBase64Url(bytes);
}

export function decodeWheelShare(value: string): WheelShare | null {
  try {
    const bytes = fromBase64Url(value);
    const json = new TextDecoder().decode(bytes);
    const parsed: unknown = JSON.parse(json);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as WheelShare).title !== 'string' ||
      !Array.isArray((parsed as WheelShare).names) ||
      !(parsed as WheelShare).names.every((n) => typeof n === 'string')
    ) {
      return null;
    }
    return parsed as WheelShare;
  } catch {
    return null;
  }
}

export function randomSpinDuration(length: SpinLength): number {
  const [min, max] = SPIN_DURATION_MS[length];
  return min + Math.random() * (max - min);
}

/** A realistic deceleration curve: fast start, long gentle settle. */
export function easeOutDecel(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - clamped, 3.4);
}

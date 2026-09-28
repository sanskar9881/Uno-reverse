import { randomBytes, timingSafeEqual } from 'node:crypto';

/** Public player id (safe to broadcast). */
export const newPlayerId = (): string => randomBytes(8).toString('hex');

/** Secret reconnect token (only ever sent to its owner). */
export const newToken = (): string => randomBytes(24).toString('hex');

/** Constant-time string comparison for secrets. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

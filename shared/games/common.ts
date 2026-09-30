import type { CouplesLevel } from '../types';

/** Shared by every "comfort level" game (Couples, Intimacy Night). */
export const COMFORT_LEVELS: readonly CouplesLevel[] = ['sweet', 'flirty', 'spicy'];
export const COMFORT_LEVEL_RANK: Record<CouplesLevel, number> = { sweet: 0, flirty: 1, spicy: 2 };

/** The lower of two chosen levels, so a session never plays above what either partner picked. */
export function lowerLevel(a: CouplesLevel, b: CouplesLevel): CouplesLevel {
  return COMFORT_LEVEL_RANK[a] <= COMFORT_LEVEL_RANK[b] ? a : b;
}

/** A card phrased "...for N seconds/minutes" gets an on-screen countdown for that long. */
export function timerSecondsFor(text: string): number | null {
  const seconds = text.match(/for (\d+) seconds?/i);
  if (seconds) return Number(seconds[1]);
  const minutes = text.match(/for a?n? ?(\d+)[- ]minute/i);
  if (minutes) return Number(minutes[1]) * 60;
  return null;
}

export interface PoolEntry {
  text: string;
  /** A data URL, for a card imported from Our Deck with a photo attached. */
  photo?: string | null;
}

/** Draws one entry from `pool`, never repeating (by text) until every entry has been seen, then reshuffles. */
export function drawFromPool<T extends PoolEntry>(
  pool: readonly T[],
  usedTexts: readonly string[],
  randomIndex: (n: number) => number,
): { entry: T; used: string[] } {
  let remaining = pool.filter((p) => !usedTexts.includes(p.text));
  let base = usedTexts;
  if (remaining.length === 0) {
    base = [];
    remaining = [...pool];
  }
  const entry = remaining[randomIndex(remaining.length)];
  return { entry, used: [...base, entry.text] };
}

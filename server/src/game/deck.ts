import { randomBytes, randomInt } from 'node:crypto';
import { CARD_COLORS, type Card, type CardValue } from '@shared';

/** Returns an integer in [0, maxExclusive). Injectable so tests can be deterministic. */
export type Rng = (maxExclusive: number) => number;

export const secureRng: Rng = (maxExclusive) => randomInt(maxExclusive);

const PER_COLOR_TWICE: CardValue[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2'];

/**
 * The classic 108-card deck, or the modern 112-card deck (adds one Wild Shuffle Hands
 * and three Wild Customizable cards) when `modern` is set. Fresh random card ids
 * (unguessable, change every round).
 */
export function createDeck(options: { modern?: boolean } = {}): Card[] {
  const used = new Set<string>();
  const newId = (): string => {
    let id: string;
    do id = randomBytes(5).toString('hex');
    while (used.has(id));
    used.add(id);
    return id;
  };

  const cards: Card[] = [];
  for (const color of CARD_COLORS) {
    cards.push({ id: newId(), color, value: '0' });
    for (const value of PER_COLOR_TWICE) {
      cards.push({ id: newId(), color, value });
      cards.push({ id: newId(), color, value });
    }
  }
  for (let i = 0; i < 4; i++) {
    cards.push({ id: newId(), color: 'wild', value: 'wild' });
    cards.push({ id: newId(), color: 'wild', value: 'wild4' });
  }
  if (options.modern) {
    cards.push({ id: newId(), color: 'wild', value: 'wildShuffle' });
    for (let i = 0; i < 3; i++) cards.push({ id: newId(), color: 'wild', value: 'wildCustom' });
  }
  return cards;
}

/** In-place Fisher–Yates shuffle. */
export function shuffle<T>(items: T[], rng: Rng = secureRng): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = rng(i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

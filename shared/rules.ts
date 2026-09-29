import { NUMBER_VALUES, type Card, type CardColor } from './types';

export const isWild = (card: Card): boolean => card.color === 'wild';

export const isNumberCard = (card: Card): boolean =>
  (NUMBER_VALUES as readonly string[]).includes(card.value);

/** Basic match: same color as the active color, same symbol as the top card, or any wild. */
export function matchesTop(card: Card, top: Card, currentColor: CardColor): boolean {
  if (card.color === 'wild') return true;
  if (card.color === currentColor) return true;
  return top.color !== 'wild' && card.value === top.value;
}

/**
 * Full legality check. A Wild +4 may always be played, like any wild card: official
 * rules make it a matter of honesty rather than server enforcement. Whether it was
 * *legal* to play (no card of the active color in hand) only matters if it's
 * challenged — see `wild4PlayWasLegal`.
 */
export function canPlayCard(card: Card, top: Card, currentColor: CardColor, _hand: readonly Card[]): boolean {
  return matchesTop(card, top, currentColor);
}

/** The condition a Wild +4 challenge checks: did the player hold a card of the color that was active? */
export function wild4PlayWasLegal(playedCardId: string, colorBeforePlay: CardColor, hand: readonly Card[]): boolean {
  return !hand.some((c) => c.id !== playedCardId && c.color === colorBeforePlay);
}

/** Jump-in (house rule): an exact match for color and value, played out of turn. Wilds never jump in. */
export function canJumpIn(card: Card, top: Card, currentColor: CardColor): boolean {
  if (card.color === 'wild') return false;
  return card.color === currentColor && card.value === top.value;
}

export function playableCardIds(
  hand: readonly Card[],
  top: Card,
  currentColor: CardColor,
  drawnCardId: string | null,
): Set<string> {
  const ids = new Set<string>();
  for (const card of hand) {
    if (drawnCardId && card.id !== drawnCardId) continue;
    if (canPlayCard(card, top, currentColor, hand)) ids.add(card.id);
  }
  return ids;
}

/** Official scoring: numbers at face value, action cards 20, wilds 50, modern-deck wilds 40. */
export function cardPoints(card: Card): number {
  if (card.value === 'wildShuffle' || card.value === 'wildCustom') return 40;
  if (card.color === 'wild') return 50;
  if (isNumberCard(card)) return Number(card.value);
  return 20;
}

export const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

const VALUE_LABELS: Record<string, string> = {
  skip: 'Skip',
  reverse: 'Reverse',
  draw2: '+2',
  wild: 'Wild',
  wild4: 'Wild +4',
  wildShuffle: 'Shuffle Hands',
  wildCustom: 'Wild Custom',
};

export function describeCard(card: Card): string {
  const label = VALUE_LABELS[card.value] ?? card.value;
  return card.color === 'wild' ? label : `${capitalize(card.color)} ${label}`;
}

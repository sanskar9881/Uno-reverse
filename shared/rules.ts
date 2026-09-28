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
 * Full legality check. Wild +4 follows the official rule: it may only be played
 * when you hold no other card of the active color (the server enforces this,
 * so no challenge mechanic is needed).
 */
export function canPlayCard(card: Card, top: Card, currentColor: CardColor, hand: readonly Card[]): boolean {
  if (!matchesTop(card, top, currentColor)) return false;
  if (card.value === 'wild4') return !hand.some((c) => c.id !== card.id && c.color === currentColor);
  return true;
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

/** Official scoring: numbers at face value, action cards 20, wilds 50. */
export function cardPoints(card: Card): number {
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
};

export function describeCard(card: Card): string {
  const label = VALUE_LABELS[card.value] ?? card.value;
  return card.color === 'wild' ? label : `${capitalize(card.color)} ${label}`;
}

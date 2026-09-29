import type { Card, CardColor, CardValue } from '@shared';

const COLORS: Record<string, CardColor> = { r: 'red', y: 'yellow', g: 'green', b: 'blue' };
const VALUES: Record<string, CardValue> = { S: 'skip', R: 'reverse', D: 'draw2' };

let counter = 0;

/**
 * Short card notation for tests:
 *   r5 = red 5, gS = green skip, bR = blue reverse, yD = yellow draw two, W = wild, W4 = wild draw four
 */
export function card(code: string): Card {
  counter += 1;
  const id = `t${counter}`;
  if (code === 'W') return { id, color: 'wild', value: 'wild' };
  if (code === 'W4') return { id, color: 'wild', value: 'wild4' };
  if (code === 'WS') return { id, color: 'wild', value: 'wildShuffle' };
  if (code === 'WC') return { id, color: 'wild', value: 'wildCustom' };
  const color = COLORS[code[0]];
  const raw = code.slice(1);
  const value = VALUES[raw] ?? (raw as CardValue);
  if (!color || !value) throw new Error(`Bad card code ${code}`);
  return { id, color, value };
}

export const cards = (codes: string): Card[] => codes.split(/\s+/).filter(Boolean).map(card);

/**
 * Builds a deck in the engine's pop order: hands are dealt round-robin
 * (player 0 first), then the start card is flipped, then `draws` come off
 * the top in order, followed by `filler`.
 */
export function riggedDeck(hands: Card[][], start: Card, draws: Card[] = [], filler: Card[] = []): Card[] {
  for (const hand of hands) if (hand.length !== 7) throw new Error('Every rigged hand needs exactly 7 cards');
  const popOrder: Card[] = [];
  for (let i = 0; i < 7; i++) for (const hand of hands) popOrder.push(hand[i]);
  popOrder.push(start, ...draws, ...filler);
  return popOrder.reverse();
}

/** Plenty of dead cards to keep the draw pile from running out in rigged games. */
export const fillerCards = (count = 30, code = 'b3'): Card[] => Array.from({ length: count }, () => card(code));

/** Predicate matching a card by notation, ignoring its id: hand.find(is('rS')). */
export function is(code: string): (c: Card) => boolean {
  const probe = card(code);
  return (c) => c.color === probe.color && c.value === probe.value;
}

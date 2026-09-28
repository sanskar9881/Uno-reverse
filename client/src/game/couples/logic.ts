import type { CouplesCard, CouplesKind, CouplesLevel } from '@shared';
import { couplesPool, drawFromPool, lowerLevel } from '@shared/games/couples/decks';
import { randomIndex } from '../random';
import { deckKey, type TogetherState } from './storage';

export { lowerLevel };

/** The level actually in play for Together mode: the lower of the two partners' choices. */
export function togetherEffectiveLevel(state: TogetherState): CouplesLevel {
  return lowerLevel(state.levelA, state.levelB);
}

function poolFor(state: TogetherState, level: CouplesLevel, kind: CouplesKind): string[] {
  return [...couplesPool(level, kind), ...(state.customCards[deckKey(level, kind)] ?? [])];
}

/** Draws a card, mutating (a copy of) the deck-usage tracking so it never repeats until exhausted. */
export function drawTogetherCard(state: TogetherState, level: CouplesLevel, kind: CouplesKind): { card: CouplesCard; state: TogetherState } {
  const key = deckKey(level, kind);
  const pool = poolFor(state, level, kind);
  const { text, used } = drawFromPool(pool, state.usedByDeck[key] ?? [], randomIndex);
  return {
    card: { level, kind, text },
    state: { ...state, usedByDeck: { ...state.usedByDeck, [key]: used } },
  };
}

export function addTogetherCustomCard(state: TogetherState, level: CouplesLevel, kind: CouplesKind, text: string): TogetherState {
  const key = deckKey(level, kind);
  return { ...state, customCards: { ...state.customCards, [key]: [...(state.customCards[key] ?? []), text] } };
}

export function nextPartner(state: TogetherState): TogetherState {
  return { ...state, currentPartner: state.currentPartner === 0 ? 1 : 0 };
}

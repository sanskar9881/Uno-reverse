import type { CouplesCard, CouplesKind, CouplesLevel } from '@shared';
import { drawFromPool, type PoolEntry } from '@shared/games/common';
import { couplesPool, lowerLevel } from '@shared/games/couples/decks';
import { ourDeckCardsFor } from '../ourDeck/storage';
import { randomIndex } from '../random';
import { deckKey, type TogetherState } from './storage';

export { lowerLevel };

/** The level actually in play for Together mode: the lower of the two partners' choices. */
export function togetherEffectiveLevel(state: TogetherState): CouplesLevel {
  return lowerLevel(state.levelA, state.levelB);
}

function poolFor(level: CouplesLevel, kind: CouplesKind, onlyOurs: boolean): PoolEntry[] {
  const ours = ourDeckCardsFor('couples', level, kind).map((e): PoolEntry => ({ text: e.text, photo: e.photo }));
  if (onlyOurs) return ours;
  return [...couplesPool(level, kind).map((text): PoolEntry => ({ text, photo: null })), ...ours];
}

/** Draws a card, mutating (a copy of) the deck-usage tracking so it never repeats until exhausted. */
export function drawTogetherCard(
  state: TogetherState,
  level: CouplesLevel,
  kind: CouplesKind,
  onlyOurs: boolean,
): { card: CouplesCard; state: TogetherState } | null {
  const key = deckKey(level, kind);
  const pool = poolFor(level, kind, onlyOurs);
  if (pool.length === 0) return null;
  const { entry, used } = drawFromPool(pool, state.usedByDeck[key] ?? [], randomIndex);
  return {
    card: { level, kind, text: entry.text, photo: entry.photo ?? null },
    state: { ...state, usedByDeck: { ...state.usedByDeck, [key]: used } },
  };
}

export function nextPartner(state: TogetherState): TogetherState {
  return { ...state, currentPartner: state.currentPartner === 0 ? 1 : 0 };
}

import type { CouplesLevel, IntimacyCard, IntimacyCategory } from '@shared';
import { drawFromPool, lowerLevel, type PoolEntry } from '@shared/games/common';
import { intimacyPool } from '@shared/games/intimacy/decks';
import { ourDeckCardsFor } from '../ourDeck/storage';
import { randomIndex } from '../random';
import { deckKey, type IntimacyTogetherState } from './storage';

export { lowerLevel };

/** The level actually in play for Together mode: the lower of the two partners' choices. */
export function togetherEffectiveLevel(state: IntimacyTogetherState): CouplesLevel {
  return lowerLevel(state.levelA, state.levelB);
}

function poolFor(level: CouplesLevel, category: IntimacyCategory, onlyOurs: boolean): PoolEntry[] {
  const ours = ourDeckCardsFor('intimacy', level, category).map((e): PoolEntry => ({ text: e.text, photo: e.photo }));
  if (onlyOurs) return ours;
  return [...intimacyPool(level, category).map((text): PoolEntry => ({ text, photo: null })), ...ours];
}

/** Draws one card from a random included category, weighted by how many cards it has left. */
export function drawTogetherCard(
  state: IntimacyTogetherState,
  level: CouplesLevel,
  onlyOurs: boolean,
): { card: IntimacyCard; state: IntimacyTogetherState } | null {
  const withRemaining = state.categories
    .map((category) => {
      const pool = poolFor(level, category, onlyOurs);
      const used = state.usedByDeck[deckKey(level, category)] ?? [];
      const remaining = pool.filter((p) => !used.includes(p.text)).length || pool.length;
      return { category, remaining };
    })
    .filter((c) => c.remaining > 0);
  if (withRemaining.length === 0) return null;

  const total = withRemaining.reduce((sum, c) => sum + c.remaining, 0);
  let pick = randomIndex(total);
  let category = withRemaining[withRemaining.length - 1].category;
  for (const c of withRemaining) {
    if (pick < c.remaining) {
      category = c.category;
      break;
    }
    pick -= c.remaining;
  }

  const key = deckKey(level, category);
  const pool = poolFor(level, category, onlyOurs);
  const { entry, used } = drawFromPool(pool, state.usedByDeck[key] ?? [], randomIndex);
  return {
    card: { level, category, text: entry.text, photo: entry.photo ?? null },
    state: { ...state, usedByDeck: { ...state.usedByDeck, [key]: used } },
  };
}

export function nextPartner(state: IntimacyTogetherState): IntimacyTogetherState {
  return { ...state, currentPartner: state.currentPartner === 0 ? 1 : 0 };
}

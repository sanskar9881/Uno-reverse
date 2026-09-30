import type { CouplesKind, GroupCard, GroupCardType } from '@shared';
import { drawFromPool, type PoolEntry } from '@shared/games/common';
import { fillPlaceholders, groupPool, neighborsOf, timerSecondsFor } from '@shared/games/group/cards';
import { randomIndex } from '../random';
import { groupCustomCardsFor, type GroupOptions } from './storage';

export interface GroupTogetherState {
  /** Names in seating order. */
  players: string[];
  currentIndex: number;
  /** True between Done and a successful Spin, when pickMode is 'spin'. */
  awaitingSpin: boolean;
  usedByDeck: Record<string, string[]>;
}

export function createTogetherState(players: string[]): GroupTogetherState {
  return { players, currentIndex: 0, awaitingSpin: false, usedByDeck: {} };
}

const deckKey = (cardType: GroupCardType, kind: CouplesKind): string => `${cardType}:${kind}`;

function poolFor(cardType: GroupCardType, kind: CouplesKind, opts: GroupOptions): PoolEntry[] {
  const custom = groupCustomCardsFor(cardType, kind).map(
    (c): PoolEntry & { timerSeconds?: number | null } => ({ text: c.text, photo: null, timerSeconds: c.timerSeconds }),
  );
  const builtin = groupPool(cardType, kind, { noTouch: opts.noTouch, drinks: opts.drinks }).map((text): PoolEntry => ({
    text,
    photo: null,
  }));
  return [...custom, ...builtin];
}

/** Draws one card from a random included type, weighted by how many cards it has left. */
export function drawTogetherCard(
  state: GroupTogetherState,
  kind: CouplesKind,
  opts: GroupOptions,
): { card: GroupCard; state: GroupTogetherState } | null {
  const withRemaining = opts.types
    .map((cardType) => {
      const pool = poolFor(cardType, kind, opts);
      const used = state.usedByDeck[deckKey(cardType, kind)] ?? [];
      const remaining = pool.filter((p) => !used.includes(p.text)).length || pool.length;
      return { cardType, remaining };
    })
    .filter((c) => c.remaining > 0);
  if (withRemaining.length === 0) return null;

  const total = withRemaining.reduce((sum, c) => sum + c.remaining, 0);
  let pick = randomIndex(total);
  let cardType = withRemaining[withRemaining.length - 1].cardType;
  for (const c of withRemaining) {
    if (pick < c.remaining) {
      cardType = c.cardType;
      break;
    }
    pick -= c.remaining;
  }

  const key = deckKey(cardType, kind);
  const pool = poolFor(cardType, kind, opts);
  const { entry, used } = drawFromPool(pool, state.usedByDeck[key] ?? [], randomIndex);
  const order = state.players.map((_, i) => String(i));
  const { leftId, rightId } = neighborsOf(order, String(state.currentIndex));
  const text = fillPlaceholders(entry.text, state.players[Number(leftId)] ?? 'someone', state.players[Number(rightId)] ?? 'someone');
  const customEntry = entry as PoolEntry & { timerSeconds?: number | null };
  const timerSeconds = customEntry.timerSeconds !== undefined ? customEntry.timerSeconds : timerSecondsFor(entry.text);

  return {
    card: { cardType, kind, text, timerSeconds },
    state: { ...state, usedByDeck: { ...state.usedByDeck, [key]: used } },
  };
}

export function finishTurn(state: GroupTogetherState, pickMode: 'order' | 'spin'): GroupTogetherState {
  if (pickMode === 'spin') return { ...state, awaitingSpin: true };
  return { ...state, currentIndex: (state.currentIndex + 1) % state.players.length, awaitingSpin: false };
}

export function spinForNext(state: GroupTogetherState): { index: number; state: GroupTogetherState } {
  const index = randomIndex(state.players.length);
  return { index, state: { ...state, currentIndex: index, awaitingSpin: false } };
}

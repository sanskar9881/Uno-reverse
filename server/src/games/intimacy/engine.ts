import type { CouplesLevel, IntimacyCard, IntimacyCategory, IntimacyView } from '@shared';
import { INTIMACY_CATEGORIES, intimacyPool, lowerLevel } from '@shared/games/intimacy/decks';
import { drawFromPool, type PoolEntry } from '@shared/games/common';
import type { Rng } from '../../game/deck';
import { GameError } from '../../game/errors';

/**
 * Server-authoritative state for an online Intimacy Night session. Plain JSON, like the
 * UNO GameState. `customCards` lives only here — in memory, never persisted — so it
 * disappears the moment the room closes.
 */
export interface IntimacyState {
  kind: 'intimacy';
  playerIds: [string, string];
  levels: Record<string, CouplesLevel>;
  categories: IntimacyCategory[];
  onlyOurs: boolean;
  currentPartnerId: string;
  turnId: number;
  card: IntimacyCard | null;
  usedByDeck: Record<string, string[]>;
  customCards: Record<string, PoolEntry[]>;
}

const deckKey = (level: CouplesLevel, category: IntimacyCategory): string => `${level}:${category}`;

export function createIntimacyState(playerIds: [string, string]): IntimacyState {
  return {
    kind: 'intimacy',
    playerIds,
    levels: { [playerIds[0]]: 'sweet', [playerIds[1]]: 'sweet' },
    categories: [...INTIMACY_CATEGORIES],
    onlyOurs: false,
    currentPartnerId: playerIds[0],
    turnId: 0,
    card: null,
    usedByDeck: {},
    customCards: {},
  };
}

/** The level actually in play: never higher than either partner's own chosen comfort level. */
export function effectiveLevel(state: IntimacyState): CouplesLevel {
  const [a, b] = state.playerIds;
  return lowerLevel(state.levels[a] ?? 'sweet', state.levels[b] ?? 'sweet');
}

function poolFor(state: IntimacyState, level: CouplesLevel, category: IntimacyCategory): PoolEntry[] {
  const custom = state.customCards[deckKey(level, category)] ?? [];
  if (state.onlyOurs) return custom;
  return [...intimacyPool(level, category).map((text): PoolEntry => ({ text, photo: null })), ...custom];
}

function requireTurn(state: IntimacyState, playerId: string, turnId: number): void {
  if (state.currentPartnerId !== playerId) throw new GameError('NOT_YOUR_TURN', "It's not your turn.");
  if (turnId !== state.turnId) throw new GameError('STALE_ACTION', 'Too late, the turn already moved on.');
}

/** The current partner draws one card from a random included category at the effective level. */
export function drawCard(state: IntimacyState, playerId: string, turnId: number, rng: Rng): IntimacyCard {
  requireTurn(state, playerId, turnId);
  if (state.categories.length === 0) throw new GameError('INVALID_STATE', 'Pick at least one category first.');
  const level = effectiveLevel(state);

  // Weight by how many cards are actually left in each category so a nearly-exhausted
  // category doesn't get picked more than one with plenty of fresh cards remaining.
  const withRemaining = state.categories
    .map((category) => {
      const pool = poolFor(state, level, category);
      const used = state.usedByDeck[deckKey(level, category)] ?? [];
      const remaining = pool.filter((p) => !used.includes(p.text)).length || pool.length;
      return { category, remaining };
    })
    .filter((c) => c.remaining > 0);
  if (withRemaining.length === 0) {
    throw new GameError('INVALID_STATE', 'Add some cards to Our deck first, or turn off "Play only our cards".');
  }
  const total = withRemaining.reduce((sum, c) => sum + c.remaining, 0);
  let pick = rng(total);
  let category = withRemaining[withRemaining.length - 1].category;
  for (const c of withRemaining) {
    if (pick < c.remaining) {
      category = c.category;
      break;
    }
    pick -= c.remaining;
  }

  const pool = poolFor(state, level, category);
  const key = deckKey(level, category);
  const { entry, used } = drawFromPool(pool, state.usedByDeck[key] ?? [], rng);
  state.usedByDeck[key] = used;
  const card: IntimacyCard = { level, category, text: entry.text, photo: entry.photo ?? null };
  state.card = card;
  return card;
}

/** The turn passes to the other partner. */
export function finishTurn(state: IntimacyState, playerId: string, turnId: number): void {
  requireTurn(state, playerId, turnId);
  const [a, b] = state.playerIds;
  state.currentPartnerId = playerId === a ? b : a;
  state.card = null;
  state.turnId += 1;
}

/** Either partner can change their own comfort level at any time; it takes effect on the next card. */
export function setLevel(state: IntimacyState, playerId: string, level: CouplesLevel): void {
  if (!state.playerIds.includes(playerId)) throw new GameError('NOT_IN_ROOM', "You're not in this session.");
  state.levels[playerId] = level;
}

/** Either partner can change which categories are included; always at least one stays selected. */
export function setCategories(state: IntimacyState, categories: IntimacyCategory[]): void {
  const unique = [...new Set(categories)];
  if (unique.length === 0) throw new GameError('INVALID_STATE', 'Keep at least one category selected.');
  state.categories = unique;
}

export function setOnlyOurs(state: IntimacyState, value: boolean): void {
  state.onlyOurs = value;
}

export function addCustomCard(
  state: IntimacyState,
  level: CouplesLevel,
  category: IntimacyCategory,
  text: string,
  photo: string | null = null,
): void {
  const key = deckKey(level, category);
  state.customCards[key] = [...(state.customCards[key] ?? []), { text, photo }];
}

export function buildIntimacyView(state: IntimacyState): IntimacyView {
  return {
    levels: { ...state.levels },
    categories: [...state.categories],
    onlyOurs: state.onlyOurs,
    currentPartnerId: state.currentPartnerId,
    turnId: state.turnId,
    card: state.card ? { ...state.card } : null,
  };
}

import type { CouplesKind, GroupCard, GroupCardType, GroupPickMode, GroupView } from '@shared';
import { fillPlaceholders, groupPool, neighborsOf, timerSecondsFor } from '@shared/games/group/cards';
import { drawFromPool, type PoolEntry } from '@shared/games/common';
import type { Rng } from '../../game/deck';
import { GameError } from '../../game/errors';

interface GroupPoolEntry extends PoolEntry {
  /** Set on a custom card only: an explicit timer, independent of the "for N seconds" text pattern. */
  timerSeconds?: number | null;
}

/**
 * Server-authoritative state for an online Truth and Dare Group session. Plain JSON, like
 * the UNO GameState. `customCards` lives only here — in memory, never persisted — so it
 * disappears the moment the room closes.
 */
export interface GroupState {
  kind: 'group';
  /** Player ids in seating order. */
  turnOrder: string[];
  currentPlayerId: string;
  turnId: number;
  types: GroupCardType[];
  pickMode: GroupPickMode;
  noTouch: boolean;
  drinks: boolean;
  passPenalty: boolean;
  /** True between Done and a successful Spin, when `pickMode` is 'spin'. */
  awaitingSpin: boolean;
  card: GroupCard | null;
  usedByDeck: Record<string, string[]>;
  customCards: Record<string, GroupPoolEntry[]>;
}

const deckKey = (cardType: GroupCardType, kind: CouplesKind): string => `${cardType}:${kind}`;

export function createGroupState(playerIds: string[]): GroupState {
  if (playerIds.length < 2) throw new GameError('NOT_ENOUGH_PLAYERS', 'You need at least 2 players to start.');
  return {
    kind: 'group',
    turnOrder: [...playerIds],
    currentPlayerId: playerIds[0],
    turnId: 0,
    types: ['normal'],
    pickMode: 'order',
    noTouch: false,
    drinks: false,
    passPenalty: false,
    awaitingSpin: false,
    card: null,
    usedByDeck: {},
    customCards: {},
  };
}

function poolFor(state: GroupState, cardType: GroupCardType, kind: CouplesKind): GroupPoolEntry[] {
  const custom = state.customCards[deckKey(cardType, kind)] ?? [];
  const builtin = groupPool(cardType, kind, { noTouch: state.noTouch, drinks: state.drinks }).map(
    (text): GroupPoolEntry => ({ text, photo: null }),
  );
  return [...custom, ...builtin];
}

function nextInOrder(order: readonly string[], current: string): string {
  const index = order.indexOf(current);
  if (index === -1) return order[0];
  return order[(index + 1) % order.length];
}

function requireTurn(state: GroupState, playerId: string, turnId: number): void {
  if (state.currentPlayerId !== playerId) throw new GameError('NOT_YOUR_TURN', "It's not your turn.");
  if (turnId !== state.turnId) throw new GameError('STALE_ACTION', 'Too late, the turn already moved on.');
  if (state.awaitingSpin) throw new GameError('INVALID_STATE', 'Spin first to see who goes next.');
}

function drawCard(state: GroupState, kind: CouplesKind, names: Record<string, string>, rng: Rng): GroupCard {
  // Weight by how many cards are actually left in each type so a nearly-exhausted type
  // doesn't get picked more than one with plenty of fresh cards remaining.
  const withRemaining = state.types
    .map((cardType) => {
      const pool = poolFor(state, cardType, kind);
      const used = state.usedByDeck[deckKey(cardType, kind)] ?? [];
      const remaining = pool.filter((p) => !used.includes(p.text)).length || pool.length;
      return { cardType, remaining };
    })
    .filter((c) => c.remaining > 0);
  if (withRemaining.length === 0) {
    throw new GameError('INVALID_STATE', 'No cards are available for the current options.');
  }
  const total = withRemaining.reduce((sum, c) => sum + c.remaining, 0);
  let pick = rng(total);
  let cardType = withRemaining[withRemaining.length - 1].cardType;
  for (const c of withRemaining) {
    if (pick < c.remaining) {
      cardType = c.cardType;
      break;
    }
    pick -= c.remaining;
  }

  const pool = poolFor(state, cardType, kind);
  const key = deckKey(cardType, kind);
  const { entry, used } = drawFromPool(pool, state.usedByDeck[key] ?? [], rng);
  state.usedByDeck[key] = used;

  const { leftId, rightId } = neighborsOf(state.turnOrder, state.currentPlayerId);
  const text = fillPlaceholders(entry.text, names[leftId] ?? 'someone', names[rightId] ?? 'someone');
  const timerSeconds = entry.timerSeconds !== undefined ? entry.timerSeconds : timerSecondsFor(entry.text);
  const card: GroupCard = { cardType, kind, text, timerSeconds };
  state.card = card;
  return card;
}

/** The current player picks Truth or Dare, drawing a fresh card. */
export function chooseCard(
  state: GroupState,
  playerId: string,
  kind: CouplesKind,
  turnId: number,
  names: Record<string, string>,
  rng: Rng,
): GroupCard {
  requireTurn(state, playerId, turnId);
  return drawCard(state, kind, names, rng);
}

/** Draws another card of the same kind. Unlimited, no server-side penalty (that's cosmetic, client-side). */
export function passCard(
  state: GroupState,
  playerId: string,
  turnId: number,
  names: Record<string, string>,
  rng: Rng,
): GroupCard {
  requireTurn(state, playerId, turnId);
  if (!state.card) throw new GameError('INVALID_STATE', 'Choose Truth or Dare first.');
  return drawCard(state, state.card.kind, names, rng);
}

/** Ends the current turn. Advances directly in seat order, or waits for a Spin. */
export function finishTurn(state: GroupState, playerId: string, turnId: number): void {
  requireTurn(state, playerId, turnId);
  state.card = null;
  state.turnId += 1;
  if (state.pickMode === 'spin') state.awaitingSpin = true;
  else state.currentPlayerId = nextInOrder(state.turnOrder, playerId);
}

/** Resolves a "Spin to pick" between Done and the next card. Any connected player may spin. */
export function spinForNext(state: GroupState, turnId: number, rng: Rng): string {
  if (state.pickMode !== 'spin') throw new GameError('INVALID_STATE', "Spin to pick isn't on.");
  if (!state.awaitingSpin) throw new GameError('INVALID_STATE', 'Nothing to spin for right now.');
  if (turnId !== state.turnId) throw new GameError('STALE_ACTION', 'Too late, that spin already happened.');
  if (state.turnOrder.length === 0) throw new GameError('INVALID_STATE', 'No players left.');
  const nextId = state.turnOrder[rng(state.turnOrder.length)];
  state.currentPlayerId = nextId;
  state.awaitingSpin = false;
  return nextId;
}

/** Which card types are in play. Always at least one. */
export function setTypes(state: GroupState, types: GroupCardType[]): void {
  const unique = [...new Set(types)];
  if (unique.length === 0) throw new GameError('INVALID_STATE', 'Keep at least one type selected.');
  state.types = unique;
}

export function setOptions(
  state: GroupState,
  patch: Partial<{ noTouch: boolean; drinks: boolean; passPenalty: boolean; pickMode: GroupPickMode }>,
): void {
  if (patch.noTouch !== undefined) state.noTouch = patch.noTouch;
  if (patch.drinks !== undefined) state.drinks = patch.drinks;
  if (patch.passPenalty !== undefined) state.passPenalty = patch.passPenalty;
  if (patch.pickMode !== undefined) {
    state.pickMode = patch.pickMode;
    state.awaitingSpin = false;
  }
}

export function addCustomCard(
  state: GroupState,
  cardType: GroupCardType,
  kind: CouplesKind,
  text: string,
  timerSeconds: number | null = null,
): void {
  const key = deckKey(cardType, kind);
  state.customCards[key] = [...(state.customCards[key] ?? []), { text, photo: null, timerSeconds }];
}

/** Removes a player from the table, reassigning the current turn if needed. */
export function removePlayer(state: GroupState, playerId: string): void {
  state.turnOrder = state.turnOrder.filter((id) => id !== playerId);
  if (state.turnOrder.length === 0) {
    state.currentPlayerId = '';
    state.card = null;
    state.awaitingSpin = false;
    return;
  }
  if (state.currentPlayerId === playerId) {
    state.currentPlayerId = state.turnOrder[0];
    state.card = null;
    state.awaitingSpin = false;
    state.turnId += 1;
  } else if (!state.turnOrder.includes(state.currentPlayerId)) {
    state.currentPlayerId = state.turnOrder[0];
  }
}

export function buildGroupView(state: GroupState): GroupView {
  return {
    turnOrder: [...state.turnOrder],
    currentPlayerId: state.currentPlayerId,
    turnId: state.turnId,
    types: [...state.types],
    pickMode: state.pickMode,
    noTouch: state.noTouch,
    drinks: state.drinks,
    passPenalty: state.passPenalty,
    awaitingSpin: state.awaitingSpin,
    card: state.card ? { ...state.card } : null,
  };
}

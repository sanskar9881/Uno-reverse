import type { CouplesCard, CouplesKind, CouplesLevel, CouplesView } from '@shared';
import { couplesPool, drawFromPool, lowerLevel } from '@shared/games/couples/decks';
import type { Rng } from '../../game/deck';
import { GameError } from '../../game/errors';

/**
 * Server-authoritative state for an online Couples Truth or Dare session. Plain JSON, like
 * the UNO GameState. `customCards` lives only here — in memory, never persisted — so it
 * disappears the moment the room closes, matching the privacy guarantee in the plan.
 */
export interface CouplesState {
  kind: 'couples';
  playerIds: [string, string];
  levels: Record<string, CouplesLevel>;
  currentPartnerId: string;
  turnId: number;
  card: CouplesCard | null;
  usedByDeck: Record<string, string[]>;
  customCards: Record<string, string[]>;
}

const deckKey = (level: CouplesLevel, kind: CouplesKind): string => `${level}:${kind}`;

export function createCouplesState(playerIds: [string, string]): CouplesState {
  return {
    kind: 'couples',
    playerIds,
    levels: { [playerIds[0]]: 'sweet', [playerIds[1]]: 'sweet' },
    currentPartnerId: playerIds[0],
    turnId: 0,
    card: null,
    usedByDeck: {},
    customCards: {},
  };
}

/** The level actually in play: never higher than either partner's own chosen comfort level. */
export function effectiveLevel(state: CouplesState): CouplesLevel {
  const [a, b] = state.playerIds;
  return lowerLevel(state.levels[a] ?? 'sweet', state.levels[b] ?? 'sweet');
}

function poolFor(state: CouplesState, level: CouplesLevel, kind: CouplesKind): string[] {
  return [...couplesPool(level, kind), ...(state.customCards[deckKey(level, kind)] ?? [])];
}

function drawCard(state: CouplesState, level: CouplesLevel, kind: CouplesKind, rng: Rng): CouplesCard {
  const pool = poolFor(state, level, kind);
  const key = deckKey(level, kind);
  const { text, used } = drawFromPool(pool, state.usedByDeck[key] ?? [], rng);
  state.usedByDeck[key] = used;
  return { level, kind, text };
}

function requireTurn(state: CouplesState, playerId: string, turnId: number): void {
  if (state.currentPartnerId !== playerId) throw new GameError('NOT_YOUR_TURN', "It's not your turn.");
  if (turnId !== state.turnId) throw new GameError('STALE_ACTION', 'Too late, the turn already moved on.');
}

/** The current partner picks Truth or Dare, drawing a fresh card at the effective level. */
export function chooseCard(state: CouplesState, playerId: string, kind: CouplesKind, turnId: number, rng: Rng): CouplesCard {
  requireTurn(state, playerId, turnId);
  const card = drawCard(state, effectiveLevel(state), kind, rng);
  state.card = card;
  return card;
}

/** Draws another card of the same kind. Unlimited, no penalty. */
export function passCard(state: CouplesState, playerId: string, turnId: number, rng: Rng): CouplesCard {
  requireTurn(state, playerId, turnId);
  if (!state.card) throw new GameError('INVALID_STATE', 'Choose Truth or Dare first.');
  const card = drawCard(state, state.card.level, state.card.kind, rng);
  state.card = card;
  return card;
}

/** The turn passes to the other partner. */
export function finishTurn(state: CouplesState, playerId: string, turnId: number): void {
  requireTurn(state, playerId, turnId);
  const [a, b] = state.playerIds;
  state.currentPartnerId = playerId === a ? b : a;
  state.card = null;
  state.turnId += 1;
}

/** Either partner can change their own comfort level at any time; it takes effect on the next card. */
export function setLevel(state: CouplesState, playerId: string, level: CouplesLevel): void {
  if (!state.playerIds.includes(playerId)) throw new GameError('NOT_IN_ROOM', "You're not in this session.");
  state.levels[playerId] = level;
}

export function addCustomCard(state: CouplesState, level: CouplesLevel, kind: CouplesKind, text: string): void {
  const key = deckKey(level, kind);
  state.customCards[key] = [...(state.customCards[key] ?? []), text];
}

export function buildCouplesView(state: CouplesState): CouplesView {
  return {
    levels: { ...state.levels },
    currentPartnerId: state.currentPartnerId,
    turnId: state.turnId,
    card: state.card ? { ...state.card } : null,
  };
}

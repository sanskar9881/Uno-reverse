import type { BottlePartySettings, BottlePromptPack, BottleView } from '@shared';
import { promptPool } from '@shared/games/bottle/prompts';
import type { Rng } from '../../game/deck';
import { GameError } from '../../game/errors';
import { newPlayerId } from '../../utils/ids';

export interface BottleSpin {
  id: string;
  seatOrder: string[];
  targetId: string;
  startedAt: number;
  durationMs: number;
}

/**
 * Server-authoritative state for an online Spin the Bottle table. Plain JSON, like
 * the UNO GameState, so it can be persisted the same way. `usedPrompts` is server-only
 * bookkeeping (which prompts have been drawn this session) and never reaches clients.
 */
export interface BottleState {
  turnOrder: string[];
  spinnerId: string;
  turnId: number;
  spin: BottleSpin | null;
  prompt: string | null;
  settings: BottlePartySettings;
  usedPrompts: Record<BottlePromptPack, string[]>;
}

export function createBottleState(playerIds: string[], settings: BottlePartySettings): BottleState {
  if (playerIds.length < 2) {
    throw new GameError('NOT_ENOUGH_PLAYERS', 'You need at least 2 players to spin the bottle.');
  }
  return {
    turnOrder: [...playerIds],
    spinnerId: playerIds[0],
    turnId: 0,
    spin: null,
    prompt: null,
    settings: { ...settings },
    usedPrompts: { off: [], party: [], flirty: [] },
  };
}

/** Starts a spin: only the current spinner, only when none is already running, and only with a fresh turnId. */
export function startSpin(
  state: BottleState,
  spinnerId: string,
  turnId: number,
  connectedIds: readonly string[],
  rng: Rng,
  now: number,
  durationRangeMs: readonly [number, number],
): BottleSpin {
  if (state.spinnerId !== spinnerId) throw new GameError('NOT_YOUR_TURN', "It's not your turn to spin.");
  if (turnId !== state.turnId) throw new GameError('STALE_ACTION', 'Too late, the bottle already moved on.');
  if (state.spin) throw new GameError('INVALID_STATE', 'The bottle is already spinning.');

  const connected = new Set(connectedIds);
  const candidates = state.turnOrder.filter(
    (id) => connected.has(id) && (state.settings.canLandOnSelf || id !== spinnerId),
  );
  if (candidates.length === 0) {
    throw new GameError('NOT_ENOUGH_PLAYERS', 'Nobody else is here for the bottle to land on.');
  }
  const targetId = candidates[rng(candidates.length)];
  const [min, max] = durationRangeMs;
  const durationMs = min + rng(Math.max(1, max - min));

  state.spin = { id: newPlayerId(), seatOrder: [...state.turnOrder], targetId, startedAt: now, durationMs };
  return state.spin;
}

function drawPrompt(state: BottleState, rng: Rng): string | null {
  const pack = state.settings.pack;
  if (pack === 'off') return null;
  const pool = promptPool(pack);
  let used = state.usedPrompts[pack];
  if (used.length >= pool.length) used = [];
  const remaining = pool.filter((p) => !used.includes(p));
  const pick = remaining[rng(remaining.length)];
  state.usedPrompts[pack] = [...used, pick];
  return pick;
}

function nextInOrder(order: readonly string[], current: string): string {
  const index = order.indexOf(current);
  if (index === -1) return order[0];
  return order[(index + 1) % order.length];
}

/** Called by the server timer once a spin's duration has elapsed. Draws a prompt and passes the turn. */
export function landSpin(state: BottleState, rng: Rng): void {
  const spin = state.spin;
  if (!spin) return;
  state.prompt = drawPrompt(state, rng);
  state.spinnerId = state.settings.clockwiseTurns ? nextInOrder(state.turnOrder, state.spinnerId) : spin.targetId;
  state.spin = null;
  state.turnId += 1;
}

/** Passes the turn to the next player in seat order without a spin, e.g. when the spinner disconnects. */
export function skipToNextSpinner(state: BottleState): void {
  state.spinnerId = nextInOrder(state.turnOrder, state.spinnerId);
  state.turnId += 1;
}

/** Removes a player from the table, reassigning the spinner if needed. Cancels an in-flight spin targeting them. */
export function removePlayer(state: BottleState, playerId: string): void {
  state.turnOrder = state.turnOrder.filter((id) => id !== playerId);
  if (state.turnOrder.length === 0) {
    state.spinnerId = '';
    state.spin = null;
    return;
  }
  if (state.spin?.targetId === playerId) {
    state.spin = null;
    state.turnId += 1;
  }
  if (!state.turnOrder.includes(state.spinnerId)) {
    state.spinnerId = state.turnOrder[0];
  }
}

export function updateSettings(state: BottleState, patch: Partial<BottlePartySettings>): void {
  state.settings = { ...state.settings, ...patch };
}

export function buildBottleView(state: BottleState): BottleView {
  return {
    turnOrder: [...state.turnOrder],
    spinnerId: state.spinnerId,
    turnId: state.turnId,
    spin: state.spin ? { ...state.spin, seatOrder: [...state.spin.seatOrder] } : null,
    prompt: state.prompt,
    settings: { ...state.settings },
  };
}

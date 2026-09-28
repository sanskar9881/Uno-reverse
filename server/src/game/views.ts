import type { GameView } from '@shared';
import type { GameState } from './engine';

const RECENT_DISCARDS = 5;

/** Builds the public view of a round for one viewer. Hands are reduced to counts. */
export function buildGameView(
  state: GameState,
  viewerId: string,
  timing: { turnEndsAt: number; turnDurationMs: number },
): GameView {
  const currentPlayerId = state.players[state.currentIndex];
  const cardCounts: Record<string, number> = {};
  for (const id of state.players) cardCounts[id] = state.hands[id]?.length ?? 0;

  return {
    turnOrder: [...state.players],
    currentPlayerId,
    direction: state.direction,
    currentColor: state.currentColor,
    topCard: state.discardPile[state.discardPile.length - 1],
    recentDiscards: state.discardPile.slice(-RECENT_DISCARDS),
    discardCount: state.discardPile.length,
    drawPileCount: state.drawPile.length,
    cardCounts,
    unoDeclared: [...new Set([...state.unoDeclared, ...state.unoPrimed])],
    unoVulnerableId: state.unoVulnerableId,
    turnId: state.turnId,
    turnEndsAt: state.finished ? 0 : timing.turnEndsAt,
    turnDurationMs: timing.turnDurationMs,
    hasDrawnThisTurn: state.hasDrawn,
    drawnCardId: currentPlayerId === viewerId ? state.drawnCardId : null,
    finished: state.finished,
  };
}

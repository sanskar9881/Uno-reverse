/**
 * Lets animations find where things are on screen (a player's seat, the piles)
 * without threading refs through the whole component tree.
 */
const elements = new Map<string, HTMLElement>();

export const seatKey = (playerId: string): string => `seat:${playerId}`;
export const DRAW_PILE = 'draw-pile';
export const DISCARD_PILE = 'discard-pile';
export const HAND = 'hand';

export function registerElement(key: string): (el: HTMLElement | null) => void {
  return (el) => {
    if (el) elements.set(key, el);
    else if (elements.get(key)?.isConnected === false) elements.delete(key);
  };
}

export function centerOf(key: string): { x: number; y: number } | null {
  const el = elements.get(key);
  if (!el || !el.isConnected) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** Where the local player's played card started, so the discard can fly in from it. */
const playOrigins = new Map<string, { x: number; y: number }>();

export function rememberPlayOrigin(cardId: string, point: { x: number; y: number }): void {
  playOrigins.set(cardId, point);
  if (playOrigins.size > 20) playOrigins.delete(playOrigins.keys().next().value!);
}

/** Non-destructive read (React may render twice in development). */
export function peekPlayOrigin(cardId: string): { x: number; y: number } | null {
  return playOrigins.get(cardId) ?? null;
}

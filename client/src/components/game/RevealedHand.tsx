import type { ClientState } from '@shared';
import { CardFace } from '../cards/Card';

/**
 * The one deliberate exception to hand privacy: right after you challenge a Wild +4,
 * you briefly see the challenged player's hand, as in the physical game.
 */
export function RevealedHand({ state }: { state: ClientState }) {
  const revealed = state.revealedHand;
  if (!revealed) return null;
  const owner = state.room.players.find((p) => p.id === revealed.ownerId);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-14 z-modal flex justify-center px-3">
      <div className="pointer-events-auto max-w-full rounded-3xl bg-night-2/95 p-4 text-center shadow-[0_20px_50px_rgb(0_0_0/0.5)] ring-1 ring-line backdrop-blur">
        <p className="text-sm font-bold text-ink">{owner?.nickname ?? 'Their'} hand</p>
        <div className="mt-2 flex max-w-full flex-wrap justify-center gap-1.5">
          {revealed.cards.map((card) => (
            <CardFace key={card.id} card={card} style={{ width: 40 }} />
          ))}
        </div>
      </div>
    </div>
  );
}

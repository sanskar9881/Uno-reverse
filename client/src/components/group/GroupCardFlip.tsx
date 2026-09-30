import type { GroupCard } from '@shared';
import { GROUP_CARD_TYPE_LABEL } from '@shared/games/group/cards';
import { playSound } from '../../game/sounds';
import { FlipCard } from '../shared/FlipCard';

const COLORS = {
  card1: 'var(--color-group-card-1)',
  card2: 'var(--color-group-card-2)',
  card3: 'var(--color-group-card-3)',
  accent: 'var(--color-group-violet)',
  ink: 'var(--color-group-ink)',
};

/** A tarot-styled card that flips to reveal a Truth and Dare Group card, with a Start button for timed dares. */
export function GroupCardFlip({ card }: { card: GroupCard | null }) {
  return (
    <FlipCard
      cardKey={card?.text ?? null}
      timerSeconds={card?.timerSeconds ?? null}
      colors={COLORS}
      onReveal={() => {
        playSound('couplesReveal');
        navigator.vibrate?.(25);
      }}
      placeholder={
        <>
          <span className="flip-card__emoji" aria-hidden>
            🎉
          </span>
          <p className="flip-card__text font-display" style={{ color: 'var(--color-group-ink)', opacity: 0.7 }}>
            Choose Truth or Dare
          </p>
        </>
      }
    >
      {card && (
        <>
          <span
            className="flip-card__badge shrink-0 rounded-full px-3 py-1 font-bold uppercase tracking-wide"
            style={{ background: 'color-mix(in oklab, var(--color-group-violet) 20%, transparent)', color: 'var(--color-group-violet)' }}
          >
            {GROUP_CARD_TYPE_LABEL[card.cardType]} · {card.kind === 'truth' ? 'Truth' : 'Dare'}
          </span>
          <p className="flip-card__text min-h-0 overflow-y-auto font-display leading-snug" style={{ color: 'var(--color-group-ink)' }}>
            {card.text}
          </p>
        </>
      )}
    </FlipCard>
  );
}

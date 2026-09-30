import type { IntimacyCard } from '@shared';
import { timerSecondsFor } from '@shared/games/common';
import { INTIMACY_CATEGORY_LABEL } from '@shared/games/intimacy/decks';
import { playSound } from '../../game/sounds';
import { FlipCard } from '../shared/FlipCard';

const LEVEL_LABEL = { sweet: 'Sweet', flirty: 'Flirty', spicy: 'Spicy' } as const;

const COLORS = {
  card1: 'var(--color-couples-card-1)',
  card2: 'var(--color-couples-card-2)',
  card3: 'var(--color-couples-card-3)',
  accent: 'var(--color-couples-candle)',
  ink: 'var(--color-couples-ink)',
};

/** A tarot-styled card that flips to reveal an Intimacy Night card, with a Start button for timed cards. */
export function IntimacyCardFlip({ card }: { card: IntimacyCard | null }) {
  const timer = card ? timerSecondsFor(card.text) : null;

  return (
    <FlipCard
      cardKey={card?.text ?? null}
      timerSeconds={timer}
      colors={COLORS}
      onReveal={() => {
        playSound('couplesReveal');
        navigator.vibrate?.(25);
      }}
      placeholder={
        <>
          <span className="flip-card__emoji" aria-hidden>
            🕯️
          </span>
          <p className="flip-card__text font-couples text-couples-ink/70">Draw a card</p>
        </>
      }
    >
      {card && (
        <>
          <span className="flip-card__badge shrink-0 rounded-full bg-couples-candle/20 px-3 py-1 font-bold uppercase tracking-wide text-couples-candle">
            {LEVEL_LABEL[card.level]} · {INTIMACY_CATEGORY_LABEL[card.category]}
          </span>
          {card.photo && (
            <img
              src={card.photo}
              alt=""
              className="max-h-[26%] w-auto shrink-0 rounded-xl object-cover shadow-[0_6px_20px_rgb(0_0_0/0.4)]"
            />
          )}
          <p className="flip-card__text min-h-0 overflow-y-auto font-couples leading-snug text-couples-ink">{card.text}</p>
        </>
      )}
    </FlipCard>
  );
}

import type { CouplesCard } from '@shared';
import { timerSecondsFor } from '@shared/games/couples/decks';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { playSound } from '../../game/sounds';

const LEVEL_LABEL: Record<CouplesCard['level'], string> = { sweet: 'Sweet', flirty: 'Flirty', spicy: 'Spicy' };

function Countdown({ seconds }: { seconds: number }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    setLeft(seconds);
    const id = setInterval(() => setLeft((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(id);
  }, [seconds]);
  return (
    <div className="mt-3 flex items-center justify-center gap-2 text-couples-candle">
      <span className="text-2xl font-display tabular-nums">{left}s</span>
    </div>
  );
}

/** A tarot-styled card that flips to reveal a truth or dare, with a sound, a light vibration and a gentle glow. */
export function CardFlip({ card }: { card: CouplesCard | null }) {
  const timer = card ? timerSecondsFor(card.text) : null;
  const lastRevealed = useRef<string | null>(null);
  useEffect(() => {
    if (card && card.text !== lastRevealed.current) {
      playSound('couplesReveal');
      navigator.vibrate?.(25);
    }
    lastRevealed.current = card?.text ?? null;
  }, [card]);

  return (
    <div className="mx-auto w-full max-w-xs" style={{ perspective: 1200 }}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={card ? card.text : 'back'}
          initial={{ rotateY: 90, opacity: 0.4 }}
          animate={{ rotateY: 0, opacity: 1 }}
          exit={{ rotateY: -90, opacity: 0.4 }}
          transition={{ duration: 0.35, ease: 'easeInOut' }}
          className="relative flex aspect-[5/7] flex-col items-center justify-center gap-4 rounded-[24px] p-6 text-center shadow-[0_20px_50px_rgb(0_0_0/0.55)]"
          style={{
            background:
              'linear-gradient(155deg, var(--color-couples-card-1) 0%, var(--color-couples-card-2) 60%, var(--color-couples-card-3) 100%)',
            border: '2px solid var(--color-couples-candle)',
          }}
        >
          {card && (
            <motion.div
              key={`glow-${card.text}`}
              className="pointer-events-none absolute -inset-4 rounded-[28px]"
              initial={{ opacity: 0.9 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 1.1, ease: 'easeOut' }}
              style={{ boxShadow: '0 0 60px 20px rgb(246 193 119 / 0.5)' }}
              aria-hidden
            />
          )}
          <div
            className="pointer-events-none absolute inset-3 rounded-[18px]"
            style={{ boxShadow: 'inset 0 0 0 1px rgb(246 193 119 / 0.5)' }}
            aria-hidden
          />
          {card ? (
            <>
              <span className="rounded-full bg-couples-candle/20 px-3 py-1 text-xs font-bold uppercase tracking-wide text-couples-candle">
                {LEVEL_LABEL[card.level]} · {card.kind === 'truth' ? 'Truth' : 'Dare'}
              </span>
              <p className="font-couples text-xl leading-snug text-couples-ink">{card.text}</p>
              {timer && <Countdown seconds={timer} />}
            </>
          ) : (
            <>
              <span className="text-5xl" aria-hidden>
                🕯️
              </span>
              <p className="font-couples text-lg text-couples-ink/70">Choose Truth or Dare</p>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

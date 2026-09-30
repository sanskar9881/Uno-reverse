import type { IntimacyCard } from '@shared';
import { timerSecondsFor } from '@shared/games/common';
import { INTIMACY_CATEGORY_LABEL } from '@shared/games/intimacy/decks';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { useElementSize } from '../../hooks/useElementSize';
import { useWakeLock } from '../../hooks/useWakeLock';
import { playSound } from '../../game/sounds';

const RATIO = 5 / 7;

/** The largest 5:7 box that fits inside `box`, so the card shrinks by whichever dimension is tighter. */
function fitCard(box: { width: number; height: number }): { width: number; height: number } {
  if (!box.width || !box.height) return { width: 0, height: 0 };
  const byWidth = { width: box.width, height: box.width / RATIO };
  return byWidth.height <= box.height ? byWidth : { width: box.height * RATIO, height: box.height };
}

const LEVEL_LABEL = { sweet: 'Sweet', flirty: 'Flirty', spicy: 'Spicy' } as const;

type Phase = 'idle' | 'ready' | 'running' | 'done';

/** A get-ready countdown (3, 2, 1) followed by the card's own timer, running down to 0. */
function TimerRun({ seconds, phase, onReady }: { seconds: number; phase: Phase; onReady: () => void }) {
  const [readyLeft, setReadyLeft] = useState(3);
  const [runLeft, setRunLeft] = useState(seconds);

  useEffect(() => {
    if (phase !== 'ready') return;
    setReadyLeft(3);
    const id = setInterval(() => {
      setReadyLeft((n) => {
        if (n <= 1) {
          clearInterval(id);
          onReady();
          return 0;
        }
        return n - 1;
      });
    }, 700);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (phase !== 'running') return;
    setRunLeft(seconds);
    const id = setInterval(() => setRunLeft((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(id);
  }, [phase, seconds]);

  if (phase === 'ready') {
    return (
      <div className="flex items-center justify-center gap-2 text-couples-candle">
        <span className="intimacy-card__timer font-display tabular-nums">{readyLeft || 'Go!'}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center gap-2 text-couples-candle">
      <span className="intimacy-card__timer font-display tabular-nums">{runLeft}s</span>
    </div>
  );
}

/** A tarot-styled card that flips to reveal an Intimacy Night card, with a Start button for timed cards. */
export function IntimacyCardFlip({ card }: { card: IntimacyCard | null }) {
  const timer = card ? timerSecondsFor(card.text) : null;
  const [phase, setPhase] = useState<Phase>('idle');
  const lastRevealed = useRef<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const box = useElementSize(wrapperRef);
  const fitted = fitCard(box);

  useEffect(() => {
    if (card && card.text !== lastRevealed.current) {
      playSound('couplesReveal');
      navigator.vibrate?.(25);
      setPhase('idle');
    }
    lastRevealed.current = card?.text ?? null;
  }, [card]);

  useWakeLock(phase === 'ready' || phase === 'running');

  return (
    <div
      ref={wrapperRef}
      className="mx-auto flex min-h-0 w-full max-w-xs flex-1 flex-col items-center justify-center"
      style={{ perspective: 1200 }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={card ? card.text : 'back'}
          initial={{ rotateY: 90, opacity: 0.4 }}
          animate={{ rotateY: 0, opacity: 1 }}
          exit={{ rotateY: -90, opacity: 0.4 }}
          transition={{ duration: 0.35, ease: 'easeInOut' }}
          className="intimacy-card relative flex flex-col items-center justify-center gap-1.5 overflow-hidden rounded-[24px] p-4 text-center shadow-[0_20px_50px_rgb(0_0_0/0.55)]"
          style={{
            width: fitted.width || undefined,
            height: fitted.height || undefined,
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
              <span className="intimacy-card__badge shrink-0 rounded-full bg-couples-candle/20 px-3 py-1 font-bold uppercase tracking-wide text-couples-candle">
                {LEVEL_LABEL[card.level]} · {INTIMACY_CATEGORY_LABEL[card.category]}
              </span>
              {card.photo && (
                <img
                  src={card.photo}
                  alt=""
                  className="max-h-[26%] w-auto shrink-0 rounded-xl object-cover shadow-[0_6px_20px_rgb(0_0_0/0.4)]"
                />
              )}
              <p className="intimacy-card__text min-h-0 overflow-y-auto font-couples leading-snug text-couples-ink">{card.text}</p>
              {timer &&
                (phase === 'idle' ? (
                  <button
                    type="button"
                    onClick={() => setPhase('ready')}
                    className="intimacy-card__timer shrink-0 rounded-full bg-couples-candle/25 px-4 py-1 font-bold text-couples-candle hover:bg-couples-candle/35"
                  >
                    Start
                  </button>
                ) : (
                  <TimerRun seconds={timer} phase={phase} onReady={() => setPhase('running')} />
                ))}
            </>
          ) : (
            <>
              <span className="intimacy-card__emoji" aria-hidden>
                🕯️
              </span>
              <p className="intimacy-card__text font-couples text-couples-ink/70">Draw a card</p>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

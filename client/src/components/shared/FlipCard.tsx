import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useElementSize } from '../../hooks/useElementSize';
import { useWakeLock } from '../../hooks/useWakeLock';

const RATIO = 5 / 7;

/** The largest 5:7 box that fits inside `box`, so the card shrinks by whichever dimension is tighter. */
function fitCard(box: { width: number; height: number }): { width: number; height: number } {
  if (!box.width || !box.height) return { width: 0, height: 0 };
  const byWidth = { width: box.width, height: box.width / RATIO };
  return byWidth.height <= box.height ? byWidth : { width: box.height * RATIO, height: box.height };
}

type Phase = 'idle' | 'ready' | 'running';

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

  const label = phase === 'ready' ? readyLeft || 'Go!' : `${runLeft}s`;
  return (
    <div className="flex items-center justify-center gap-2" style={{ color: 'var(--flip-card-accent)' }}>
      <span className="flip-card__timer font-display tabular-nums">{label}</span>
    </div>
  );
}

interface FlipCardProps {
  /** Identifies the current card, for the flip transition and to know when a fresh one arrived. */
  cardKey: string | null;
  timerSeconds?: number | null;
  /** CSS custom properties driving the face colors; see `.flip-card` in index.css. */
  colors: { card1: string; card2: string; card3: string; accent: string; ink: string };
  /** Rendered inside the card when `cardKey` is set: badge, text, optional photo. */
  children: ReactNode;
  /** Rendered when there's no card yet. */
  placeholder: ReactNode;
  onReveal?: () => void;
}

/** A tarot-styled card that flips to reveal its content, with a Start button for timed cards. */
export function FlipCard({ cardKey, timerSeconds, colors, children, placeholder, onReveal }: FlipCardProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const lastKey = useRef<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const box = useElementSize(wrapperRef);
  const fitted = fitCard(box);

  useEffect(() => {
    if (cardKey && cardKey !== lastKey.current) {
      onReveal?.();
      setPhase('idle');
    }
    lastKey.current = cardKey;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardKey]);

  useWakeLock(phase === 'ready' || phase === 'running');

  return (
    <div
      ref={wrapperRef}
      className="mx-auto flex min-h-0 w-full max-w-xs flex-1 flex-col items-center justify-center"
      style={{ perspective: 1200 }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={cardKey ?? 'back'}
          initial={{ rotateY: 90, opacity: 0.4 }}
          animate={{ rotateY: 0, opacity: 1 }}
          exit={{ rotateY: -90, opacity: 0.4 }}
          transition={{ duration: 0.35, ease: 'easeInOut' }}
          className="flip-card relative flex flex-col items-center justify-center gap-1.5 overflow-hidden rounded-[24px] p-4 text-center shadow-[0_20px_50px_rgb(0_0_0/0.55)]"
          style={
            {
              width: fitted.width || undefined,
              height: fitted.height || undefined,
              background: `linear-gradient(155deg, ${colors.card1} 0%, ${colors.card2} 60%, ${colors.card3} 100%)`,
              border: `2px solid ${colors.accent}`,
              color: colors.ink,
              '--flip-card-accent': colors.accent,
            } as React.CSSProperties
          }
        >
          {cardKey && (
            <motion.div
              key={`glow-${cardKey}`}
              className="pointer-events-none absolute -inset-4 rounded-[28px]"
              initial={{ opacity: 0.9 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 1.1, ease: 'easeOut' }}
              style={{ boxShadow: `0 0 60px 20px color-mix(in oklab, ${colors.accent} 50%, transparent)` }}
              aria-hidden
            />
          )}
          <div
            className="pointer-events-none absolute inset-3 rounded-[18px]"
            style={{ boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${colors.accent} 50%, transparent)` }}
            aria-hidden
          />
          {cardKey ? (
            <>
              {children}
              {timerSeconds != null &&
                (phase === 'idle' ? (
                  <button
                    type="button"
                    onClick={() => setPhase('ready')}
                    className="flip-card__timer shrink-0 rounded-full px-4 py-1 font-bold hover:brightness-110"
                    style={{ background: `color-mix(in oklab, ${colors.accent} 25%, transparent)`, color: colors.accent }}
                  >
                    Start
                  </button>
                ) : (
                  <TimerRun seconds={timerSeconds} phase={phase} onReady={() => setPhase('running')} />
                ))}
            </>
          ) : (
            placeholder
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

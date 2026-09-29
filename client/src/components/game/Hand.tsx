import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef } from 'react';
import { describeCard, type Card } from '@shared';
import { DRAW_PILE, HAND, centerOf, registerElement } from '../../game/domRegistry';
import { useElementSize } from '../../hooks/useElementSize';
import { cn } from '../../utils/cn';
import { CardFace } from '../cards/Card';

/** Headroom above the cards (for lifting), and the most the fan's edges dip. */
const TOP_ROOM = 14;
const MAX_SAG = 14;

const COLOR_ORDER: Record<string, number> = { red: 0, yellow: 1, green: 2, blue: 3, wild: 4 };
const VALUE_ORDER = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2', 'wild', 'wild4'];

/** Sorted by color then value so it's easy to scan, like tidying a real hand. */
export function sortHand(cards: Card[]): Card[] {
  return [...cards].sort(
    (a, b) =>
      COLOR_ORDER[a.color] - COLOR_ORDER[b.color] || VALUE_ORDER.indexOf(a.value) - VALUE_ORDER.indexOf(b.value),
  );
}

interface HandProps {
  cards: Card[];
  playable: Set<string>;
  myTurn: boolean;
  selectedId: string | null;
  onCardClick: (card: Card, element: HTMLElement) => void;
  onCardDoubleClick: (card: Card, element: HTMLElement) => void;
  cardWidth: number;
  compact: boolean;
}

export function Hand({ cards, playable, myTurn, selectedId, onCardClick, onCardDoubleClick, cardWidth, compact }: HandProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { width } = useElementSize(containerRef);
  const sorted = useMemo(() => sortHand(cards), [cards]);
  const known = useRef<Set<string>>(new Set());

  const cardW = cardWidth;
  const cardH = (cardW * 7) / 5;
  const n = sorted.length;
  const usable = Math.max(cardW, width - 24);
  const step = n > 1 ? Math.min(cardW * (compact ? 0.62 : 0.68), (usable - cardW) / (n - 1)) : 0;
  const total = step * Math.max(0, n - 1) + cardW;
  const startX = (width - total) / 2;
  const angleStep = n > 1 ? Math.min(3, 26 / (n - 1)) : 0;

  // Cards we haven't seen before fly in from the draw pile (dealing and drawing).
  const containerRect = containerRef.current?.getBoundingClientRect();
  const pile = centerOf(DRAW_PILE);
  const newIds = sorted.filter((c) => !known.current.has(c.id)).map((c) => c.id);
  const dealing = newIds.length > 3;
  useEffect(() => {
    if (width > 0) known.current = new Set(sorted.map((c) => c.id));
  });

  return (
    <div
      ref={(el) => {
        containerRef.current = el;
        registerElement(HAND)(el);
      }}
      className="relative w-full"
      style={{ height: TOP_ROOM + cardH + MAX_SAG + cardW * 0.12 }}
      role="group"
      aria-label={`Your hand, ${n} cards`}
      data-overlap-ok
    >
      <div className={cn('hand-spotlight', myTurn && 'is-active')} aria-hidden />
      <AnimatePresence initial={false}>
        {width > 0 &&
          sorted.map((card, i) => {
            const offset = i - (n - 1) / 2;
            const x = startX + i * step;
            const isPlayable = myTurn && playable.has(card.id);
            const selected = selectedId === card.id;
            const half = Math.max(1, (n - 1) / 2);
            const sag = Math.min(MAX_SAG, n * 1.6) * (offset / half) ** 2;
            const y = TOP_ROOM + sag - (selected ? 26 : isPlayable ? 10 : 0);
            const isNew = newIds.includes(card.id);
            const fromPile =
              isNew && pile && containerRect
                ? { x: pile.x - containerRect.left - cardW / 2, y: pile.y - containerRect.top - cardH / 2 }
                : null;
            return (
              <motion.button
                key={card.id}
                type="button"
                data-card-id={card.id}
                aria-label={`${describeCard(card)}${isPlayable ? ', playable' : ''}${selected ? ', selected. Press again to play' : ''}`}
                aria-pressed={selected}
                className={cn(
                  'absolute left-0 top-0 rounded-[12px] outline-none',
                  myTurn && !isPlayable && 'cursor-not-allowed',
                )}
                style={{ width: cardW, zIndex: selected ? 60 : i + 1 }}
                initial={fromPile ? { x: fromPile.x, y: fromPile.y, rotate: 0, opacity: 0, scale: 0.9 } : false}
                animate={{ x, y, rotate: offset * angleStep, opacity: 1, scale: selected ? 1.06 : 1 }}
                exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.12 } }}
                whileHover={{ y: y - (isPlayable || !myTurn ? 14 : 4) }}
                transition={{
                  type: 'spring',
                  stiffness: 420,
                  damping: 32,
                  delay: fromPile && dealing ? newIds.indexOf(card.id) * 0.06 : 0,
                }}
                onClick={(e) => onCardClick(card, e.currentTarget)}
                onDoubleClick={(e) => onCardDoubleClick(card, e.currentTarget)}
              >
                <CardFace
                  card={card}
                  className={cn(
                    'w-full transition-[filter,box-shadow] duration-200',
                    myTurn && !isPlayable && 'is-dim',
                    isPlayable && 'shadow-[0_0_0_3px_rgb(255_255_255/0.85),0_10px_24px_rgb(8_4_24/0.6)]',
                    selected && '!shadow-[0_0_0_4px_var(--color-card-yellow),0_16px_34px_rgb(8_4_24/0.7)] is-selected',
                  )}
                />
                {selected && (
                  <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-card-yellow px-2.5 py-0.5 text-xs font-extrabold text-night shadow">
                    Tap to play
                  </span>
                )}
              </motion.button>
            );
          })}
      </AnimatePresence>
      {n === 0 && (
        <p className="absolute inset-0 grid place-items-center text-sm text-muted">No cards in your hand.</p>
      )}
    </div>
  );
}

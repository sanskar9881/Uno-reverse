import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import type { Card, ClientState } from '@shared';
import { DISCARD_PILE, DRAW_PILE, centerOf, peekPlayOrigin, registerElement, seatKey } from '../../game/domRegistry';
import { COLOR_HEX } from '../../utils/format';
import { cn } from '../../utils/cn';
import { CardBack, CardFace } from '../cards/Card';

/** Stable pseudo-random tilt per card so the pile looks tossed and older cards peek out. */
function tiltOf(id: string): { rotate: number; x: number; y: number } {
  let h = 7;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const unit = (shift: number) => (Math.abs(h >> shift) % 1000) / 1000; // 0..1
  const sign = (shift: number) => ((h >> shift) & 1 ? 1 : -1);
  return {
    rotate: sign(1) * (6 + unit(2) * 14),
    x: sign(4) * (3 + unit(5) * 9),
    y: (unit(8) * 2 - 1) * 6,
  };
}

interface TableCenterProps {
  state: ClientState;
  canDraw: boolean;
  onDraw: () => void;
  cardWidth: number;
}

export function TableCenter({ state, canDraw, onDraw, cardWidth }: TableCenterProps) {
  const game = state.game!;
  const width = cardWidth;
  const top = game.topCard;
  const under = game.recentDiscards.slice(0, -1).slice(-3);
  const color = game.currentColor;

  return (
    <div className="relative flex items-center justify-center gap-6 sm:gap-10">
      {/* Direction of play */}
      <motion.svg
        viewBox="0 0 200 120"
        className="pointer-events-none absolute -inset-x-10 -inset-y-8 h-[calc(100%+4rem)] w-[calc(100%+5rem)] text-white/15"
        animate={{ scaleX: game.direction }}
        transition={{ type: 'spring', stiffness: 120, damping: 14 }}
        aria-hidden
      >
        <defs>
          <marker id="arrowhead" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
            <path d="M0 0 10 5 0 10z" fill="currentColor" />
          </marker>
        </defs>
        <path d="M30 28 A 80 46 0 0 1 170 28" fill="none" stroke="currentColor" strokeWidth="2.5" markerEnd="url(#arrowhead)" />
        <path d="M170 92 A 80 46 0 0 1 30 92" fill="none" stroke="currentColor" strokeWidth="2.5" markerEnd="url(#arrowhead)" />
      </motion.svg>

      <DrawPile count={game.drawPileCount} width={width} canDraw={canDraw} onDraw={onDraw} />

      <div className="relative flex flex-col items-center gap-2">
        <div
          ref={registerElement(DISCARD_PILE)}
          data-testid="discard-pile"
          className="relative grid place-items-center"
          style={{ width: width * 1.25, height: width * 1.6 }}
        >
          <motion.div
            className="absolute inset-[-14%] rounded-full blur-2xl"
            animate={{ backgroundColor: COLOR_HEX[color], opacity: 0.45 }}
            transition={{ duration: 0.4 }}
            aria-hidden
          />
          {under.map((card) => {
            const t = tiltOf(card.id);
            return (
              <CardFace
                key={card.id}
                card={card}
                className="absolute brightness-[0.8]"
                style={{ width, transform: `translate(${t.x}px, ${t.y}px) rotate(${t.rotate}deg)` }}
              />
            );
          })}
          <AnimatePresence initial={false}>
            <TopDiscard key={top.id} card={top} width={width} state={state} />
          </AnimatePresence>
        </div>
        <ColorPill color={color} highlight={top.color === 'wild'} />
      </div>
    </div>
  );
}

function TopDiscard({ card, width, state }: { card: Card; width: number; state: ClientState }) {
  const t = tiltOf(card.id);
  // Where did this card come from: your hand, an opponent's seat, or the deck (round start)?
  const [from] = useState(() => {
    const here = centerOf(DISCARD_PILE);
    if (!here) return null;
    const played = state.events.find((e) => e.type === 'cardPlayed' && e.card.id === card.id);
    let origin: { x: number; y: number } | null = null;
    if (played?.type === 'cardPlayed') {
      origin = played.playerId === state.selfId ? peekPlayOrigin(card.id) : centerOf(seatKey(played.playerId));
    } else if (state.events.some((e) => e.type === 'gameStarted')) {
      origin = centerOf(DRAW_PILE);
    }
    return origin ? { x: origin.x - here.x, y: origin.y - here.y } : null;
  });

  return (
    <motion.div
      className="absolute"
      style={{ width }}
      initial={
        from
          ? { x: from.x, y: from.y, rotate: t.rotate - 40, scale: 0.9, opacity: 1 }
          : { x: t.x, y: t.y, rotate: t.rotate, scale: 1.12, opacity: 0 }
      }
      animate={{ x: t.x, y: t.y, rotate: t.rotate, scale: 1, opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2, delay: 0.35 } }}
      transition={{ duration: from ? 0.42 : 0.25, ease: [0.25, 0.8, 0.35, 1] }}
    >
      <CardFace card={card} className="w-full" />
    </motion.div>
  );
}

function DrawPile({ count, width, canDraw, onDraw }: { count: number; width: number; canDraw: boolean; onDraw: () => void }) {
  const layers = Math.min(4, Math.max(1, Math.ceil(count / 20)));
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        ref={registerElement(DRAW_PILE)}
        onClick={onDraw}
        disabled={!canDraw}
        aria-label={canDraw ? `Draw a card (${count} left)` : `Draw pile, ${count} cards`}
        className={cn(
          'group relative rounded-[14px] transition-transform disabled:cursor-default',
          canDraw && 'hover:-translate-y-1',
        )}
        style={{ width, height: (width * 7) / 5 }}
      >
        {Array.from({ length: layers }, (_, i) => (
          <CardBack
            key={i}
            className="absolute left-0 w-full"
            style={{ top: -i * 3, left: -i * 1.5, filter: i === layers - 1 ? undefined : 'brightness(0.75)' }}
          />
        ))}
        {canDraw && (
          <span className="absolute inset-[-6px] animate-pulse rounded-[18px] ring-4 ring-card-yellow/70" aria-hidden />
        )}
      </button>
      <span className="text-xs font-semibold text-muted tabular-nums">{count} left</span>
    </div>
  );
}

function ColorPill({ color, highlight }: { color: keyof typeof COLOR_HEX; highlight: boolean }) {
  return (
    <motion.span
      key={color}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn(
        'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold capitalize',
        highlight ? 'bg-white/15 text-ink ring-1 ring-white/30' : 'bg-black/20 text-muted',
      )}
    >
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLOR_HEX[color] }} aria-hidden />
      {color}
    </motion.span>
  );
}

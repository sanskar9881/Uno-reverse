import { motion } from 'motion/react';
import type { PublicPlayer } from '@shared';
import { registerElement, seatKey } from '../../game/domRegistry';
import { cn } from '../../utils/cn';
import { CardBack } from '../cards/Card';
import { Avatar } from '../ui/Avatar';
import { TurnRing } from './TurnRing';

interface SeatProps {
  player: PublicPlayer;
  cardCount: number;
  isCurrent: boolean;
  declaredUno: boolean;
  catchable: boolean;
  onCatch?: () => void;
  turnEndsAt: number;
  turnDurationMs: number;
  compact?: boolean;
}

/** Footprint used to lay seats out around the table (desktop). */
export const SEAT_BOX = { width: 124, height: 128 };

export function OpponentSeat({
  player,
  cardCount,
  isCurrent,
  declaredUno,
  catchable,
  onCatch,
  turnEndsAt,
  turnDurationMs,
  compact,
}: SeatProps) {
  const avatarSize = compact ? 40 : 48;
  const ringSize = avatarSize + 12;
  const fan = Math.min(cardCount, compact ? 4 : 6);

  return (
    <div
      ref={registerElement(seatKey(player.id))}
      className={cn(
        'relative flex flex-col items-center gap-1 rounded-2xl px-2 py-1.5 transition-colors',
        compact ? 'w-[84px]' : 'w-[124px]',
        isCurrent && 'bg-white/[0.07] ring-1 ring-card-yellow/50',
      )}
      aria-label={`${player.nickname}, ${cardCount} cards${isCurrent ? ', playing now' : ''}${player.connected ? '' : ', offline'}`}
    >
      <div className="relative grid place-items-center" style={{ width: ringSize, height: ringSize }}>
        {isCurrent && turnEndsAt > 0 && <TurnRing endsAt={turnEndsAt} durationMs={turnDurationMs} size={ringSize} />}
        <Avatar index={player.avatar} size={avatarSize} dim={!player.connected} />
        {player.isHost && (
          <span className="absolute -right-0.5 -top-1 text-base" title="Host" aria-label="Host">
            👑
          </span>
        )}
        {declaredUno && (
          <motion.span
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: -8 }}
            className="absolute -bottom-1 -left-2 rounded-lg bg-card-yellow px-1.5 font-display text-xs leading-5 text-night shadow"
          >
            UNO!
          </motion.span>
        )}
      </div>

      <div className="flex max-w-full items-center gap-1">
        <span className={cn('truncate font-bold', compact ? 'text-xs' : 'text-sm', !player.connected && 'text-muted')}>
          {player.nickname}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <div className="relative h-[26px]" style={{ width: 18 + Math.max(0, fan - 1) * 7 }} aria-hidden>
          {Array.from({ length: fan }, (_, i) => (
            <CardBack
              key={i}
              className="absolute top-0 w-[18px] !shadow-none"
              style={{ left: i * 7, transform: `rotate(${(i - (fan - 1) / 2) * 6}deg)` }}
            />
          ))}
        </div>
        <span className={cn('font-display tabular-nums', compact ? 'text-sm' : 'text-base', cardCount === 1 && 'text-card-yellow')}>
          {cardCount}
        </span>
      </div>

      {!player.connected && <span className="text-[11px] font-semibold text-card-red">Offline</span>}

      {catchable && onCatch && (
        <div className="absolute -bottom-3 left-1/2 z-10 -translate-x-1/2">
          <button
            type="button"
            onClick={onCatch}
            aria-label={`Catch ${player.nickname}: they forgot to call UNO`}
            className="animate-wiggle whitespace-nowrap rounded-xl bg-card-red px-3 py-1 text-sm font-extrabold text-white shadow-[0_4px_0_#a52a30]"
          >
            Catch!
          </button>
        </div>
      )}
    </div>
  );
}

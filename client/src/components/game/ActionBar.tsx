import { useCountdown } from '../../hooks/useCountdown';
import { cn } from '../../utils/cn';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { TurnRing } from './TurnRing';

interface ActionBarProps {
  me: { avatar: number; nickname: string; score: number; cards: number };
  myTurn: boolean;
  canDraw: boolean;
  canPass: boolean;
  canUno: boolean;
  declared: boolean;
  busy: boolean;
  status: string;
  turnEndsAt: number;
  turnDurationMs: number;
  onDraw: () => void;
  onPass: () => void;
  onUno: () => void;
  compact: boolean;
}

export function ActionBar(props: ActionBarProps) {
  const { me, myTurn, canDraw, canPass, canUno, declared, busy, status, turnEndsAt, turnDurationMs, compact } = props;
  const left = useCountdown(myTurn ? turnEndsAt : 0);
  const fraction = turnDurationMs > 0 ? Math.min(1, left / turnDurationMs) : 0;
  const seconds = Math.ceil(left / 1000);
  const ring = compact ? 40 : 46;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-3">
      <div className="flex items-center gap-3">
        <div className="relative grid shrink-0 place-items-center" style={{ width: ring, height: ring }}>
          {myTurn && turnEndsAt > 0 && <TurnRing endsAt={turnEndsAt} durationMs={turnDurationMs} size={ring} />}
          <Avatar index={me.avatar} size={ring - 10} />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={cn('truncate font-bold leading-tight', compact ? 'text-sm' : 'text-base', myTurn ? 'text-card-yellow' : 'text-ink')}
            aria-live="polite"
          >
            {status}
          </p>
          <p className="truncate text-xs text-muted">
            {me.nickname} (you), {me.cards} {me.cards === 1 ? 'card' : 'cards'}, {me.score} points
          </p>
        </div>
        {myTurn && turnEndsAt > 0 && (
          <span className={cn('shrink-0 font-display text-lg tabular-nums', seconds <= 5 ? 'text-card-red' : 'text-ink')}>
            {seconds}s
          </span>
        )}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-veil/10" aria-hidden>
        <div
          className={cn('h-full rounded-full', fraction > 0.5 ? 'bg-card-green' : fraction > 0.2 ? 'bg-card-yellow' : 'bg-card-red')}
          style={{ width: `${myTurn ? fraction * 100 : 0}%`, transition: 'width 100ms linear' }}
        />
      </div>
      <div className="flex items-center justify-center gap-2 sm:gap-3">
        <Button variant="secondary" size={compact ? 'md' : 'lg'} onClick={props.onDraw} disabled={!canDraw || busy} title="Shortcut: D">
          Draw card
        </Button>
        <Button variant="secondary" size={compact ? 'md' : 'lg'} onClick={props.onPass} disabled={!canPass || busy} title="Shortcut: P">
          Pass
        </Button>
        <button
          type="button"
          onClick={props.onUno}
          disabled={!canUno}
          title="Shortcut: U"
          aria-label={declared ? 'UNO called' : 'Call UNO'}
          className={cn(
            'relative grid place-items-center rounded-full font-display text-night transition-transform',
            compact ? 'h-12 w-12 text-sm' : 'h-14 w-14 text-base',
            canUno
              ? 'animate-pulse-soft bg-card-yellow shadow-[0_5px_0_var(--color-shadow-yellow)]'
              : declared
                ? 'bg-card-green text-white'
                : 'bg-veil/10 text-muted/60',
          )}
        >
          UNO!
        </button>
      </div>
    </div>
  );
}

import { motion } from 'motion/react';
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  TARGET_SCORE_OPTIONS,
  TURN_SECONDS_OPTIONS,
  type ClientState,
  type RoomSettings,
} from '@shared';
import { kickPlayer, startGame, updateSettings } from '../../game/actions';
import { useGameStore } from '../../store/gameStore';
import { toast } from '../../store/toastStore';
import { copyText } from '../../utils/clipboard';
import { cn } from '../../utils/cn';
import { inviteMessage, roomLink } from '../../utils/format';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Logo } from '../ui/Logo';
import { SoundToggle } from '../ui/SoundToggle';

const TILE_COLORS = ['bg-card-red', 'bg-card-yellow', 'bg-card-green', 'bg-card-blue', 'bg-card-red', 'bg-card-yellow'];

function RoomCode({ code }: { code: string }) {
  return (
    <div className="flex justify-center gap-1.5 sm:gap-2" aria-label={`Room code ${code.split('').join(' ')}`}>
      {code.split('').map((char, i) => (
        <motion.span
          key={`${char}-${i}`}
          initial={{ y: -30, opacity: 0, rotate: -10 }}
          animate={{ y: 0, opacity: 1, rotate: (i - 2.5) * 2 }}
          transition={{ type: 'spring', stiffness: 300, damping: 18, delay: i * 0.05 }}
          className={cn(
            'relative grid aspect-[5/7] w-11 place-items-center rounded-xl font-display text-2xl text-white sm:w-14 sm:text-3xl',
            'shadow-[inset_0_1px_0_rgb(255_255_255/0.4),0_6px_14px_rgb(8_4_24/0.5)]',
            TILE_COLORS[i],
            i % 2 === 1 && 'text-night',
          )}
          aria-hidden
        >
          <span className="absolute inset-[3px] rounded-[9px] border border-white/50" />
          {char}
        </motion.span>
      ))}
    </div>
  );
}

function Segmented<T extends number>({
  label,
  options,
  value,
  onChange,
  format,
  disabled,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  format: (v: T) => string;
  disabled: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-muted">{label}</span>
      <div className="grid grid-flow-col gap-1 rounded-2xl bg-night p-1 ring-1 ring-line">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={value === option}
            disabled={disabled}
            onClick={() => value !== option && onChange(option)}
            className={cn(
              'h-9 rounded-xl px-2 text-sm font-bold transition-colors',
              value === option ? 'bg-card-yellow text-night' : 'text-muted enabled:hover:bg-white/10 enabled:hover:text-ink',
              disabled && value !== option && 'opacity-50',
            )}
          >
            {format(option)}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Lobby({ state, onLeave }: { state: ClientState; onLeave: () => void }) {
  const busy = useGameStore((s) => s.busy);
  const { room, selfId } = state;
  const isHost = room.hostId === selfId;
  const host = room.players.find((p) => p.id === room.hostId);
  const connected = room.players.filter((p) => p.connected).length;
  const canStart = connected >= MIN_PLAYERS;
  const canShare = typeof navigator.share === 'function';

  const copy = async (text: string, what: string) => {
    toast((await copyText(text)) ? `${what} copied` : `Couldn't copy. ${text}`, 'good', '📋');
  };
  const share = async () => {
    try {
      await navigator.share({ title: 'UNO Party', text: inviteMessage(room.code), url: roomLink(room.code) });
    } catch {
      // The user closed the share sheet.
    }
  };
  const setSetting = (patch: Partial<RoomSettings>) => void updateSettings(patch);

  return (
    <main className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 pb-8 pt-3">
      <header className="flex items-center justify-between">
        <Logo size="sm" animate={false} />
        <div className="flex items-center gap-1">
          <SoundToggle />
          <Button variant="ghost" size="sm" onClick={onLeave}>
            Leave room
          </Button>
        </div>
      </header>

      <section className="mt-4 flex flex-col items-center gap-3 text-center">
        <p className="font-semibold text-muted">Room code</p>
        <RoomCode code={room.code} />
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => copy(room.code, 'Room code')}>
            Copy code
          </Button>
          <Button variant="secondary" size="sm" onClick={() => copy(roomLink(room.code), 'Invite link')}>
            Copy invite link
          </Button>
          {canShare && (
            <Button variant="secondary" size="sm" onClick={share}>
              Share
            </Button>
          )}
        </div>
        <p className="max-w-sm text-sm text-muted/80">Send the code or link to your friends. They can join from any phone or computer.</p>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-xl">Players</h2>
          <span className="text-sm font-semibold text-muted tabular-nums">
            {room.players.length} of {MAX_PLAYERS}
          </span>
        </div>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: MAX_PLAYERS }, (_, i) => {
            const p = room.players[i];
            if (!p) {
              return (
                <li
                  key={`empty-${i}`}
                  className="grid h-[92px] place-items-center rounded-2xl border-2 border-dashed border-line text-sm text-muted/50"
                >
                  Open seat
                </li>
              );
            }
            return (
              <motion.li
                key={p.id}
                layout
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={cn(
                  'relative flex h-[92px] flex-col items-center justify-center gap-1 rounded-2xl bg-white/5 px-2 ring-1 ring-line',
                  p.id === selfId && 'ring-2 ring-card-yellow/60',
                )}
              >
                <div className="relative">
                  <Avatar index={p.avatar} size={46} dim={!p.connected} />
                  {p.isHost && (
                    <span className="absolute -right-2 -top-2 text-lg" title="Host" aria-label="Host">
                      👑
                    </span>
                  )}
                </div>
                <span className="max-w-full truncate text-sm font-bold">
                  {p.nickname}
                  {p.id === selfId && <span className="font-semibold text-muted"> (you)</span>}
                </span>
                {!p.connected && <span className="text-xs font-semibold text-card-red">Reconnecting…</span>}
                {isHost && p.id !== selfId && (
                  <button
                    type="button"
                    onClick={() => void kickPlayer(p.id)}
                    className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-card-red/20 hover:text-card-red"
                    aria-label={`Remove ${p.nickname} from the room`}
                    title={`Remove ${p.nickname}`}
                  >
                    ✕
                  </button>
                )}
              </motion.li>
            );
          })}
        </ul>
      </section>

      <section className="mt-6 grid gap-4 rounded-3xl bg-night-2/70 p-5 ring-1 ring-line sm:grid-cols-2">
        <Segmented
          label="Time per turn"
          options={TURN_SECONDS_OPTIONS}
          value={room.settings.turnSeconds}
          onChange={(turnSeconds) => setSetting({ turnSeconds })}
          format={(v) => `${v}s`}
          disabled={!isHost || busy}
        />
        <Segmented
          label="Match ends at"
          options={TARGET_SCORE_OPTIONS}
          value={room.settings.targetScore}
          onChange={(targetScore) => setSetting({ targetScore })}
          format={(v) => (v === 0 ? 'Never' : `${v} pts`)}
          disabled={!isHost || busy}
        />
        {!isHost && <p className="text-sm text-muted sm:col-span-2">Only the host can change these.</p>}
      </section>

      <section className="mt-6 flex flex-col items-center gap-2">
        {isHost ? (
          <>
            <Button size="lg" className="w-full max-w-sm" onClick={() => void startGame()} disabled={!canStart || busy}>
              Start Game
            </Button>
            <p className="text-sm text-muted">
              {canStart ? `Everyone gets 7 cards. ${connected} players ready.` : 'You need at least 2 players to start.'}
            </p>
          </>
        ) : (
          <p className="flex items-center gap-2 rounded-2xl bg-white/5 px-5 py-3 font-semibold text-muted">
            <span className="h-2 w-2 animate-pulse rounded-full bg-card-yellow" aria-hidden />
            Waiting for {host?.nickname ?? 'the host'} to start the game…
          </p>
        )}
      </section>
    </main>
  );
}

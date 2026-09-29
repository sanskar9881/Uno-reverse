import { motion } from 'motion/react';
import {
  CUSTOM_RULE_MAX_LENGTH,
  MAX_PLAYERS_BY_GAME,
  MIN_PLAYERS,
  TARGET_SCORE_OPTIONS,
  TURN_SECONDS_OPTIONS,
  type BottlePartySettings,
  type BottlePromptPack,
  type ClientState,
  type HouseRules,
  type RoomSettingsPatch,
} from '@shared';
import { kickPlayer, startGame, updateBottleSettings, updateSettings } from '../../game/actions';
import { useGameStore } from '../../store/gameStore';
import { toast } from '../../store/toastStore';
import { copyText } from '../../utils/clipboard';
import { cn } from '../../utils/cn';
import { inviteMessage, roomLink } from '../../utils/format';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Logo } from '../ui/Logo';
import { SegmentedControl } from '../ui/SegmentedControl';
import { SoundToggle } from '../ui/SoundToggle';
import { ThemeToggle } from '../ui/ThemeToggle';
import { HouseRuleChips } from '../game/HouseRuleChips';

const HOUSE_RULE_OPTIONS: { key: keyof Omit<HouseRules, 'customRuleText'>; label: string; hint: string }[] = [
  { key: 'stacking', label: 'Stacking', hint: 'A Draw Two or Wild +4 can be answered with another of its kind.' },
  { key: 'drawUntilPlayable', label: 'Draw until you can play', hint: "Keep drawing instead of just one card." },
  { key: 'mustPlayDrawn', label: 'Must play a drawn card', hint: "If it's playable, you have to play it." },
  { key: 'sevenZero', label: '7-0', hint: 'A 7 swaps hands with someone you choose; a 0 passes every hand along.' },
  { key: 'jumpIn', label: 'Jump-in', hint: 'Play an exact match out of turn.' },
  { key: 'modernDeck', label: 'Modern 112-card deck', hint: 'Adds Wild Shuffle Hands and three Wild Customizable cards.' },
];

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
  const setSetting = (patch: RoomSettingsPatch) => void updateSettings(patch);
  const setBottleSetting = (patch: Partial<BottlePartySettings>) => void updateBottleSettings(patch);
  const maxPlayers = MAX_PLAYERS_BY_GAME[room.gameType];

  return (
    <main className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 pb-8 pt-3">
      <header className="flex items-center justify-between">
        <Logo size="sm" animate={false} />
        <div className="flex items-center gap-1">
          <SoundToggle />
          <ThemeToggle />
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
            {room.players.length} of {maxPlayers}
          </span>
        </div>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: maxPlayers }, (_, i) => {
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
                  'relative flex h-[92px] flex-col items-center justify-center gap-1 rounded-2xl bg-veil/5 px-2 ring-1 ring-line',
                  p.id === selfId && 'ring-2 ring-card-yellow/60',
                )}
              >
                <div className="relative" data-overlap-ok>
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

      {room.gameType === 'uno' ? (
        <section className="mt-6 grid gap-4 rounded-3xl bg-night-2/70 p-5 ring-1 ring-line sm:grid-cols-2">
          <SegmentedControl
            label="Time per turn"
            options={TURN_SECONDS_OPTIONS}
            value={room.settings.turnSeconds}
            onChange={(turnSeconds) => setSetting({ turnSeconds })}
            format={(v) => `${v}s`}
            disabled={!isHost || busy}
          />
          <SegmentedControl
            label="Match ends at"
            options={TARGET_SCORE_OPTIONS}
            value={room.settings.targetScore}
            onChange={(targetScore) => setSetting({ targetScore })}
            format={(v) => (v === 0 ? 'Never' : `${v} pts`)}
            disabled={!isHost || busy}
          />
          {!isHost && <p className="text-sm text-muted sm:col-span-2">Only the host can change these.</p>}

          <div className="sm:col-span-2">
            <h3 className="mb-2 text-sm font-semibold text-muted">House rules (official rules by default)</h3>
            <div className="flex flex-col gap-2">
              {HOUSE_RULE_OPTIONS.map(({ key, label, hint }) => (
                <label key={key} className="flex items-start justify-between gap-3">
                  <span>
                    <span className="block text-sm font-semibold text-ink">{label}</span>
                    <span className="block text-xs text-muted">{hint}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={room.settings.houseRules[key]}
                    onChange={(e) => setSetting({ houseRules: { [key]: e.target.checked } })}
                    disabled={!isHost || busy}
                    className="mt-1 h-5 w-5 shrink-0 accent-card-yellow"
                  />
                </label>
              ))}
            </div>
            {room.settings.houseRules.modernDeck && (
              <div className="mt-3">
                <label htmlFor="custom-rule" className="mb-1.5 block text-sm font-semibold text-muted">
                  Wild Customizable rule (shown when one is played)
                </label>
                <input
                  id="custom-rule"
                  value={room.settings.houseRules.customRuleText}
                  onChange={(e) => setSetting({ houseRules: { customRuleText: e.target.value.slice(0, CUSTOM_RULE_MAX_LENGTH) } })}
                  disabled={!isHost || busy}
                  placeholder="e.g. Everyone drink!"
                  className="h-11 w-full rounded-xl bg-night px-3.5 text-ink ring-1 ring-line placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-card-yellow"
                />
              </div>
            )}
            <HouseRuleChips houseRules={room.settings.houseRules} className="mt-3" />
          </div>
        </section>
      ) : room.gameType === 'bottle' ? (
        <section className="mt-6 flex flex-col gap-4 rounded-3xl bg-night-2/70 p-5 ring-1 ring-line">
          <SegmentedControl
            label="Prompt pack"
            options={['off', 'party', 'flirty'] as const satisfies readonly BottlePromptPack[]}
            value={room.partySettings.pack}
            onChange={(pack) => setBottleSetting({ pack })}
            format={(v) => (v === 'off' ? 'Off' : v === 'party' ? 'Party' : 'Flirty 18+')}
            disabled={!isHost || busy}
          />
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-muted">Who spins next: whoever the bottle points to</span>
            <input
              type="checkbox"
              checked={!room.partySettings.clockwiseTurns}
              onChange={(e) => setBottleSetting({ clockwiseTurns: !e.target.checked })}
              disabled={!isHost || busy}
              className="h-5 w-5 accent-bottle-amber"
            />
          </label>
          {!isHost && <p className="text-sm text-muted">Only the host can change these.</p>}
        </section>
      ) : null}

      <section className="mt-6 flex flex-col items-center gap-2">
        {isHost ? (
          <>
            <Button size="lg" className="w-full max-w-sm" onClick={() => void startGame()} disabled={!canStart || busy}>
              Start Game
            </Button>
            <p className="text-sm text-muted">
              {canStart
                ? room.gameType === 'uno'
                  ? `Everyone gets 7 cards. ${connected} players ready.`
                  : `${connected} players ready.`
                : 'You need at least 2 players to start.'}
            </p>
          </>
        ) : (
          <p className="flex items-center gap-2 rounded-2xl bg-veil/5 px-5 py-3 font-semibold text-muted">
            <span className="h-2 w-2 animate-pulse rounded-full bg-card-yellow" aria-hidden />
            Waiting for {host?.nickname ?? 'the host'} to start the game…
          </p>
        )}
      </section>
    </main>
  );
}

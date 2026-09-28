import { AVATARS, type BottleView, type ClientState } from '@shared';
import { useEffect, useRef, useState } from 'react';
import { spinBottle } from '../../game/actions';
import { useOnlineBottleRotation } from '../../game/bottle/useOnlineBottleRotation';
import type { BottlePlayer } from '../../game/bottle/storage';
import { playSound } from '../../game/sounds';
import { serverNow, useGameStore } from '../../store/gameStore';
import { toast } from '../../store/toastStore';
import { copyText } from '../../utils/clipboard';
import { SoundToggle } from '../ui/SoundToggle';
import { BottleSvg } from './BottleSvg';
import { BottleResultSheet } from './ResultSheet';

export function OnlineBottleBoard({ state, onLeave }: { state: ClientState; onLeave: () => void }) {
  // Rendered only when state.room.gameType === 'bottle'.
  const party = state.party as BottleView;
  const busy = useGameStore((s) => s.busy);
  const byId = new Map(state.room.players.map((p) => [p.id, p]));
  const turnOrder = party.turnOrder.filter((id) => byId.has(id));
  const players: BottlePlayer[] = turnOrder.map((id) => {
    const p = byId.get(id)!;
    return { name: p.nickname, emoji: AVATARS[p.avatar] ?? AVATARS[0] };
  });

  const { rotation, spinning } = useOnlineBottleRotation(party.spin, serverNow);

  // Remember the last spin's target so the sheet and highlight ring can show it after landing.
  const lastSpin = useRef(party.spin);
  if (party.spin) lastSpin.current = party.spin;
  const targetId = party.spin ? party.spin.targetId : lastSpin.current?.targetId ?? null;
  const targetIndex = targetId ? turnOrder.indexOf(targetId) : null;
  const spinnerIndex = Math.max(0, turnOrder.indexOf(party.spinnerId));

  const [resultOpen, setResultOpen] = useState(false);
  const seenTurnId = useRef(party.turnId);
  useEffect(() => {
    if (party.turnId !== seenTurnId.current && !party.spin) {
      seenTurnId.current = party.turnId;
      setResultOpen(true);
      playSound('bottleLand');
      navigator.vibrate?.(40);
    }
    seenTurnId.current = party.turnId;
  }, [party.turnId, party.spin]);

  const isSpinner = state.selfId === party.spinnerId;

  const doSpin = () => {
    if (!isSpinner || spinning || busy) return;
    void spinBottle();
  };

  const target = targetId ? byId.get(targetId) : undefined;
  const nextSpinner = byId.get(party.spinnerId);

  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col px-4 pb-10 pt-2">
      <header className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={async () => toast((await copyText(state.room.code)) ? 'Room code copied' : `Room code: ${state.room.code}`, 'good', '📋')}
          className="rounded-xl bg-white/5 px-3 py-1.5 font-display text-sm tracking-[0.2em] ring-1 ring-line hover:bg-white/10"
        >
          {state.room.code}
        </button>
        <div className="flex items-center gap-1">
          <SoundToggle />
          <button type="button" onClick={onLeave} className="h-10 rounded-xl px-3 text-sm font-bold text-muted hover:bg-card-red/15 hover:text-card-red">
            Leave
          </button>
        </div>
      </header>

      <div
        className="mx-auto mt-4 w-full max-w-sm cursor-pointer touch-none select-none"
        onClick={doSpin}
      >
        <BottleSvg players={players} rotation={rotation} spinning={spinning} targetIndex={targetIndex} spinnerIndex={spinnerIndex} />
      </div>

      <p className="mt-2 text-center font-semibold text-muted">
        {spinning
          ? 'Spinning…'
          : isSpinner
            ? "It's your turn to spin. Tap the bottle."
            : `Waiting for ${byId.get(party.spinnerId)?.nickname ?? 'the next player'} to spin…`}
      </p>

      <BottleResultSheet
        open={resultOpen}
        target={target ? { name: target.nickname, emoji: AVATARS[target.avatar] ?? AVATARS[0] } : null}
        nextSpinner={nextSpinner ? { name: nextSpinner.nickname, emoji: AVATARS[nextSpinner.avatar] ?? AVATARS[0] } : null}
        prompt={party.prompt}
        onClose={() => setResultOpen(false)}
        onNextSpin={() => setResultOpen(false)}
      />
    </main>
  );
}

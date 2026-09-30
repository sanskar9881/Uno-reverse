import type { ClientState, GroupView } from '@shared';
import { useState } from 'react';
import { groupAddCard, groupChoose, groupDone, groupPass, groupSetOptions, groupSetTypes, groupSpin } from '../../game/actions';
import { useGameStore } from '../../store/gameStore';
import { toast } from '../../store/toastStore';
import { copyText } from '../../utils/clipboard';
import { Button } from '../ui/Button';
import { Sheet } from '../ui/Sheet';
import { SoundToggle } from '../ui/SoundToggle';
import { GroupCardFlip } from './GroupCardFlip';
import { GroupCustomCardPanel } from './GroupCustomCardPanel';
import { GroupOptionsPanel } from './GroupOptionsPanel';

export function OnlineGroupBoard({ state, onLeave }: { state: ClientState; onLeave: () => void }) {
  const party = state.party as GroupView;
  const busy = useGameStore((s) => s.busy);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [deckOpen, setDeckOpen] = useState(false);
  const [spicyConfirmed, setSpicyConfirmed] = useState(false);

  const current = state.room.players.find((p) => p.id === party.currentPlayerId);
  const isMyTurn = party.currentPlayerId === state.selfId && !party.awaitingSpin;

  const pass = () => {
    void groupPass();
    if (party.passPenalty) toast('Pass! Do 10 squats.', 'info', '🏋️');
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden px-4 pb-[env(safe-area-inset-bottom)] pt-[max(0.5rem,env(safe-area-inset-top))]">
      <header className="flex shrink-0 items-center justify-between gap-2 py-1.5">
        <button
          type="button"
          onClick={async () => toast((await copyText(state.room.code)) ? 'Room code copied' : `Room code: ${state.room.code}`, 'good', '📋')}
          className="shrink-0 rounded-xl bg-veil/5 px-2.5 py-1.5 font-display text-xs tracking-[0.15em] ring-1 ring-line hover:bg-veil/10"
        >
          {state.room.code}
        </button>
        <span className="min-w-0 flex-1 truncate text-center font-display text-base">{current?.nickname ?? ''}'s turn</span>
        <div className="flex shrink-0 items-center gap-1">
          <SoundToggle />
          <button type="button" onClick={onLeave} className="h-10 rounded-xl px-2 text-sm font-bold text-muted hover:bg-card-red/15 hover:text-card-red">
            Leave
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1.5 py-1">
        {party.awaitingSpin ? (
          <div className="flex flex-col items-center gap-4">
            <span className="text-6xl" aria-hidden>
              🍾
            </span>
            <p className="text-center text-sm font-semibold text-muted">Spin to see who's up next.</p>
            <Button size="lg" disabled={busy} onClick={() => void groupSpin()}>
              Spin
            </Button>
          </div>
        ) : (
          <GroupCardFlip card={party.card} />
        )}
      </div>

      <div className="shrink-0 pb-2">
        {isMyTurn &&
          (!party.card ? (
            <div className="grid grid-cols-2 gap-3">
              <Button size="lg" disabled={busy} onClick={() => void groupChoose('truth')}>
                Truth
              </Button>
              <Button size="lg" disabled={busy} onClick={() => void groupChoose('dare')}>
                Dare
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" disabled={busy} onClick={pass}>
                Pass
              </Button>
              <Button disabled={busy} onClick={() => void groupDone()}>
                Done
              </Button>
            </div>
          ))}
        <div className="mt-2 flex justify-center gap-4">
          <button type="button" onClick={() => setOptionsOpen(true)} className="text-sm font-semibold text-muted hover:text-ink">
            Options
          </button>
          <button type="button" onClick={() => setDeckOpen(true)} className="text-sm font-semibold text-muted hover:text-ink">
            Custom cards
          </button>
        </div>
      </div>

      <Sheet open={optionsOpen} onClose={() => setOptionsOpen(false)} label="Options">
        <GroupOptionsPanel
          types={party.types}
          onChangeTypes={(types) => void groupSetTypes(types)}
          pickMode={party.pickMode}
          noTouch={party.noTouch}
          drinks={party.drinks}
          passPenalty={party.passPenalty}
          onChangeOption={(patch) => void groupSetOptions(patch)}
          spicyConfirmed={spicyConfirmed}
          onConfirmSpicy={() => setSpicyConfirmed(true)}
          disabled={busy}
        />
      </Sheet>

      <Sheet open={deckOpen} onClose={() => setDeckOpen(false)} label="Custom cards">
        <GroupCustomCardPanel
          busy={busy}
          onUseInGame={async (card) => {
            const res = await groupAddCard(card.cardType, card.kind, card.text, card.timerSeconds);
            if (res.ok) toast('Added to this room', 'good');
          }}
        />
      </Sheet>
    </div>
  );
}

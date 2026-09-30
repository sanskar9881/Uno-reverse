import type { ClientState, CouplesKind, CouplesView } from '@shared';
import { useState } from 'react';
import { couplesAddCard, couplesChoose, couplesDone, couplesPass, couplesSetLevel, couplesSetOnlyOurs } from '../../game/actions';
import { addFavorite, confirmAge, isAgeConfirmed, loadFavorites } from '../../game/couples/storage';
import { useGameStore } from '../../store/gameStore';
import { toast } from '../../store/toastStore';
import { copyText } from '../../utils/clipboard';
import { OurDeckPanel } from '../shared/OurDeckPanel';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Sheet } from '../ui/Sheet';
import { SoundToggle } from '../ui/SoundToggle';
import { ThemeToggle } from '../ui/ThemeToggle';
import { Surface } from '../ui/Surface';
import { CardFlip } from './CardFlip';
import { LevelPicker } from './LevelPicker';

const COUPLES_SLOTS = [
  { value: 'truth', label: 'Truth' },
  { value: 'dare', label: 'Dare' },
];

export function OnlineCouplesBoard({ state, onLeave }: { state: ClientState; onLeave: () => void }) {
  const party = state.party as CouplesView;
  const busy = useGameStore((s) => s.busy);
  const [ageConfirmed, setAgeConfirmed] = useState(() => isAgeConfirmed());
  const [favorites, setFavorites] = useState(() => loadFavorites());
  const [composerOpen, setComposerOpen] = useState(false);

  const partner = state.room.players.find((p) => p.id !== state.selfId);
  const isMyTurn = party.currentPartnerId === state.selfId;
  const myLevel = party.levels[state.selfId] ?? 'sweet';
  const partnerLevel = partner ? (party.levels[partner.id] ?? 'sweet') : 'sweet';

  if (!ageConfirmed) {
    return (
      <Modal open label="This game is for adults" className="max-w-sm text-center">
        <h2 className="font-couples text-2xl">This game is for adults.</h2>
        <p className="mt-2 text-muted">Both of you should be 18 or older.</p>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onLeave}>
            Back
          </Button>
          <Button
            onClick={() => {
              confirmAge();
              setAgeConfirmed(true);
            }}
          >
            We're both 18+
          </Button>
        </div>
      </Modal>
    );
  }

  const choose = (kind: CouplesKind) => {
    if (!isMyTurn || busy) return;
    void couplesChoose(kind);
  };

  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col px-4 pb-10 pt-2">
      <header className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={async () => toast((await copyText(state.room.code)) ? 'Room code copied' : `Room code: ${state.room.code}`, 'good', '📋')}
          className="rounded-xl bg-veil/5 px-3 py-1.5 font-display text-sm tracking-[0.2em] ring-1 ring-line hover:bg-veil/10"
        >
          {state.room.code}
        </button>
        <div className="flex items-center gap-1">
          <SoundToggle />
          <ThemeToggle />
          <button type="button" onClick={onLeave} className="h-10 rounded-xl px-3 text-sm font-bold text-muted hover:bg-card-red/15 hover:text-card-red">
            Leave
          </button>
        </div>
      </header>

      <Surface className="mt-4 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <LevelPicker label="Your comfort level" value={myLevel} onChange={(level) => void couplesSetLevel(level)} />
          <div>
            <span className="mb-1.5 block text-sm font-semibold text-muted">{partner?.nickname ?? 'Partner'}'s level</span>
            <p className="rounded-2xl bg-night px-4 py-2.5 font-bold capitalize text-ink ring-1 ring-line">{partnerLevel}</p>
          </div>
        </div>
      </Surface>

      <div className="mt-4">
        <CardFlip card={party.card} />
      </div>

      <p className="mt-2 text-center font-semibold text-muted">
        {isMyTurn ? "It's your turn." : `Waiting for ${partner?.nickname ?? 'your partner'}…`}
      </p>

      {isMyTurn && (
        <>
          {!party.card ? (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Button size="lg" onClick={() => choose('truth')} disabled={busy}>
                Truth
              </Button>
              <Button size="lg" onClick={() => choose('dare')} disabled={busy}>
                Dare
              </Button>
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Button className="min-w-0" variant="secondary" onClick={() => void couplesPass()} disabled={busy}>
                Pass
              </Button>
              <Button className="min-w-0" onClick={() => void couplesDone()} disabled={busy}>
                Done
              </Button>
              <Button
                className="min-w-0 px-2"
                variant="ghost"
                onClick={() => {
                  setFavorites(addFavorite(party.card!));
                  toast('Saved to favourites', 'good', '❤️');
                }}
              >
                <span className="truncate">❤️ Heart</span>
              </Button>
            </div>
          )}
        </>
      )}

      <div className="mt-4 flex gap-2">
        <Button variant="ghost" size="sm" onClick={() => setComposerOpen(true)}>
          Our deck
        </Button>
        <span className="self-center text-sm text-muted">Favourites: {favorites.length}</span>
      </div>

      <Sheet open={composerOpen} onClose={() => setComposerOpen(false)} label="Our deck">
        <OurDeckPanel
          game="couples"
          level={myLevel}
          slots={COUPLES_SLOTS}
          busy={busy}
          onlyOurs={party.onlyOurs}
          onToggleOnlyOurs={(value) => void couplesSetOnlyOurs(value)}
          onUseInGame={async (entry) => {
            const res = await couplesAddCard(entry.level, entry.slot as 'truth' | 'dare', entry.text, entry.photo);
            if (res.ok) toast('Added to this room', 'good');
          }}
        />
      </Sheet>
    </main>
  );
}

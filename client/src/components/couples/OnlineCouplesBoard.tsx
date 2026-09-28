import type { ClientState, CouplesKind, CouplesView } from '@shared';
import { useState } from 'react';
import { couplesAddCard, couplesChoose, couplesDone, couplesPass, couplesSetLevel } from '../../game/actions';
import { addFavorite, confirmAge, isAgeConfirmed, loadFavorites } from '../../game/couples/storage';
import { useGameStore } from '../../store/gameStore';
import { toast } from '../../store/toastStore';
import { copyText } from '../../utils/clipboard';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Sheet } from '../ui/Sheet';
import { SoundToggle } from '../ui/SoundToggle';
import { Surface } from '../ui/Surface';
import { CardFlip } from './CardFlip';
import { LevelPicker } from './LevelPicker';

export function OnlineCouplesBoard({ state, onLeave }: { state: ClientState; onLeave: () => void }) {
  const party = state.party as CouplesView;
  const busy = useGameStore((s) => s.busy);
  const [ageConfirmed, setAgeConfirmed] = useState(() => isAgeConfirmed());
  const [favorites, setFavorites] = useState(() => loadFavorites());
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [composerKind, setComposerKind] = useState<CouplesKind>('truth');

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

      <Surface className="mt-4 p-5">
        <div className="grid grid-cols-2 gap-4">
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
              <Button variant="secondary" onClick={() => void couplesPass()} disabled={busy}>
                Pass
              </Button>
              <Button onClick={() => void couplesDone()} disabled={busy}>
                Done
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setFavorites(addFavorite(party.card!));
                  toast('Saved to favourites', 'good', '❤️');
                }}
              >
                ❤️ Heart
              </Button>
            </div>
          )}
        </>
      )}

      <div className="mt-4 flex gap-2">
        <Button variant="ghost" size="sm" onClick={() => setComposerOpen(true)}>
          Add a custom card
        </Button>
        <span className="self-center text-sm text-muted">Favourites: {favorites.length}</span>
      </div>

      <Sheet open={composerOpen} onClose={() => setComposerOpen(false)} label="Add a custom card">
        <h2 className="mb-4 font-couples text-xl">Add a custom card</h2>
        <p className="mb-3 text-sm text-muted">Shared with your partner for this session only.</p>
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <Button variant={composerKind === 'truth' ? 'primary' : 'secondary'} size="sm" onClick={() => setComposerKind('truth')}>
              Truth
            </Button>
            <Button variant={composerKind === 'dare' ? 'primary' : 'secondary'} size="sm" onClick={() => setComposerKind('dare')}>
              Dare
            </Button>
          </div>
          <textarea
            value={composerText}
            onChange={(e) => setComposerText(e.target.value.slice(0, 200))}
            rows={3}
            placeholder="Write your own..."
            className="w-full resize-none rounded-2xl bg-night p-4 text-ink ring-1 ring-line placeholder:text-muted/40 focus:outline-none focus:ring-2 focus:ring-couples-rose"
          />
          <p className="text-right text-xs text-muted">{composerText.length}/200</p>
          <Button
            disabled={!composerText.trim() || busy}
            onClick={async () => {
              const res = await couplesAddCard(myLevel, composerKind, composerText.trim());
              if (res.ok) {
                setComposerText('');
                setComposerOpen(false);
                toast('Added to the deck', 'good');
              }
            }}
          >
            Add to deck
          </Button>
        </div>
      </Sheet>
    </main>
  );
}

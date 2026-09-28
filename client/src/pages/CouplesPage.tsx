import { ROOM_CODE_LENGTH, ROOM_CODE_REGEX, nicknameProblem, type CouplesKind } from '@shared';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { CardFlip } from '../components/couples/CardFlip';
import { LevelPicker } from '../components/couples/LevelPicker';
import { ProfileFields } from '../components/lobby/ProfileFields';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { Sheet } from '../components/ui/Sheet';
import { Surface } from '../components/ui/Surface';
import { addTogetherCustomCard, drawTogetherCard, nextPartner, togetherEffectiveLevel } from '../game/couples/logic';
import {
  addFavorite,
  confirmAge,
  isAgeConfirmed,
  loadFavorites,
  loadTogetherState,
  removeFavorite,
  saveTogetherState,
  type TogetherState,
} from '../game/couples/storage';
import { createRoom, joinRoom } from '../socket/lifecycle';
import { useGameStore } from '../store/gameStore';
import { toast } from '../store/toastStore';

function OnlineCouplesEntry() {
  const navigate = useNavigate();
  const profile = useGameStore((s) => s.profile);
  const [mode, setMode] = useState<'closed' | 'create' | 'join'>('closed');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const ok = () => {
    setShowErrors(true);
    return !nicknameProblem(profile.nickname);
  };

  const onCreate = async () => {
    if (!ok() || busy) return;
    setBusy(true);
    const res = await createRoom(profile, 'couples');
    setBusy(false);
    if (res.ok) navigate(`/room/${res.roomCode}`);
    else toast(res.error.message, 'bad');
  };

  const onJoin = async () => {
    if (!ok() || busy) return;
    const clean = code.trim().toUpperCase();
    if (!ROOM_CODE_REGEX.test(clean)) {
      toast(`Room codes are ${ROOM_CODE_LENGTH} letters and numbers, like X7K92P.`, 'bad');
      return;
    }
    setBusy(true);
    const res = await joinRoom(clean, profile);
    setBusy(false);
    if (res.ok) navigate(`/room/${res.roomCode}`);
    else toast(res.error.message, 'bad');
  };

  return (
    <Surface className="p-5">
      <h2 className="font-couples text-xl">Long distance</h2>
      <p className="mt-1 text-sm text-muted">A private room for just the two of you, each on your own phone.</p>
      {mode === 'closed' ? (
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" onClick={() => setMode('create')}>
            Start a room
          </Button>
          <Button variant="secondary" onClick={() => setMode('join')}>
            Join with a code
          </Button>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          <ProfileFields showErrors={showErrors} onEnter={mode === 'create' ? onCreate : onJoin} />
          {mode === 'join' && (
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, ROOM_CODE_LENGTH))}
              placeholder="X7K92P"
              className="h-12 rounded-2xl bg-night px-4 text-center font-display text-xl tracking-[0.3em] text-ink ring-1 ring-line placeholder:text-muted/40 focus:outline-none focus:ring-2 focus:ring-couples-rose"
            />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setMode('closed')}>
              Back
            </Button>
            {mode === 'create' ? (
              <Button className="flex-1" loading={busy} onClick={() => void onCreate()}>
                Start room
              </Button>
            ) : (
              <Button className="flex-1" loading={busy} onClick={() => void onJoin()} disabled={code.length !== ROOM_CODE_LENGTH}>
                Join room
              </Button>
            )}
          </div>
        </div>
      )}
    </Surface>
  );
}

function AgeGate({ onConfirm }: { onConfirm: () => void }) {
  const navigate = useNavigate();
  return (
    <Modal open label="This game is for adults" className="max-w-sm text-center">
      <h2 className="font-couples text-2xl">This game is for adults.</h2>
      <p className="mt-2 text-muted">Both of you should be 18 or older.</p>
      <div className="mt-6 grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => navigate('/')}>
          Back
        </Button>
        <Button onClick={onConfirm}>We're both 18+</Button>
      </div>
    </Modal>
  );
}

function TogetherMode() {
  const [state, setState] = useState<TogetherState>(() => loadTogetherState());
  const [card, setCard] = useState<{ level: TogetherState['levelA']; kind: CouplesKind; text: string } | null>(null);
  const [spicyConfirmed, setSpicyConfirmed] = useState(false);
  const [confirmSpicy, setConfirmSpicy] = useState<CouplesKind | null>(null);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [favorites, setFavorites] = useState(() => loadFavorites());
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [composerKind, setComposerKind] = useState<CouplesKind>('truth');

  const level = togetherEffectiveLevel(state);
  const persist = (next: TogetherState) => {
    setState(next);
    saveTogetherState(next);
  };

  const draw = (kind: CouplesKind) => {
    if (level === 'spicy' && !spicyConfirmed) {
      setConfirmSpicy(kind);
      return;
    }
    const { card: drawn, state: next } = drawTogetherCard(state, level, kind);
    persist(next);
    setCard(drawn);
  };

  const pass = () => {
    if (!card) return;
    const { card: drawn, state: next } = drawTogetherCard(state, card.level, card.kind);
    persist(next);
    setCard(drawn);
  };

  const done = () => {
    setCard(null);
    persist(nextPartner(state));
  };

  const heart = () => {
    if (!card) return;
    setFavorites(addFavorite(card));
    toast('Saved to favourites', 'good', '❤️');
  };

  const partnerLabel = state.currentPartner === 0 ? 'Partner A' : 'Partner B';

  return (
    <div className="flex flex-col gap-4">
      <Surface className="p-5">
        <div className="grid grid-cols-2 gap-4">
          <LevelPicker label="Partner A's comfort level" value={state.levelA} onChange={(levelA) => persist({ ...state, levelA })} />
          <LevelPicker label="Partner B's comfort level" value={state.levelB} onChange={(levelB) => persist({ ...state, levelB })} />
        </div>
        <p className="mt-3 text-sm text-muted">Playing at: {level === 'sweet' ? 'Sweet' : level === 'flirty' ? 'Flirty' : 'Spicy'}</p>
      </Surface>

      <CardFlip card={card} />

      <p className="text-center font-semibold text-muted">{partnerLabel}'s turn</p>

      {!card ? (
        <div className="grid grid-cols-2 gap-3">
          <Button size="lg" onClick={() => draw('truth')}>
            Truth
          </Button>
          <Button size="lg" onClick={() => draw('dare')}>
            Dare
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <Button variant="secondary" onClick={pass}>
            Pass
          </Button>
          <Button onClick={done}>Done</Button>
          <Button variant="ghost" onClick={heart}>
            ❤️ Heart
          </Button>
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={() => setComposerOpen(true)}>
          Add a custom card
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setFavoritesOpen(true)}>
          Favourites ({favorites.length})
        </Button>
      </div>

      <Modal open={confirmSpicy !== null} onClose={() => setConfirmSpicy(null)} label="Confirm Spicy" className="max-w-sm text-center">
        <h2 className="font-couples text-2xl">Ready for Spicy?</h2>
        <p className="mt-2 text-muted">Both of you should agree before continuing.</p>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setConfirmSpicy(null)}>
            Not yet
          </Button>
          <Button
            onClick={() => {
              const kind = confirmSpicy!;
              setSpicyConfirmed(true);
              setConfirmSpicy(null);
              const { card: drawn, state: next } = drawTogetherCard(state, 'spicy', kind);
              persist(next);
              setCard(drawn);
            }}
          >
            We're ready
          </Button>
        </div>
      </Modal>

      <Sheet open={composerOpen} onClose={() => setComposerOpen(false)} label="Add a custom card">
        <h2 className="mb-4 font-couples text-xl">Add a custom card</h2>
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
            disabled={!composerText.trim()}
            onClick={() => {
              persist(addTogetherCustomCard(state, level, composerKind, composerText.trim()));
              setComposerText('');
              setComposerOpen(false);
              toast('Added to the deck', 'good');
            }}
          >
            Add to deck
          </Button>
        </div>
      </Sheet>

      <Sheet open={favoritesOpen} onClose={() => setFavoritesOpen(false)} label="Favourites">
        <h2 className="mb-4 font-couples text-xl">Favourites</h2>
        {favorites.length === 0 ? (
          <p className="text-muted">Tap Heart on a card to save it here.</p>
        ) : (
          <ul className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
            {favorites.map((f) => (
              <li key={f.text} className="flex items-start justify-between gap-2 rounded-xl bg-white/5 p-3">
                <span className="text-sm text-ink">{f.text}</span>
                <button
                  type="button"
                  className="shrink-0 text-muted hover:text-card-red"
                  onClick={() => setFavorites(removeFavorite(f.text))}
                  aria-label="Remove favourite"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </div>
  );
}

export function CouplesPage() {
  const [ageConfirmed, setAgeConfirmed] = useState(() => isAgeConfirmed());
  const [mode, setMode] = useState<'select' | 'together'>('select');

  if (!ageConfirmed) {
    return (
      <AgeGate
        onConfirm={() => {
          confirmAge();
          setAgeConfirmed(true);
        }}
      />
    );
  }

  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col px-4 pb-10 pt-2">
      <PageHeader title="Couples Truth or Dare" />
      {mode === 'select' ? (
        <div className="mt-2 flex flex-col gap-4">
          <Surface className="p-5">
            <h2 className="font-couples text-xl">Together</h2>
            <p className="mt-1 text-sm text-muted">One phone, passed back and forth. No server.</p>
            <Button className="mt-4" onClick={() => setMode('together')}>
              Play together
            </Button>
          </Surface>
          <OnlineCouplesEntry />
        </div>
      ) : (
        <TogetherMode />
      )}
    </main>
  );
}

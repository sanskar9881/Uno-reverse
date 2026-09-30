import { ROOM_CODE_LENGTH, ROOM_CODE_REGEX, nicknameProblem, type IntimacyCard } from '@shared';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { CategoryPicker } from '../components/intimacy/CategoryPicker';
import { IntensitySlider } from '../components/intimacy/IntensitySlider';
import { IntimacyCardFlip } from '../components/intimacy/IntimacyCardFlip';
import { OurDeckPanel } from '../components/shared/OurDeckPanel';
import { ProfileFields } from '../components/lobby/ProfileFields';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { Sheet } from '../components/ui/Sheet';
import { SoundToggle } from '../components/ui/SoundToggle';
import { Surface } from '../components/ui/Surface';
import { drawTogetherCard, nextPartner, togetherEffectiveLevel } from '../game/intimacy/logic';
import { confirmAge, isAgeConfirmed, loadTogetherState, saveTogetherState, type IntimacyTogetherState } from '../game/intimacy/storage';
import { loadOnlyOurs, saveOnlyOurs } from '../game/ourDeck/storage';
import { createRoom, joinRoom } from '../socket/lifecycle';
import { useGameStore } from '../store/gameStore';
import { toast } from '../store/toastStore';

const INTIMACY_SLOTS = [
  { value: 'kiss', label: 'Kiss' },
  { value: 'touch', label: 'Touch and massage' },
  { value: 'flirtyTalk', label: 'Flirty talk' },
  { value: 'mood', label: 'Mood and setting' },
  { value: 'romance', label: 'Romance and dates' },
];

function OnlineIntimacyEntry() {
  const navigate = useNavigate();
  const profile = useGameStore((s) => s.profile);
  const updateProfile = useGameStore((s) => s.updateProfile);
  const [mode, setMode] = useState<'closed' | 'create' | 'join'>('closed');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinSuggestion, setJoinSuggestion] = useState<string | null>(null);

  const ok = () => {
    setShowErrors(true);
    return !nicknameProblem(profile.nickname);
  };

  const onCreate = async () => {
    if (!ok() || busy) return;
    setBusy(true);
    const res = await createRoom(profile, 'intimacy');
    setBusy(false);
    if (res.ok) navigate(`/room/${res.roomCode}`);
    else toast(res.error.message, 'bad');
  };

  const onJoin = async (overrideProfile?: typeof profile) => {
    const activeProfile = overrideProfile ?? profile;
    if (!overrideProfile) {
      if (!ok() || busy) return;
    } else if (busy) return;
    const clean = code.trim().toUpperCase();
    if (!ROOM_CODE_REGEX.test(clean)) {
      toast(`Room codes are ${ROOM_CODE_LENGTH} letters and numbers, like X7K92P.`, 'bad');
      return;
    }
    setBusy(true);
    setJoinError(null);
    setJoinSuggestion(null);
    const res = await joinRoom(clean, activeProfile);
    setBusy(false);
    if (res.ok) navigate(`/room/${res.roomCode}`);
    else {
      toast(res.error.message, 'bad');
      setJoinError(res.error.message);
      setJoinSuggestion(res.error.suggestion ?? null);
    }
  };

  const useSuggestion = () => {
    if (!joinSuggestion) return;
    const next = { ...profile, nickname: joinSuggestion };
    updateProfile({ nickname: joinSuggestion });
    void onJoin(next);
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
            <div>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, ROOM_CODE_LENGTH))}
                placeholder="X7K92P"
                className="w-full h-12 rounded-2xl bg-night px-4 text-center font-display text-xl tracking-[0.3em] text-ink ring-1 ring-line placeholder:text-muted/40 focus:outline-none focus:ring-2 focus:ring-couples-rose"
              />
              {joinError && (
                <p className="mt-1.5 text-sm text-card-red" role="alert">
                  {joinError}
                </p>
              )}
              {joinSuggestion && (
                <button
                  type="button"
                  onClick={useSuggestion}
                  className="mt-1 text-sm font-bold text-couples-rose underline hover:no-underline"
                >
                  Use {joinSuggestion}
                </button>
              )}
            </div>
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

function TogetherMode({ onLeave }: { onLeave: () => void }) {
  const [state, setState] = useState<IntimacyTogetherState>(() => loadTogetherState());
  const [card, setCard] = useState<IntimacyCard | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [deckOpen, setDeckOpen] = useState(false);
  const [onlyOurs, setOnlyOurs] = useState(() => loadOnlyOurs('intimacy'));

  const level = togetherEffectiveLevel(state);
  const persist = (next: IntimacyTogetherState) => {
    setState(next);
    saveTogetherState(next);
  };
  const toggleOnlyOurs = (value: boolean) => {
    setOnlyOurs(value);
    saveOnlyOurs('intimacy', value);
  };

  const activeLevel = state.currentPartner === 0 ? state.levelA : state.levelB;
  const setActiveLevel = (next: typeof activeLevel) =>
    persist(state.currentPartner === 0 ? { ...state, levelA: next } : { ...state, levelB: next });
  const partnerLabel = state.currentPartner === 0 ? 'Partner A' : 'Partner B';

  const draw = () => {
    const result = drawTogetherCard(state, level, onlyOurs);
    if (!result) {
      toast('Add some cards to Our deck first, or turn off "Play only our cards".', 'bad');
      return;
    }
    persist(result.state);
    setCard(result.card);
  };

  const done = () => {
    setCard(null);
    persist(nextPartner(state));
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden px-4 pb-[env(safe-area-inset-bottom)] pt-[max(0.5rem,env(safe-area-inset-top))]">
      <header className="flex shrink-0 items-center justify-between gap-2 py-1.5">
        <button
          type="button"
          onClick={onLeave}
          aria-label="Back"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-ink hover:bg-veil/10"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <IntensitySlider label={`${partnerLabel}'s comfort level`} value={activeLevel} onChange={setActiveLevel} />
        <SoundToggle />
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1.5 py-1">
        <IntimacyCardFlip card={card} />
        <p className="shrink-0 text-center text-sm font-semibold text-muted">{partnerLabel}'s turn</p>
      </div>

      <div className="shrink-0 pb-2">
        {!card ? (
          <Button size="lg" className="w-full" onClick={draw}>
            Draw a card
          </Button>
        ) : (
          <Button size="lg" className="w-full" onClick={done}>
            Done
          </Button>
        )}
        <div className="mt-2 flex justify-center gap-4">
          <button type="button" onClick={() => setCategoriesOpen(true)} className="text-sm font-semibold text-muted hover:text-ink">
            Categories ({state.categories.length})
          </button>
          <button type="button" onClick={() => setDeckOpen(true)} className="text-sm font-semibold text-muted hover:text-ink">
            Our deck
          </button>
        </div>
      </div>

      <Sheet open={categoriesOpen} onClose={() => setCategoriesOpen(false)} label="Categories">
        <CategoryPicker categories={state.categories} onChange={(categories) => persist({ ...state, categories })} />
      </Sheet>

      <Sheet open={deckOpen} onClose={() => setDeckOpen(false)} label="Our deck">
        <OurDeckPanel game="intimacy" level={level} slots={INTIMACY_SLOTS} onlyOurs={onlyOurs} onToggleOnlyOurs={toggleOnlyOurs} />
      </Sheet>
    </div>
  );
}

export function IntimacyPage() {
  const navigate = useNavigate();
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

  if (mode === 'together') {
    return <TogetherMode onLeave={() => setMode('select')} />;
  }

  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col px-4 pb-10 pt-2">
      <PageHeader title="Intimacy Night" backTo="/" />
      <div className="mt-2 flex flex-col gap-4">
        <Surface className="p-5">
          <h2 className="font-couples text-xl">Together</h2>
          <p className="mt-1 text-sm text-muted">One phone, passed back and forth. No server.</p>
          <Button className="mt-4" onClick={() => setMode('together')}>
            Play together
          </Button>
        </Surface>
        <OnlineIntimacyEntry />
      </div>
      <button
        type="button"
        onClick={() => navigate('/')}
        className="mt-6 self-center text-sm font-semibold text-muted hover:text-ink"
      >
        Back to the start
      </button>
    </main>
  );
}

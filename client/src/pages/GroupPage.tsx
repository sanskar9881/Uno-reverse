import { GROUP_MIN_PLAYERS, ROOM_CODE_LENGTH, ROOM_CODE_REGEX, nicknameProblem, type GroupCard } from '@shared';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { GroupCardFlip } from '../components/group/GroupCardFlip';
import { GroupCustomCardPanel } from '../components/group/GroupCustomCardPanel';
import { GroupOptionsPanel } from '../components/group/GroupOptionsPanel';
import { GroupPlayerSetup } from '../components/group/GroupPlayerSetup';
import { ProfileFields } from '../components/lobby/ProfileFields';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { Sheet } from '../components/ui/Sheet';
import { SoundToggle } from '../components/ui/SoundToggle';
import { Surface } from '../components/ui/Surface';
import { drawTogetherCard, finishTurn, spinForNext, createTogetherState, type GroupTogetherState } from '../game/group/logic';
import { loadGroupOptions, saveGroupOptions, type GroupOptions } from '../game/group/storage';
import { createRoom, joinRoom } from '../socket/lifecycle';
import { useGameStore } from '../store/gameStore';
import { toast } from '../store/toastStore';

function OnlineGroupEntry() {
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
    const res = await createRoom(profile, 'group');
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
      <h2 className="font-display text-xl">Play online</h2>
      <p className="mt-1 text-sm text-muted">Everyone joins from their own phone or computer.</p>
      {mode === 'closed' ? (
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" onClick={() => setMode('create')}>
            Create a room
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
                className="w-full h-12 rounded-2xl bg-night px-4 text-center font-display text-xl tracking-[0.3em] text-ink ring-1 ring-line placeholder:text-muted/40 focus:outline-none focus:ring-2 focus:ring-group-violet"
              />
              {joinError && (
                <p className="mt-1.5 text-sm text-card-red" role="alert">
                  {joinError}
                </p>
              )}
              {joinSuggestion && (
                <button type="button" onClick={useSuggestion} className="mt-1 text-sm font-bold text-group-violet underline hover:no-underline">
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
                Create room
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

type Screen = 'choice' | 'setup' | 'play';

function TogetherPlay({ players, options, setOptions, onLeave }: {
  players: string[];
  options: GroupOptions;
  setOptions: (o: GroupOptions) => void;
  onLeave: () => void;
}) {
  const [state, setState] = useState<GroupTogetherState>(() => createTogetherState(players));
  const [card, setCard] = useState<GroupCard | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [deckOpen, setDeckOpen] = useState(false);

  const currentName = players[state.currentIndex];

  const draw = (kind: 'truth' | 'dare') => {
    const result = drawTogetherCard(state, kind, options);
    if (!result) {
      toast('No cards available for the current options.', 'bad');
      return;
    }
    setState(result.state);
    setCard(result.card);
  };

  const pass = () => {
    if (!card) return;
    const result = drawTogetherCard(state, card.kind, options);
    if (!result) return;
    setState(result.state);
    setCard(result.card);
    if (options.passPenalty) toast('Pass! Do 10 squats.', 'info', '🏋️');
  };

  const done = () => {
    setCard(null);
    setState(finishTurn(state, options.pickMode));
  };

  const spin = () => {
    const result = spinForNext(state);
    setState(result.state);
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
        <span className="min-w-0 flex-1 truncate text-center font-display text-base">{currentName}'s turn</span>
        <SoundToggle />
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1.5 py-1">
        {state.awaitingSpin ? (
          <div className="flex flex-col items-center gap-4">
            <span className="text-6xl" aria-hidden>
              🍾
            </span>
            <p className="text-center text-sm font-semibold text-muted">Spin to see who's up next.</p>
            <Button size="lg" onClick={spin}>
              Spin
            </Button>
          </div>
        ) : (
          <GroupCardFlip card={card} />
        )}
      </div>

      <div className="shrink-0 pb-2">
        {!state.awaitingSpin &&
          (!card ? (
            <div className="grid grid-cols-2 gap-3">
              <Button size="lg" onClick={() => draw('truth')}>
                Truth
              </Button>
              <Button size="lg" onClick={() => draw('dare')}>
                Dare
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={pass}>
                Pass
              </Button>
              <Button onClick={done}>Done</Button>
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
          types={options.types}
          onChangeTypes={(types) => setOptions({ ...options, types })}
          pickMode={options.pickMode}
          noTouch={options.noTouch}
          drinks={options.drinks}
          passPenalty={options.passPenalty}
          onChangeOption={(patch) => setOptions({ ...options, ...patch })}
          spicyConfirmed={options.spicyConfirmed}
          onConfirmSpicy={() => setOptions({ ...options, spicyConfirmed: true })}
        />
      </Sheet>

      <Sheet open={deckOpen} onClose={() => setDeckOpen(false)} label="Custom cards">
        <GroupCustomCardPanel />
      </Sheet>
    </div>
  );
}

export function GroupPage() {
  const navigate = useNavigate();
  const [screen, setScreen] = useState<Screen>('choice');
  const [players, setPlayers] = useState<string[]>([]);
  const [options, setOptions] = useState<GroupOptions>(() => loadGroupOptions());

  const persistOptions = (next: GroupOptions) => {
    setOptions(next);
    saveGroupOptions(next);
  };

  if (screen === 'play') {
    return <TogetherPlay players={players} options={options} setOptions={persistOptions} onLeave={() => setScreen('setup')} />;
  }

  if (screen === 'setup') {
    return (
      <main className="mx-auto flex min-h-full max-w-2xl flex-col px-4 pt-2">
        <PageHeader title="Truth and Dare Group" />
        <div className="pn-setup">
          <GroupPlayerSetup players={players} onChange={setPlayers} />
          <GroupOptionsPanel
            types={options.types}
            onChangeTypes={(types) => persistOptions({ ...options, types })}
            pickMode={options.pickMode}
            noTouch={options.noTouch}
            drinks={options.drinks}
            passPenalty={options.passPenalty}
            onChangeOption={(patch) => persistOptions({ ...options, ...patch })}
            spicyConfirmed={options.spicyConfirmed}
            onConfirmSpicy={() => persistOptions({ ...options, spicyConfirmed: true })}
          />
          {players.length < GROUP_MIN_PLAYERS && (
            <p className="text-center text-sm text-muted">Add at least {GROUP_MIN_PLAYERS} players to start.</p>
          )}
        </div>
        <div className="pn-sticky-actions" data-overlap-ok>
          <button
            type="button"
            className="pn-btn pn-btn--primary pn-btn--lg"
            onClick={() => setScreen('play')}
            disabled={players.length < GROUP_MIN_PLAYERS}
          >
            Start
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col px-4 pb-10 pt-2">
      <PageHeader title="Truth and Dare Group" />
      <div className="mt-2 flex flex-col gap-4">
        <Surface className="p-5">
          <h2 className="font-display text-xl">Play on this phone</h2>
          <p className="mt-1 text-sm text-muted">For a group sitting together. Pass the phone around.</p>
          <Button className="mt-4" onClick={() => setScreen('setup')}>
            Get started
          </Button>
        </Surface>
        <OnlineGroupEntry />
      </div>
      <button type="button" onClick={() => navigate('/')} className="mt-6 self-center text-sm font-semibold text-muted hover:text-ink">
        Back to the start
      </button>
    </main>
  );
}

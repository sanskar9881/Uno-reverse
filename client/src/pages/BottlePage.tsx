import { ROOM_CODE_LENGTH, ROOM_CODE_REGEX, nicknameProblem } from '@shared';
import { promptPool, type BottlePromptPack } from '@shared/games/bottle/prompts';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { BOTTLE_MIN_PLAYERS } from '../game/bottle/logic';
import { useBottleSpin } from '../game/bottle/useBottleSpin';
import {
  deleteSavedGroup,
  loadBottleOptions,
  loadLastLocalGame,
  loadSavedGroups,
  saveBottleOptions,
  saveGroup,
  saveLastLocalGame,
  type BottleOptions,
  type BottlePlayer,
  type SavedGroup,
} from '../game/bottle/storage';
import { updateBottleSettings } from '../game/actions';
import { BottleTable } from '../components/bottle/BottleTable';
import { PlayerSetup } from '../components/bottle/PlayerSetup';
import { ProfileFields } from '../components/lobby/ProfileFields';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { Surface } from '../components/ui/Surface';
import { playSound } from '../game/sounds';
import { createRoom, joinRoom } from '../socket/lifecycle';
import { useGameStore } from '../store/gameStore';
import { toast } from '../store/toastStore';

const PACKS = ['off', 'party', 'flirty'] as const;

function OnlineBottleEntry() {
  const navigate = useNavigate();
  const profile = useGameStore((s) => s.profile);
  const updateProfile = useGameStore((s) => s.updateProfile);
  const [mode, setMode] = useState<'closed' | 'create' | 'join'>('closed');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinSuggestion, setJoinSuggestion] = useState<string | null>(null);

  const profileOk = () => {
    setShowErrors(true);
    if (nicknameProblem(profile.nickname)) {
      playSound('error');
      return false;
    }
    return true;
  };

  const onCreate = async () => {
    if (!profileOk() || busy) return;
    setBusy(true);
    const res = await createRoom(profile, 'bottle');
    setBusy(false);
    if (res.ok) navigate(`/room/${res.roomCode}`);
    else toast(res.error.message, 'bad');
  };

  const onJoin = async (overrideProfile?: typeof profile) => {
    const activeProfile = overrideProfile ?? profile;
    if (!overrideProfile) {
      if (!profileOk() || busy) return;
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
                className="w-full h-12 rounded-2xl bg-night px-4 text-center font-display text-xl tracking-[0.3em] text-ink ring-1 ring-line placeholder:text-muted/40 focus:outline-none focus:ring-2 focus:ring-bottle-amber"
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
                  className="mt-1 text-sm font-bold text-bottle-amber underline hover:no-underline"
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

type Screen = 'choice' | 'setup' | 'table';

export function BottlePage() {
  const navigate = useNavigate();
  const profile = useGameStore((s) => s.profile);
  const [screen, setScreen] = useState<Screen>('choice');
  const [lastGame] = useState(() => loadLastLocalGame());
  const [players, setPlayers] = useState<BottlePlayer[]>([]);
  const [savedGroups, setSavedGroups] = useState<SavedGroup[]>(() => loadSavedGroups());
  const [options, setOptions] = useState<BottleOptions>(() => loadBottleOptions());
  const [spinnerIndex, setSpinnerIndex] = useState(0);
  const [targetIndex, setTargetIndex] = useState<number | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [confirmFlirty, setConfirmFlirty] = useState(false);
  const [takingOnline, setTakingOnline] = useState(false);
  const [onlineNicknameOpen, setOnlineNicknameOpen] = useState(false);
  const usedPrompts = useRef<Record<BottlePromptPack, Set<string>>>({ off: new Set(), party: new Set(), flirty: new Set() });
  const [prompt, setPrompt] = useState<string | null>(null);
  const { rotation, spinning, spin } = useBottleSpin();

  const persistOptions = (next: BottleOptions) => {
    setOptions(next);
    saveBottleOptions(next);
  };

  const drawPrompt = (pack: BottlePromptPack): string | null => {
    if (pack === 'off') return null;
    const pool = promptPool(pack);
    const used = usedPrompts.current[pack];
    if (used.size >= pool.length) used.clear();
    const remaining = pool.filter((p) => !used.has(p));
    const pick = remaining[Math.floor(Math.random() * remaining.length)];
    used.add(pick);
    return pick;
  };

  const doSpin = (initialSpeed?: number) => {
    if (players.length < BOTTLE_MIN_PLAYERS || spinning) return;
    spin(
      {
        playerCount: players.length,
        spinnerIndex,
        canLandOnSelf: options.canLandOnSelf,
        sound: options.sound,
        onLand: (index) => {
          setTargetIndex(index);
          setPrompt(drawPrompt(options.pack));
          setResultOpen(true);
        },
      },
      initialSpeed,
    );
  };

  const nextSpinnerIndex = () => {
    if (options.clockwiseTurns) return (spinnerIndex + 1) % players.length;
    return targetIndex ?? spinnerIndex;
  };

  const onNextSpin = () => {
    setResultOpen(false);
    setSpinnerIndex(nextSpinnerIndex());
  };

  const choosePack = (pack: BottlePromptPack) => {
    if (pack === 'flirty' && !options.flirtyConfirmed) {
      setConfirmFlirty(true);
      return;
    }
    persistOptions({ ...options, pack });
  };

  const startGame = (nextPlayers: BottlePlayer[], nextOptions: BottleOptions) => {
    setPlayers(nextPlayers);
    setOptions(nextOptions);
    setSpinnerIndex(0);
    setTargetIndex(null);
    saveLastLocalGame(nextPlayers, nextOptions);
    setScreen('table');
  };

  const takeOnline = async () => {
    if (takingOnline) return;
    setTakingOnline(true);
    const res = await createRoom(profile, 'bottle');
    if (!res.ok) {
      setTakingOnline(false);
      toast(res.error.message, 'bad');
      return;
    }
    await updateBottleSettings({ pack: options.pack, canLandOnSelf: options.canLandOnSelf, clockwiseTurns: options.clockwiseTurns });
    navigate(`/room/${res.roomCode}`);
  };

  const onTakeOnline = () => {
    if (nicknameProblem(profile.nickname)) {
      setOnlineNicknameOpen(true);
      return;
    }
    void takeOnline();
  };

  const confirmOnlineNickname = () => {
    if (nicknameProblem(profile.nickname)) return;
    setOnlineNicknameOpen(false);
    void takeOnline();
  };

  if (screen === 'choice') {
    return (
      <main className="mx-auto flex min-h-full max-w-2xl flex-col px-4 pb-10 pt-2">
        <PageHeader title="Spin the Bottle" />
        <div className="mt-2 flex flex-col gap-4">
          <Surface className="p-5">
            <h2 className="font-display text-xl">Play on this phone</h2>
            <p className="mt-1 text-sm text-muted">For a group sitting together. No room needed — it works offline.</p>
            {lastGame ? (
              <div className="mt-4 flex flex-col gap-2">
                <Button size="lg" onClick={() => startGame(lastGame.players, lastGame.options)}>
                  Play again ({lastGame.players.length} players)
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setScreen('setup')}>
                  Different players
                </Button>
              </div>
            ) : (
              <Button className="mt-4" onClick={() => setScreen('setup')}>
                Get started
              </Button>
            )}
          </Surface>
          <OnlineBottleEntry />
        </div>
      </main>
    );
  }

  if (screen === 'setup') {
    return (
      <main className="mx-auto flex min-h-full max-w-2xl flex-col px-4 pb-10 pt-2">
        <PageHeader title="Spin the Bottle" />
        <PlayerSetup
          players={players}
          onChange={setPlayers}
          savedGroups={savedGroups}
          onSaveGroup={(name) => setSavedGroups(saveGroup(name, players))}
          onLoadGroup={(g) => setPlayers(g.players)}
          onDeleteGroup={(name) => setSavedGroups(deleteSavedGroup(name))}
          onStart={() => startGame(players, options)}
        />

        <Surface className="mt-4 flex flex-col gap-4 p-5">
          <SegmentedControl
            label="Prompt pack"
            options={PACKS}
            value={options.pack}
            onChange={choosePack}
            format={(v) => (v === 'off' ? 'Off' : v === 'party' ? 'Party' : 'Flirty 18+')}
          />
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-muted">Can land on the spinner</span>
            <input
              type="checkbox"
              checked={options.canLandOnSelf}
              onChange={(e) => persistOptions({ ...options, canLandOnSelf: e.target.checked })}
              className="h-5 w-5 accent-bottle-amber"
            />
          </label>
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-muted">Turns go clockwise (instead of following the bottle)</span>
            <input
              type="checkbox"
              checked={options.clockwiseTurns}
              onChange={(e) => persistOptions({ ...options, clockwiseTurns: e.target.checked })}
              className="h-5 w-5 accent-bottle-amber"
            />
          </label>
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-muted">Sound</span>
            <input
              type="checkbox"
              checked={options.sound}
              onChange={(e) => persistOptions({ ...options, sound: e.target.checked })}
              className="h-5 w-5 accent-bottle-amber"
            />
          </label>
        </Surface>

        <Modal open={confirmFlirty} onClose={() => setConfirmFlirty(false)} label="Confirm everyone is 18 or older" className="max-w-sm text-center">
          <h2 className="font-display text-2xl">Everyone here is 18+?</h2>
          <p className="mt-2 text-muted">The Flirty pack is playful and suggestive, meant for adults only.</p>
          <div className="mt-6 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setConfirmFlirty(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setConfirmFlirty(false);
                persistOptions({ ...options, pack: 'flirty', flirtyConfirmed: true });
              }}
            >
              Yes, we're 18+
            </Button>
          </div>
        </Modal>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-full max-w-5xl flex-col px-4 pb-10 pt-2">
      <PageHeader title="Spin the Bottle" />
      <div className="-mt-2 flex justify-center gap-2 lg:hidden">
        <Button variant="ghost" size="sm" onClick={() => setScreen('setup')}>
          Edit players
        </Button>
        <Button variant="ghost" size="sm" loading={takingOnline} onClick={onTakeOnline}>
          Take it online
        </Button>
      </div>

      <BottleTable
        players={players}
        rotation={rotation}
        spinning={spinning}
        targetIndex={targetIndex}
        spinnerIndex={spinnerIndex}
        statusText={spinning ? 'Spinning…' : `${players[spinnerIndex]?.name ?? ''}'s turn to spin. Tap or flick the bottle.`}
        onSpin={doSpin}
        allowFlick
        resultOpen={resultOpen}
        resultTarget={targetIndex !== null ? players[targetIndex] : null}
        nextSpinner={players[nextSpinnerIndex()] ?? null}
        prompt={prompt}
        onCloseResult={() => setResultOpen(false)}
        onNextSpin={onNextSpin}
        sidebarActions={
          <>
            <Button variant="ghost" size="sm" onClick={() => setScreen('setup')}>
              Edit players &amp; settings
            </Button>
            <Button variant="ghost" size="sm" loading={takingOnline} onClick={onTakeOnline}>
              Take it online
            </Button>
          </>
        }
      />

      <Modal open={onlineNicknameOpen} onClose={() => setOnlineNicknameOpen(false)} label="Your name for the room" className="max-w-sm">
        <h2 className="font-display text-xl">What's your name?</h2>
        <p className="mt-1 text-sm text-muted">You'll host the online room under this name.</p>
        <div className="mt-4">
          <ProfileFields showErrors onEnter={confirmOnlineNickname} />
        </div>
        <Button className="mt-4 w-full" loading={takingOnline} onClick={confirmOnlineNickname}>
          Continue
        </Button>
      </Modal>
    </main>
  );
}

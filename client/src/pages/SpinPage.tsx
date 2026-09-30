import { AVATARS, nicknameProblem, ROOM_CODE_LENGTH, ROOM_CODE_REGEX } from '@shared';
import { promptPool, type BottlePromptPack } from '@shared/games/bottle/prompts';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import type { BottlePlayer } from '../game/bottle/storage';
import { useBottleSpin } from '../game/bottle/useBottleSpin';
import { decodeWheelShare, encodeWheelShare, WHEEL_MIN_NAMES } from '../game/wheel/logic';
import { useWheelSpin } from '../game/wheel/useWheelSpin';
import {
  deleteSavedGroup,
  loadDraft,
  loadHistory,
  loadSavedGroups,
  loadSpinOptions,
  pushHistory,
  saveDraft,
  saveGroup,
  saveSpinOptions,
  type SavedSpinGroup,
  type SpinOptions,
} from '../game/spin/storage';
import { BottleSvg } from '../components/bottle/BottleSvg';
import { BottleResultSheet } from '../components/bottle/ResultSheet';
import { NameEditor } from '../components/wheel/NameEditor';
import { ResultSheet } from '../components/wheel/ResultSheet';
import { WheelSvg } from '../components/wheel/WheelSvg';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { ProfileFields } from '../components/lobby/ProfileFields';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { Sheet } from '../components/ui/Sheet';
import { Surface } from '../components/ui/Surface';
import { useIsCompact } from '../hooks/useMediaQuery';
import { copyText } from '../utils/clipboard';
import { toast } from '../store/toastStore';
import { cn } from '../utils/cn';
import { createRoom, joinRoom } from '../socket/lifecycle';
import { updateBottleSettings } from '../game/actions';
import { useGameStore } from '../store/gameStore';

const SPIN_LENGTHS = ['short', 'normal', 'long'] as const;
const PACKS = ['off', 'party', 'flirty'] as const;
const BOTTLE_NAMES_LIMIT = 12;

function drawPrompt(pack: BottlePromptPack, used: Set<string>): string | null {
  if (pack === 'off') return null;
  const pool = promptPool(pack);
  if (used.size >= pool.length) used.clear();
  const remaining = pool.filter((p) => !used.has(p));
  const pick = remaining[Math.floor(Math.random() * remaining.length)];
  used.add(pick);
  return pick;
}

function OnlineSpinEntry({ mode }: { mode: 'wheel' | 'bottle' }) {
  const navigate = useNavigate();
  const profile = useGameStore((s) => s.profile);
  const updateProfile = useGameStore((s) => s.updateProfile);
  const [entryMode, setEntryMode] = useState<'closed' | 'create' | 'join'>('closed');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinSuggestion, setJoinSuggestion] = useState<string | null>(null);

  const profileOk = () => {
    setShowErrors(true);
    if (nicknameProblem(profile.nickname)) return false;
    return true;
  };

  const onCreate = async () => {
    if (!profileOk() || busy) return;
    setBusy(true);
    const res = await createRoom(profile, 'spin');
    if (!res.ok) {
      setBusy(false);
      toast(res.error.message, 'bad');
      return;
    }
    await updateBottleSettings({ mode });
    navigate(`/room/${res.roomCode}`);
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
      <p className="mt-1 text-sm text-muted">Everyone joins from their own phone or computer. The room's players are the names.</p>
      {entryMode === 'closed' ? (
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" onClick={() => setEntryMode('create')}>
            Create a room
          </Button>
          <Button variant="secondary" onClick={() => setEntryMode('join')}>
            Join with a code
          </Button>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          <ProfileFields showErrors={showErrors} onEnter={entryMode === 'create' ? onCreate : onJoin} />
          {entryMode === 'join' && (
            <div>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, ROOM_CODE_LENGTH))}
                placeholder="X7K92P"
                className="w-full h-12 rounded-2xl bg-night px-4 text-center font-display text-xl tracking-[0.3em] text-ink ring-1 ring-line placeholder:text-muted/40 focus:outline-none focus:ring-2 focus:ring-wheel-gold"
              />
              {joinError && (
                <p className="mt-1.5 text-sm text-card-red" role="alert">
                  {joinError}
                </p>
              )}
              {joinSuggestion && (
                <button type="button" onClick={useSuggestion} className="mt-1 text-sm font-bold text-wheel-gold underline hover:no-underline">
                  Use {joinSuggestion}
                </button>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setEntryMode('closed')}>
              Back
            </Button>
            {entryMode === 'create' ? (
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

export function SpinPage() {
  const [searchParams] = useSearchParams();
  const draft = useRef(loadDraft());
  const [title, setTitle] = useState(draft.current.title);
  const [names, setNames] = useState<string[]>(draft.current.names);
  const [namesRevision, setNamesRevision] = useState(0);
  const [options, setOptions] = useState<SpinOptions>(() => {
    const loaded = loadSpinOptions();
    const queryMode = searchParams.get('mode');
    if (queryMode === 'wheel' || queryMode === 'bottle') return { ...loaded, mode: queryMode };
    return loaded;
  });
  const [saved, setSaved] = useState<SavedSpinGroup[]>(() => loadSavedGroups());
  const [history, setHistory] = useState<string[]>(() => loadHistory());
  const [winner, setWinner] = useState<string | null>(null);
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [confirmFlirty, setConfirmFlirty] = useState(false);
  const [namesSheetOpen, setNamesSheetOpen] = useState(false);
  const usedPrompts = useRef<Record<BottlePromptPack, Set<string>>>({ off: new Set(), party: new Set(), flirty: new Set() });
  const flickSpeed = useRef(0);
  const compact = useIsCompact();

  const wheelSpin = useWheelSpin();
  const bottleSpin = useBottleSpin();
  const spinning = options.mode === 'wheel' ? wheelSpin.spinning : bottleSpin.spinning;
  const rotation = options.mode === 'wheel' ? wheelSpin.rotation : bottleSpin.rotation;

  // A shared wheel link recreates the wheel from the URL hash and forces wheel mode.
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    const shared = decodeWheelShare(hash);
    if (shared) {
      setTitle(shared.title);
      setNames(shared.names);
      setNamesRevision((r) => r + 1);
      setOptions((o) => ({ ...o, mode: 'wheel' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => saveDraft({ title, names }), [title, names]);
  useEffect(() => saveSpinOptions(options), [options]);

  const bottlePlayers: BottlePlayer[] = names.map((name, i) => ({ name, emoji: AVATARS[i % AVATARS.length] }));
  const overBottleLimit = options.mode === 'bottle' && names.length > BOTTLE_NAMES_LIMIT;
  const canSpin = options.mode === 'wheel' ? names.length >= WHEEL_MIN_NAMES && !spinning : names.length >= 2 && !overBottleLimit && !spinning;

  const onLand = (index: number) => {
    const name = names[index];
    setWinner(name);
    setWinnerIndex(index);
    setPrompt(drawPrompt(options.pack, usedPrompts.current[options.pack]));
    setResultOpen(true);
    setHistory(pushHistory(name));
    if (options.mode === 'wheel' && options.removeWinners) {
      setNames((prev) => prev.filter((_, i) => i !== index));
      setNamesRevision((r) => r + 1);
    }
  };

  const doWheelSpin = (forceIndex?: number, namesOverride?: string[]) => {
    const spinNames = namesOverride ?? names;
    if (spinNames.length < WHEEL_MIN_NAMES || wheelSpin.spinning) return;
    wheelSpin.spin({ names: spinNames, spinLength: options.spinLength, sound: options.sound, onLand }, forceIndex, flickSpeed.current);
    flickSpeed.current = 0;
  };

  const doBottleSpin = (initialSpeed?: number) => {
    if (names.length < 2 || overBottleLimit || bottleSpin.spinning) return;
    const spinnerIndex = 0;
    bottleSpin.spin(
      { playerCount: names.length, spinnerIndex, canLandOnSelf: options.canLandOnSelf, sound: options.sound, onLand },
      initialSpeed,
    );
  };

  const doSpin = (forceIndex?: number) => (options.mode === 'wheel' ? doWheelSpin(forceIndex) : doBottleSpin());

  const onFlick = (velocity: number) => {
    if (options.mode === 'wheel') {
      flickSpeed.current = velocity;
      doWheelSpin();
    } else {
      doBottleSpin(velocity);
    }
  };

  const choosePack = (pack: BottlePromptPack) => {
    if (pack === 'flirty' && !options.flirtyConfirmed) {
      setConfirmFlirty(true);
      return;
    }
    setOptions((o) => ({ ...o, pack }));
  };

  const share = async () => {
    const encoded = encodeWheelShare({ title, names });
    if (!encoded) {
      toast("That's too much to fit in a link. Try fewer or shorter names.", 'bad');
      return;
    }
    const url = `${window.location.origin}/spin?mode=wheel#${encoded}`;
    toast((await copyText(url)) ? 'Share link copied' : url, 'good', '🔗');
  };

  const panel = (
    <>
      <Surface className="p-5">
        <NameEditor key={namesRevision} names={names} onChange={setNames} title={title} onTitleChange={setTitle} />

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (!title.trim() || names.length === 0) {
                toast('Give it a title and some names first.', 'bad');
                return;
              }
              setSaved(saveGroup({ title, names }));
              toast('Saved', 'good');
            }}
          >
            Save
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void share()}>
            Share wheel
          </Button>
        </div>

        {saved.length > 0 && (
          <div className="mt-5">
            <h3 className="mb-2 text-sm font-semibold text-muted">Saved</h3>
            <ul className="flex flex-col gap-1.5">
              {saved.map((g) => (
                <li key={g.title} className="flex items-center justify-between gap-2 rounded-xl bg-veil/5 px-3 py-2">
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left font-semibold text-ink hover:text-wheel-gold"
                    onClick={() => {
                      setTitle(g.title);
                      setNames(g.names);
                      setNamesRevision((r) => r + 1);
                    }}
                  >
                    {g.title} <span className="font-normal text-muted">({g.names.length})</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${g.title}`}
                    className="shrink-0 rounded-lg px-2 py-1 text-muted hover:bg-card-red/20 hover:text-card-red"
                    onClick={() => setSaved(deleteSavedGroup(g.title))}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Surface>

      <Surface className="mt-4 flex flex-col gap-4 p-5">
        {options.mode === 'wheel' ? (
          <>
            <SegmentedControl
              label="Spin length"
              options={SPIN_LENGTHS}
              value={options.spinLength}
              onChange={(spinLength) => setOptions((o) => ({ ...o, spinLength }))}
              format={(v) => v[0].toUpperCase() + v.slice(1)}
            />
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-muted">Remove winners automatically</span>
              <input
                type="checkbox"
                checked={options.removeWinners}
                onChange={(e) => setOptions((o) => ({ ...o, removeWinners: e.target.checked }))}
                className="h-5 w-5 accent-wheel-gold"
              />
            </label>
          </>
        ) : (
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-muted">Can land on whoever spun it</span>
            <input
              type="checkbox"
              checked={options.canLandOnSelf}
              onChange={(e) => setOptions((o) => ({ ...o, canLandOnSelf: e.target.checked }))}
              className="h-5 w-5 accent-bottle-amber"
            />
          </label>
        )}
        <SegmentedControl
          label="Prompt pack"
          options={PACKS}
          value={options.pack}
          onChange={choosePack}
          format={(v) => (v === 'off' ? 'Off' : v === 'party' ? 'Party' : 'Flirty 18+')}
        />
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-muted">Sound</span>
          <input
            type="checkbox"
            checked={options.sound}
            onChange={(e) => setOptions((o) => ({ ...o, sound: e.target.checked }))}
            className="h-5 w-5 accent-wheel-gold"
          />
        </label>
      </Surface>

      <div className="mt-4">
        <OnlineSpinEntry mode={options.mode} />
      </div>
    </>
  );

  return (
    <main className="mx-auto flex min-h-full max-w-6xl flex-col px-4 pb-12 pt-2">
      <PageHeader title="Spin It" />

      <div className="mt-2 flex justify-center">
        <SegmentedControl
          label="Wheel or bottle"
          options={['wheel', 'bottle'] as const}
          value={options.mode}
          onChange={(mode) => setOptions((o) => ({ ...o, mode }))}
          format={(v) => (v === 'wheel' ? 'Wheel' : 'Bottle')}
        />
      </div>

      <div className={cn('mt-4', !compact && 'grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]')}>
        <div className="flex flex-col items-center gap-4">
          {options.mode === 'wheel' ? (
            <div
              className="w-full max-w-sm cursor-pointer touch-none select-none"
              onClick={() => canSpin && doWheelSpin()}
              onPointerDown={(e) => {
                const startY = e.clientY;
                const startT = performance.now();
                const onUp = (ev: PointerEvent) => {
                  const dt = Math.max(1, performance.now() - startT);
                  const dy = startY - ev.clientY;
                  window.removeEventListener('pointerup', onUp);
                  if (Math.abs(dy) > 30) onFlick((dy / dt) * 100);
                };
                window.addEventListener('pointerup', onUp);
              }}
            >
              <WheelSvg names={names.length ? names : ['Add names below']} title={title} rotation={rotation} spinning={spinning} />
            </div>
          ) : (
            <div
              className="w-full max-w-sm cursor-pointer touch-none select-none"
              onClick={() => canSpin && doBottleSpin()}
              onPointerDown={(e) => {
                const startY = e.clientY;
                const startT = performance.now();
                const onUp = (ev: PointerEvent) => {
                  const dt = Math.max(1, performance.now() - startT);
                  const dy = startY - ev.clientY;
                  window.removeEventListener('pointerup', onUp);
                  if (Math.abs(dy) > 30) onFlick((dy / dt) * 100);
                };
                window.addEventListener('pointerup', onUp);
              }}
            >
              <BottleSvg
                players={bottlePlayers.length ? bottlePlayers : [{ name: 'Add names', emoji: '🍾' }]}
                rotation={rotation}
                spinning={spinning}
                targetIndex={winnerIndex}
                spinnerIndex={0}
              />
            </div>
          )}

          <Button size="lg" onClick={() => doSpin()} disabled={!canSpin} loading={spinning}>
            {spinning ? 'Spinning…' : 'Spin'}
          </Button>
          {options.mode === 'wheel' && names.length < WHEEL_MIN_NAMES && (
            <p className="text-sm text-muted">Add at least {WHEEL_MIN_NAMES} names to spin.</p>
          )}
          {options.mode === 'bottle' && overBottleLimit && (
            <p className="text-sm text-card-red">The bottle fits up to 12 people. Switch to the wheel or remove some.</p>
          )}
          {options.mode === 'bottle' && !overBottleLimit && names.length < 2 && <p className="text-sm text-muted">Add at least 2 names to spin.</p>}
          {compact && (
            <Button variant="secondary" onClick={() => setNamesSheetOpen(true)}>
              Names &amp; settings ({names.length})
            </Button>
          )}
        </div>

        {!compact && <div className="min-w-0">{panel}</div>}
      </div>

      {compact && (
        <Sheet open={namesSheetOpen} onClose={() => setNamesSheetOpen(false)} label="Names and settings" className="max-h-[85vh] overflow-y-auto">
          {panel}
        </Sheet>
      )}

      {options.mode === 'wheel' ? (
        <ResultSheet
          open={resultOpen}
          winner={winner}
          history={history}
          canRemove={names.length > 1}
          prompt={prompt}
          onClose={() => setResultOpen(false)}
          onSpinAgain={() => {
            setResultOpen(false);
            doWheelSpin();
          }}
          onRemoveAndSpinAgain={() => {
            setResultOpen(false);
            const next = winnerIndex === null ? names : names.filter((_, i) => i !== winnerIndex);
            setNames(next);
            setNamesRevision((r) => r + 1);
            doWheelSpin(undefined, next);
          }}
        />
      ) : (
        <BottleResultSheet
          open={resultOpen}
          target={winnerIndex !== null ? bottlePlayers[winnerIndex] ?? null : null}
          nextSpinner={bottlePlayers[0] ?? null}
          prompt={prompt}
          onClose={() => setResultOpen(false)}
          onNextSpin={() => {
            setResultOpen(false);
            doBottleSpin();
          }}
        />
      )}

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
              setOptions((o) => ({ ...o, pack: 'flirty', flirtyConfirmed: true }));
            }}
          >
            Yes, we're 18+
          </Button>
        </div>
      </Modal>
    </main>
  );
}

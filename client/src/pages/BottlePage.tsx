import { promptPool, type BottlePromptPack } from '@shared/games/bottle/prompts';
import { useRef, useState } from 'react';
import { BOTTLE_MIN_PLAYERS } from '../game/bottle/logic';
import { useBottleSpin } from '../game/bottle/useBottleSpin';
import {
  deleteSavedGroup,
  loadBottleOptions,
  loadSavedGroups,
  saveBottleOptions,
  saveGroup,
  type BottleOptions,
  type BottlePlayer,
  type SavedGroup,
} from '../game/bottle/storage';
import { BottleSvg } from '../components/bottle/BottleSvg';
import { PlayerSetup } from '../components/bottle/PlayerSetup';
import { BottleResultSheet } from '../components/bottle/ResultSheet';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { Surface } from '../components/ui/Surface';
import { playSound } from '../game/sounds';

const PACKS = ['off', 'party', 'flirty'] as const;

export function BottlePage() {
  const [players, setPlayers] = useState<BottlePlayer[]>([]);
  const [savedGroups, setSavedGroups] = useState<SavedGroup[]>(() => loadSavedGroups());
  const [options, setOptions] = useState<BottleOptions>(() => loadBottleOptions());
  const [started, setStarted] = useState(false);
  const [spinnerIndex, setSpinnerIndex] = useState(0);
  const [targetIndex, setTargetIndex] = useState<number | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [confirmFlirty, setConfirmFlirty] = useState(false);
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

  if (!started) {
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
          onStart={() => setStarted(true)}
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
    <main className="mx-auto flex min-h-full max-w-2xl flex-col px-4 pb-10 pt-2">
      <PageHeader title="Spin the Bottle" />
      <div className="-mt-2 flex justify-center">
        <Button variant="ghost" size="sm" onClick={() => setStarted(false)}>
          Edit players
        </Button>
      </div>

      <div
        className="mx-auto mt-2 w-full max-w-sm cursor-pointer touch-none select-none"
        onClick={() => {
          if (!spinning) playSound('click');
          doSpin();
        }}
        onPointerDown={(e) => {
          const startY = e.clientY;
          const startT = performance.now();
          const onUp = (ev: PointerEvent) => {
            const dt = Math.max(1, performance.now() - startT);
            const dy = startY - ev.clientY;
            window.removeEventListener('pointerup', onUp);
            if (Math.abs(dy) > 30) doSpin((dy / dt) * 100);
          };
          window.addEventListener('pointerup', onUp);
        }}
      >
        <BottleSvg players={players} rotation={rotation} spinning={spinning} targetIndex={targetIndex} spinnerIndex={spinnerIndex} />
      </div>

      <p className="mt-2 text-center font-semibold text-muted">
        {spinning ? 'Spinning…' : `${players[spinnerIndex]?.name ?? ''}'s turn to spin. Tap or flick the bottle.`}
      </p>

      <BottleResultSheet
        open={resultOpen}
        target={targetIndex !== null ? players[targetIndex] : null}
        nextSpinner={players[nextSpinnerIndex()] ?? null}
        prompt={prompt}
        onClose={() => setResultOpen(false)}
        onNextSpin={onNextSpin}
      />
    </main>
  );
}

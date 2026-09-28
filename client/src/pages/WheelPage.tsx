import { useEffect, useRef, useState } from 'react';
import { WHEEL_MIN_NAMES, decodeWheelShare, encodeWheelShare } from '../game/wheel/logic';
import { useWheelSpin } from '../game/wheel/useWheelSpin';
import {
  deleteSavedWheel,
  loadHistory,
  loadSavedWheels,
  loadWheelOptions,
  pushHistory,
  saveWheel,
  saveWheelOptions,
  type SavedWheel,
} from '../game/wheel/storage';
import { NameEditor } from '../components/wheel/NameEditor';
import { ResultSheet } from '../components/wheel/ResultSheet';
import { WheelSvg } from '../components/wheel/WheelSvg';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { Surface } from '../components/ui/Surface';
import { copyText } from '../utils/clipboard';
import { toast } from '../store/toastStore';

const SPIN_LENGTHS = ['short', 'normal', 'long'] as const;

export function WheelPage() {
  const [title, setTitle] = useState('');
  const [names, setNames] = useState<string[]>([]);
  // Bumped whenever names are replaced wholesale (a shared link or a saved wheel), so
  // NameEditor's uncontrolled textarea remounts instead of showing stale text.
  const [namesRevision, setNamesRevision] = useState(0);
  const [options, setOptions] = useState(() => loadWheelOptions());
  const [saved, setSaved] = useState<SavedWheel[]>(() => loadSavedWheels());
  const [history, setHistory] = useState<string[]>(() => loadHistory());
  const [winner, setWinner] = useState<string | null>(null);
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const flickSpeed = useRef(0);
  const { rotation, spinning, spin } = useWheelSpin();

  // Opening a shared link recreates the wheel from the URL hash.
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    const shared = decodeWheelShare(hash);
    if (shared) {
      setTitle(shared.title);
      setNames(shared.names);
      setNamesRevision((r) => r + 1);
    }
  }, []);

  useEffect(() => saveWheelOptions(options), [options]);

  const canSpin = names.length >= WHEEL_MIN_NAMES && !spinning;

  const doSpin = (forceIndex?: number, namesOverride?: string[]) => {
    const spinNames = namesOverride ?? names;
    if (spinNames.length < WHEEL_MIN_NAMES || spinning) return;
    spin(
      { names: spinNames, spinLength: options.spinLength, sound: options.sound, onLand: (index) => onLand(index, spinNames) },
      forceIndex,
      flickSpeed.current,
    );
    flickSpeed.current = 0;
  };

  const onLand = (index: number, spinNames: string[]) => {
    const name = spinNames[index];
    setWinner(name);
    setWinnerIndex(index);
    setResultOpen(true);
    setHistory(pushHistory(name));
    if (options.removeWinners) {
      setNames((prev) => prev.filter((_, i) => i !== index));
      setNamesRevision((r) => r + 1);
    }
  };

  const onFlick = (velocity: number) => {
    flickSpeed.current = velocity;
    doSpin();
  };

  const share = async () => {
    const encoded = encodeWheelShare({ title, names });
    if (!encoded) {
      toast("That's too much to fit in a link. Try fewer or shorter names.", 'bad');
      return;
    }
    const url = `${window.location.origin}/wheel#${encoded}`;
    toast((await copyText(url)) ? 'Share link copied' : url, 'good', '🔗');
  };

  return (
    <main className="mx-auto flex min-h-full max-w-3xl flex-col px-4 pb-12 pt-2">
      <PageHeader title="Name Wheel" />

      <div className="mt-2 flex flex-col items-center gap-4">
        <div
          className="w-full max-w-sm cursor-pointer touch-none select-none"
          onClick={() => canSpin && doSpin()}
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
        <Button size="lg" onClick={() => doSpin()} disabled={!canSpin} loading={spinning}>
          {spinning ? 'Spinning…' : 'Spin'}
        </Button>
        {names.length < WHEEL_MIN_NAMES && <p className="text-sm text-muted">Add at least {WHEEL_MIN_NAMES} names to spin.</p>}
      </div>

      <Surface className="mt-6 p-5">
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
              setSaved(saveWheel({ title, names }));
              toast('Wheel saved', 'good');
            }}
          >
            Save wheel
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void share()}>
            Share wheel
          </Button>
        </div>

        {saved.length > 0 && (
          <div className="mt-5">
            <h3 className="mb-2 text-sm font-semibold text-muted">Saved wheels</h3>
            <ul className="flex flex-col gap-1.5">
              {saved.map((w) => (
                <li key={w.title} className="flex items-center justify-between gap-2 rounded-xl bg-white/5 px-3 py-2">
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left font-semibold text-ink hover:text-wheel-gold"
                    onClick={() => {
                      setTitle(w.title);
                      setNames(w.names);
                      setNamesRevision((r) => r + 1);
                    }}
                  >
                    {w.title} <span className="font-normal text-muted">({w.names.length})</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${w.title}`}
                    className="shrink-0 rounded-lg px-2 py-1 text-muted hover:bg-card-red/20 hover:text-card-red"
                    onClick={() => setSaved(deleteSavedWheel(w.title))}
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

      <ResultSheet
        open={resultOpen}
        winner={winner}
        history={history}
        canRemove={names.length > 1}
        onClose={() => setResultOpen(false)}
        onSpinAgain={() => {
          setResultOpen(false);
          doSpin();
        }}
        onRemoveAndSpinAgain={() => {
          setResultOpen(false);
          const next = winnerIndex === null ? names : names.filter((_, i) => i !== winnerIndex);
          setNames(next);
          setNamesRevision((r) => r + 1);
          doSpin(undefined, next);
        }}
      />
    </main>
  );
}

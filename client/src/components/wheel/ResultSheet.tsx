import confetti from 'canvas-confetti';
import { useEffect } from 'react';
import { Button } from '../ui/Button';
import { Sheet } from '../ui/Sheet';
import { copyText } from '../../utils/clipboard';
import { toast } from '../../store/toastStore';

const CONFETTI_COLORS = ['#e6394a', '#f7c948', '#ffffff'];

interface ResultSheetProps {
  open: boolean;
  winner: string | null;
  history: string[];
  onSpinAgain: () => void;
  onRemoveAndSpinAgain: () => void;
  onClose: () => void;
  canRemove: boolean;
}

export function ResultSheet({ open, winner, history, onSpinAgain, onRemoveAndSpinAgain, onClose, canRemove }: ResultSheetProps) {
  useEffect(() => {
    if (!open || !winner || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    confetti({ particleCount: 140, spread: 90, origin: { y: 0.4 }, colors: CONFETTI_COLORS, zIndex: 60 });
  }, [open, winner]);

  const copy = async () => {
    if (!winner) return;
    toast((await copyText(winner)) ? 'Copied' : `Couldn't copy. ${winner}`, 'good', '📋');
  };

  return (
    <Sheet open={open} onClose={onClose} label="Wheel result">
      <div className="flex flex-col items-center gap-1 text-center">
        <span className="text-sm font-semibold text-muted">The wheel says</span>
        <h2 className="font-display text-3xl">{winner}</h2>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <Button onClick={onSpinAgain}>Spin again</Button>
        <Button variant="secondary" onClick={onRemoveAndSpinAgain} disabled={!canRemove}>
          Remove &amp; spin again
        </Button>
      </div>
      <Button variant="ghost" className="mt-2 w-full" onClick={() => void copy()}>
        Copy result
      </Button>

      {history.length > 1 && (
        <div className="mt-5">
          <h3 className="mb-1.5 text-sm font-semibold text-muted">Recent results</h3>
          <ul className="flex flex-col gap-1 text-sm text-muted">
            {history.slice(1, 10).map((name, i) => (
              <li key={i} className="truncate">
                {name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Sheet>
  );
}

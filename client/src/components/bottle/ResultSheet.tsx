import { Button } from '../ui/Button';
import { Sheet } from '../ui/Sheet';
import type { BottlePlayer } from '../../game/bottle/storage';

interface BottleResultSheetProps {
  open: boolean;
  target: BottlePlayer | null;
  nextSpinner: BottlePlayer | null;
  prompt: string | null;
  onClose: () => void;
  onNextSpin: () => void;
}

export function BottleResultSheet({ open, target, nextSpinner, prompt, onClose, onNextSpin }: BottleResultSheetProps) {
  if (!target) return null;
  return (
    <Sheet open={open} onClose={onClose} label="Bottle result">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="text-5xl">{target.emoji}</span>
        <h2 className="font-display text-2xl">{target.name}</h2>
        {prompt && <p className="mt-2 text-lg font-semibold text-ink">{prompt}</p>}
      </div>
      <Button size="lg" className="mt-6 w-full" onClick={onNextSpin}>
        {nextSpinner ? `${nextSpinner.name}, spin next` : 'Spin again'}
      </Button>
    </Sheet>
  );
}

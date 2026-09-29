import { useEffect } from 'react';
import { CARD_COLORS, type CardColor } from '@shared';
import { COLOR_HEX } from '../../utils/format';
import { Modal } from '../ui/Modal';

export function ColorPicker({ open, onPick, onCancel }: { open: boolean; onPick: (c: CardColor) => void; onCancel: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const index = Number(e.key) - 1;
      if (index >= 0 && index < CARD_COLORS.length) onPick(CARD_COLORS[index]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onPick]);

  return (
    <Modal open={open} onClose={onCancel} label="Choose a color" className="max-w-sm">
      <h2 className="text-center font-display text-2xl">Choose a color</h2>
      <p className="mt-1 text-center text-sm text-muted">The next player has to match it.</p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {CARD_COLORS.map((color, i) => (
          <button
            key={color}
            type="button"
            autoFocus={i === 0}
            onClick={() => onPick(color)}
            className="group flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-3xl font-display text-xl capitalize text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.4),0_6px_0_rgb(0_0_0/0.3)] transition-transform hover:-translate-y-1 active:translate-y-0.5"
            style={{ background: COLOR_HEX[color], color: color === 'yellow' ? 'var(--color-card-wild)' : undefined }}
          >
            {color}
            <span className="text-xs font-sans font-bold opacity-70">Press {i + 1}</span>
          </button>
        ))}
      </div>
      <button type="button" onClick={onCancel} className="mt-4 w-full rounded-2xl py-2 font-semibold text-muted hover:bg-veil/5 hover:text-ink">
        Keep my card
      </button>
    </Modal>
  );
}

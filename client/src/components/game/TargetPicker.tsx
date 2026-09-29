import type { PublicPlayer } from '@shared';
import { Avatar } from '../ui/Avatar';
import { Modal } from '../ui/Modal';

interface TargetPickerProps {
  open: boolean;
  players: PublicPlayer[];
  onPick: (playerId: string) => void;
  onCancel: () => void;
}

/** House rule (Seven-0): choose who to swap hands with after playing a 7. */
export function TargetPicker({ open, players, onPick, onCancel }: TargetPickerProps) {
  return (
    <Modal open={open} onClose={onCancel} label="Choose a player" className="max-w-sm">
      <h2 className="text-center font-display text-2xl">Swap hands with…</h2>
      <p className="mt-1 text-center text-sm text-muted">Playing a 7 trades your hand with theirs.</p>
      <div className="mt-5 flex flex-col gap-2">
        {players.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onPick(p.id)}
            className="flex items-center gap-3 rounded-2xl bg-veil/5 px-4 py-3 text-left font-bold text-ink ring-1 ring-line hover:bg-veil/10"
          >
            <Avatar index={p.avatar} size={32} dim={!p.connected} />
            <span className="min-w-0 flex-1 truncate">{p.nickname}</span>
          </button>
        ))}
      </div>
      <button type="button" onClick={onCancel} className="mt-4 w-full rounded-2xl py-2 font-semibold text-muted hover:bg-veil/5 hover:text-ink">
        Keep my card
      </button>
    </Modal>
  );
}

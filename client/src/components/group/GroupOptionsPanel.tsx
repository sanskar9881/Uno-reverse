import type { GroupCardType, GroupPickMode } from '@shared';
import { GROUP_CARD_TYPES, GROUP_CARD_TYPE_HINT, GROUP_CARD_TYPE_LABEL } from '@shared/games/group/cards';
import { useState } from 'react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Surface } from '../ui/Surface';

interface GroupOptionsPanelProps {
  types: GroupCardType[];
  onChangeTypes: (types: GroupCardType[]) => void;
  pickMode: GroupPickMode;
  noTouch: boolean;
  drinks: boolean;
  passPenalty: boolean;
  onChangeOption: (patch: { pickMode?: GroupPickMode; noTouch?: boolean; drinks?: boolean; passPenalty?: boolean }) => void;
  spicyConfirmed: boolean;
  onConfirmSpicy: () => void;
  disabled?: boolean;
  className?: string;
}

/** Which card types are in play, plus No-touch, Drinks, a fun Pass penalty, and how the next player is picked. */
export function GroupOptionsPanel({
  types,
  onChangeTypes,
  pickMode,
  noTouch,
  drinks,
  passPenalty,
  onChangeOption,
  spicyConfirmed,
  onConfirmSpicy,
  disabled,
  className,
}: GroupOptionsPanelProps) {
  const [confirmSpicyOpen, setConfirmSpicyOpen] = useState(false);

  const toggleType = (type: GroupCardType) => {
    const has = types.includes(type);
    if (has && types.length === 1) return;
    if (!has && type === 'spicy' && !spicyConfirmed) {
      setConfirmSpicyOpen(true);
      return;
    }
    onChangeTypes(has ? types.filter((t) => t !== type) : [...types, type]);
  };

  return (
    <Surface className={className ? `p-4 ${className}` : 'p-4'}>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden pr-0.5">
        <div>
          <h2 className="font-display text-xl">Card types</h2>
          <div className="mt-2 flex flex-col gap-1.5">
            {GROUP_CARD_TYPES.map((type) => (
              <label key={type} className="flex items-center justify-between gap-3 rounded-2xl bg-veil/5 px-3 py-2">
                <span>
                  <span className="block text-sm font-semibold text-ink">{GROUP_CARD_TYPE_LABEL[type]}</span>
                  <span className="block text-[11px] leading-4 text-muted">{GROUP_CARD_TYPE_HINT[type]}</span>
                </span>
                <input
                  type="checkbox"
                  checked={types.includes(type)}
                  onChange={() => toggleType(type)}
                  disabled={disabled}
                  className="mt-1 h-5 w-5 shrink-0 accent-group-violet"
                />
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="flex items-center justify-between gap-3 rounded-xl bg-veil/5 px-3 py-2">
            <span>
              <span className="block text-sm font-semibold text-ink">No-touch mode</span>
              <span className="block text-[11px] leading-4 text-muted">Hides touch dares.</span>
            </span>
            <input
              type="checkbox"
              checked={noTouch}
              onChange={(e) => onChangeOption({ noTouch: e.target.checked })}
              disabled={disabled}
              className="h-5 w-5 shrink-0 accent-group-violet"
            />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-xl bg-veil/5 px-3 py-2">
            <span>
              <span className="block text-sm font-semibold text-ink">Drinks</span>
              <span className="block text-[11px] leading-4 text-muted">Alcoholic or non-alcoholic.</span>
            </span>
            <input
              type="checkbox"
              checked={drinks}
              onChange={(e) => onChangeOption({ drinks: e.target.checked })}
              disabled={disabled}
              className="h-5 w-5 shrink-0 accent-group-violet"
            />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-xl bg-veil/5 px-3 py-2">
            <span>
              <span className="block text-sm font-semibold text-ink">Fun penalty for Pass</span>
              <span className="block text-[11px] leading-4 text-muted">Shows a silly penalty, like 10 squats.</span>
            </span>
            <input
              type="checkbox"
              checked={passPenalty}
              onChange={(e) => onChangeOption({ passPenalty: e.target.checked })}
              disabled={disabled}
              className="h-5 w-5 shrink-0 accent-group-violet"
            />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-xl bg-veil/5 px-3 py-2">
            <span>
              <span className="block text-sm font-semibold text-ink">Spin to pick who's next</span>
              <span className="block text-[11px] leading-4 text-muted">Off: seat order. On: bottle spin.</span>
            </span>
            <input
              type="checkbox"
              checked={pickMode === 'spin'}
              onChange={(e) => onChangeOption({ pickMode: e.target.checked ? 'spin' : 'order' })}
              disabled={disabled}
              className="h-5 w-5 shrink-0 accent-group-violet"
            />
          </label>
        </div>
      </div>

      <Modal open={confirmSpicyOpen} onClose={() => setConfirmSpicyOpen(false)} label="Confirm everyone is 18 or older" className="max-w-sm text-center">
        <h2 className="font-display text-2xl">Everyone here is 18+?</h2>
        <p className="mt-2 text-muted">Spicy cards are flirty and bold, meant for adults only.</p>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setConfirmSpicyOpen(false)}>
            Not yet
          </Button>
          <Button
            onClick={() => {
              setConfirmSpicyOpen(false);
              onConfirmSpicy();
              onChangeTypes([...types, 'spicy']);
            }}
          >
            Yes, we're 18+
          </Button>
        </div>
      </Modal>
    </Surface>
  );
}

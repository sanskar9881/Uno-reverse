import type { GroupCardType, GroupPickMode } from '@shared';
import { GROUP_CARD_TYPES, GROUP_CARD_TYPE_HINT, GROUP_CARD_TYPE_LABEL } from '@shared/games/group/cards';
import { useState } from 'react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

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
}

function Switch({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="pn-switch"
    />
  );
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
    <div className="pn-panel">
      <h2 className="pn-panel__title">Card types</h2>
      <div className="pn-toggle-list" style={{ marginTop: 10 }}>
        {GROUP_CARD_TYPES.map((type) => (
          <div key={type} className="pn-toggle-row">
            <span className="pn-toggle-row__text">
              <span className="pn-toggle-row__title">{GROUP_CARD_TYPE_LABEL[type]}</span>
              <span className="pn-toggle-row__desc">{GROUP_CARD_TYPE_HINT[type]}</span>
            </span>
            <Switch label={GROUP_CARD_TYPE_LABEL[type]} checked={types.includes(type)} onChange={() => toggleType(type)} disabled={disabled} />
          </div>
        ))}
      </div>

      <div className="pn-toggle-list" style={{ marginTop: 16 }}>
        <div className="pn-toggle-row">
          <span className="pn-toggle-row__text">
            <span className="pn-toggle-row__title">No-touch mode</span>
            <span className="pn-toggle-row__desc">Hides dares that involve touching someone.</span>
          </span>
          <Switch label="No-touch mode" checked={noTouch} onChange={(v) => onChangeOption({ noTouch: v })} disabled={disabled} />
        </div>
        <div className="pn-toggle-row">
          <span className="pn-toggle-row__text">
            <span className="pn-toggle-row__title">Drinks</span>
            <span className="pn-toggle-row__desc">Off by default. Every drink dare offers a non-alcoholic swap.</span>
          </span>
          <Switch label="Drinks" checked={drinks} onChange={(v) => onChangeOption({ drinks: v })} disabled={disabled} />
        </div>
        <div className="pn-toggle-row">
          <span className="pn-toggle-row__text">
            <span className="pn-toggle-row__title">Fun penalty for Pass</span>
            <span className="pn-toggle-row__desc">Passing still always works — this just shows a silly penalty, like 10 squats.</span>
          </span>
          <Switch label="Fun penalty for Pass" checked={passPenalty} onChange={(v) => onChangeOption({ passPenalty: v })} disabled={disabled} />
        </div>
        <div className="pn-toggle-row">
          <span className="pn-toggle-row__text">
            <span className="pn-toggle-row__title">Spin to pick who's next</span>
            <span className="pn-toggle-row__desc">Off: goes around in seat order. On: a small bottle spin decides.</span>
          </span>
          <Switch
            label="Spin to pick who's next"
            checked={pickMode === 'spin'}
            onChange={(v) => onChangeOption({ pickMode: v ? 'spin' : 'order' })}
            disabled={disabled}
          />
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
    </div>
  );
}

import { GROUP_MAX_PLAYERS, GROUP_MIN_PLAYERS } from '@shared';
import { useState } from 'react';
import { isDuplicateName } from '../../utils/names';

function RemoveIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/** Names in seating order, 2 to 12, no repeats. */
export function GroupPlayerSetup({ players, onChange }: { players: string[]; onChange: (players: string[]) => void }) {
  const [name, setName] = useState('');
  const [duplicateError, setDuplicateError] = useState(false);

  const addPlayer = () => {
    const trimmed = name.trim();
    if (!trimmed || players.length >= GROUP_MAX_PLAYERS) return;
    if (isDuplicateName(players, trimmed)) {
      setDuplicateError(true);
      return;
    }
    onChange([...players, trimmed]);
    setName('');
    setDuplicateError(false);
  };

  return (
    <div className="pn-panel">
      <h2 className="pn-panel__title">Who's playing?</h2>
      <p className="pn-panel__desc">
        Add {GROUP_MIN_PLAYERS} to {GROUP_MAX_PLAYERS} players, in seating order.
      </p>

      {players.length > 0 && (
        <ul className="pn-name-list" style={{ marginTop: 14 }}>
          {players.map((p, i) => (
            <li key={i} className="pn-name-row">
              <span className="pn-name-row__num">{i + 1}</span>
              <span className="pn-name-row__name" title={p}>
                {p}
              </span>
              <button
                type="button"
                aria-label={`Remove ${p}`}
                onClick={() => onChange(players.filter((_, idx) => idx !== i))}
                className="pn-icon-btn"
              >
                <RemoveIcon />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex gap-2">
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setDuplicateError(false);
          }}
          onKeyDown={(e) => e.key === 'Enter' && addPlayer()}
          placeholder="Player name"
          aria-invalid={duplicateError || undefined}
          className="pn-input"
        />
        <button type="button" className="pn-btn" onClick={addPlayer} disabled={!name.trim() || players.length >= GROUP_MAX_PLAYERS}>
          Add
        </button>
      </div>
      <p className={duplicateError ? 'pn-hint pn-hint--error' : 'pn-hint'} role={duplicateError ? 'alert' : undefined}>
        {duplicateError ? `Someone's already called ${name.trim()}. Try another name.` : ''}
      </p>
    </div>
  );
}

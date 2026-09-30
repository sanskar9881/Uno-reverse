import { GROUP_MAX_PLAYERS, GROUP_MIN_PLAYERS } from '@shared';
import { useState } from 'react';
import { isDuplicateName } from '../../utils/names';
import { Button } from '../ui/Button';
import { Surface } from '../ui/Surface';

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
    <Surface className="p-5">
      <h2 className="font-display text-xl">Who's playing?</h2>
      <p className="mt-1 text-sm text-muted">
        Add {GROUP_MIN_PLAYERS} to {GROUP_MAX_PLAYERS} players, in seating order.
      </p>

      <ul className="mt-4 flex flex-col gap-2">
        {players.map((p, i) => (
          <li key={i} className="flex items-center gap-2 rounded-xl bg-veil/5 px-3 py-2">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-veil/10 text-xs font-bold text-muted">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate font-semibold text-ink">{p}</span>
            <button
              type="button"
              aria-label={`Remove ${p}`}
              onClick={() => onChange(players.filter((_, idx) => idx !== i))}
              className="shrink-0 rounded-lg px-2 py-1 text-muted hover:bg-card-red/20 hover:text-card-red"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

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
          className="h-11 min-w-0 flex-1 rounded-xl bg-night px-3.5 text-ink ring-1 ring-line placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-group-violet"
        />
        <Button variant="secondary" onClick={addPlayer} disabled={!name.trim() || players.length >= GROUP_MAX_PLAYERS}>
          Add
        </Button>
      </div>
      {duplicateError && (
        <p className="mt-1.5 text-sm text-card-red" role="alert">
          Someone's already called {name.trim()}. Try another name.
        </p>
      )}
    </Surface>
  );
}

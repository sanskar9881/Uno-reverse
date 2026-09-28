import { AVATARS } from '@shared';
import { useState } from 'react';
import { BOTTLE_MAX_PLAYERS } from '../../game/bottle/logic';
import type { BottlePlayer, SavedGroup } from '../../game/bottle/storage';
import { Button } from '../ui/Button';
import { Surface } from '../ui/Surface';
import { toast } from '../../store/toastStore';

interface PlayerSetupProps {
  players: BottlePlayer[];
  onChange: (players: BottlePlayer[]) => void;
  savedGroups: SavedGroup[];
  onSaveGroup: (name: string) => void;
  onLoadGroup: (group: SavedGroup) => void;
  onDeleteGroup: (name: string) => void;
  onStart: () => void;
}

export function PlayerSetup({ players, onChange, savedGroups, onSaveGroup, onLoadGroup, onDeleteGroup, onStart }: PlayerSetupProps) {
  const [name, setName] = useState('');
  const [groupName, setGroupName] = useState('');

  const addPlayer = () => {
    const trimmed = name.trim();
    if (!trimmed || players.length >= BOTTLE_MAX_PLAYERS) return;
    const emoji = AVATARS[players.length % AVATARS.length];
    onChange([...players, { name: trimmed, emoji }]);
    setName('');
  };

  const cycleEmoji = (index: number) => {
    const current = AVATARS.indexOf(players[index].emoji as (typeof AVATARS)[number]);
    const next = AVATARS[(current + 1) % AVATARS.length];
    onChange(players.map((p, i) => (i === index ? { ...p, emoji: next } : p)));
  };

  return (
    <div className="flex flex-col gap-4">
      <Surface className="p-5">
        <h2 className="font-display text-xl">Who's playing?</h2>
        <p className="mt-1 text-sm text-muted">Add 2 to {BOTTLE_MAX_PLAYERS} players.</p>

        <ul className="mt-4 flex flex-col gap-2">
          {players.map((p, i) => (
            <li key={i} className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
              <button
                type="button"
                aria-label={`Change emoji for ${p.name}`}
                onClick={() => cycleEmoji(i)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/5 text-xl hover:bg-white/10"
              >
                {p.emoji}
              </button>
              <span className="min-w-0 flex-1 truncate font-semibold text-ink">{p.name}</span>
              <button
                type="button"
                aria-label={`Remove ${p.name}`}
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
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addPlayer()}
            placeholder="Player name"
            className="h-11 min-w-0 flex-1 rounded-xl bg-night px-3.5 text-ink ring-1 ring-line placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-bottle-amber"
          />
          <Button variant="secondary" onClick={addPlayer} disabled={!name.trim() || players.length >= BOTTLE_MAX_PLAYERS}>
            Add
          </Button>
        </div>

        <div className="mt-4 flex gap-2">
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Group name to save"
            className="h-10 min-w-0 flex-1 rounded-xl bg-night px-3.5 text-sm text-ink ring-1 ring-line placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-bottle-amber"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (!groupName.trim() || players.length === 0) {
                toast('Name the group and add some players first.', 'bad');
                return;
              }
              onSaveGroup(groupName.trim());
              setGroupName('');
            }}
          >
            Save group
          </Button>
        </div>

        {savedGroups.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-1.5 text-sm font-semibold text-muted">Saved groups</h3>
            <ul className="flex flex-col gap-1.5">
              {savedGroups.map((g) => (
                <li key={g.name} className="flex items-center justify-between gap-2 rounded-xl bg-white/5 px-3 py-2">
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left font-semibold text-ink hover:text-bottle-amber"
                    onClick={() => onLoadGroup(g)}
                  >
                    {g.name} <span className="font-normal text-muted">({g.players.length})</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${g.name}`}
                    className="shrink-0 rounded-lg px-2 py-1 text-muted hover:bg-card-red/20 hover:text-card-red"
                    onClick={() => onDeleteGroup(g.name)}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Surface>

      <Button size="lg" onClick={onStart} disabled={players.length < 2}>
        Start
      </Button>
      {players.length < 2 && <p className="text-center text-sm text-muted">Add at least 2 players to start.</p>}
    </div>
  );
}

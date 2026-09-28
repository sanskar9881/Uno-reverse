import { useState } from 'react';
import { WHEEL_MAX_NAMES } from '../../game/wheel/logic';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';

interface NameEditorProps {
  names: string[];
  onChange: (names: string[]) => void;
  title: string;
  onTitleChange: (title: string) => void;
}

export function NameEditor({ names, onChange, title, onTitleChange }: NameEditorProps) {
  const [text, setText] = useState(names.join('\n'));
  const [addOne, setAddOne] = useState('');

  const commit = (raw: string) => {
    const parsed = raw
      .split('\n')
      .map((n) => n.trim())
      .filter(Boolean)
      .slice(0, WHEEL_MAX_NAMES);
    onChange(parsed);
  };

  const sync = (raw: string) => {
    setText(raw);
    commit(raw);
  };

  const addName = () => {
    const trimmed = addOne.trim();
    if (!trimmed || names.length >= WHEEL_MAX_NAMES) return;
    const next = [...names, trimmed];
    onChange(next);
    setText(next.join('\n'));
    setAddOne('');
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label htmlFor="wheel-title" className="mb-1.5 block text-sm font-semibold text-muted">
          Wheel title
        </label>
        <input
          id="wheel-title"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="e.g. Who's cooking tonight?"
          className="h-12 w-full rounded-2xl bg-night px-4 font-semibold text-ink ring-1 ring-line placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-wheel-gold"
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="wheel-names" className="text-sm font-semibold text-muted">
            Names, one per line
          </label>
          <span className="text-sm font-semibold text-muted tabular-nums">
            {names.length}/{WHEEL_MAX_NAMES}
          </span>
        </div>
        <textarea
          id="wheel-names"
          value={text}
          onChange={(e) => sync(e.target.value)}
          rows={8}
          placeholder={'Sanskar\nRiya\nAmit\nZoya'}
          className="w-full resize-y rounded-2xl bg-night p-4 font-semibold text-ink ring-1 ring-line placeholder:text-muted/40 focus:outline-none focus:ring-2 focus:ring-wheel-gold"
        />
      </div>

      <div className="flex gap-2">
        <input
          value={addOne}
          onChange={(e) => setAddOne(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addName()}
          placeholder="Add one name…"
          className="h-11 min-w-0 flex-1 rounded-xl bg-night px-3.5 text-ink ring-1 ring-line placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-wheel-gold"
        />
        <Button variant="secondary" onClick={addName} disabled={!addOne.trim() || names.length >= WHEEL_MAX_NAMES}>
          Add
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            const shuffled = [...names];
            for (let i = shuffled.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            onChange(shuffled);
            setText(shuffled.join('\n'));
          }}
        >
          Shuffle
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            const sorted = [...names].sort((a, b) => a.localeCompare(b));
            onChange(sorted);
            setText(sorted.join('\n'));
          }}
        >
          Sort A–Z
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn(names.length === 0 && 'opacity-50')}
          onClick={() => {
            onChange([]);
            setText('');
          }}
          disabled={names.length === 0}
        >
          Clear
        </Button>
      </div>
    </div>
  );
}

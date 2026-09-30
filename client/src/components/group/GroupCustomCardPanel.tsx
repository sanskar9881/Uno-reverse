import type { CouplesKind, GroupCardType } from '@shared';
import { GROUP_CARD_TYPES, GROUP_CARD_TYPE_LABEL } from '@shared/games/group/cards';
import { useState } from 'react';
import {
  loadGroupCustomCards,
  removeGroupCustomCard,
  saveGroupCustomCard,
  saveGroupCustomCardsBulk,
  type GroupCustomCard,
} from '../../game/group/storage';
import { toast } from '../../store/toastStore';
import { cn } from '../../utils/cn';
import { Button } from '../ui/Button';

interface GroupCustomCardPanelProps {
  /** Online mode: lets a card be sent into the live room. Omit for Together mode (local only). */
  onUseInGame?: (card: GroupCustomCard) => void;
  busy?: boolean;
}

/** Custom Truth and Dare Group cards — text, type, kind and an optional timer. Saved on this device only. */
export function GroupCustomCardPanel({ onUseInGame, busy }: GroupCustomCardPanelProps) {
  const [cards, setCards] = useState(() => loadGroupCustomCards());
  const [composerOpen, setComposerOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [cardType, setCardType] = useState<GroupCardType>('normal');
  const [kind, setKind] = useState<CouplesKind>('truth');
  const [text, setText] = useState('');
  const [timerSeconds, setTimerSeconds] = useState('');

  const refresh = () => setCards(loadGroupCustomCards());

  const save = () => {
    if (bulkMode) {
      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length === 0) return;
      saveGroupCustomCardsBulk(cardType, kind, lines);
      toast(`Added ${lines.length} card${lines.length === 1 ? '' : 's'}`, 'good');
    } else {
      if (!text.trim()) return;
      const seconds = timerSeconds.trim() ? Math.max(1, Math.min(600, Number(timerSeconds))) : null;
      saveGroupCustomCard({ cardType, kind, text: text.trim(), timerSeconds: seconds });
      toast('Card saved', 'good');
    }
    setText('');
    setTimerSeconds('');
    setComposerOpen(false);
    refresh();
  };

  const remove = (id: string) => {
    removeGroupCustomCard(id);
    refresh();
  };

  return (
    <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto pr-0.5">
      <div>
        <h2 className="font-display text-xl">Custom cards</h2>
        <p className="mt-1 text-sm text-muted">Your own truths and dares, saved on this device only.</p>
      </div>

      {cards.length === 0 ? (
        <p className="rounded-2xl bg-veil/5 p-4 text-sm text-muted">Nothing saved yet. Add your first card below.</p>
      ) : (
        <ul className="flex max-h-[32vh] flex-col gap-2 overflow-y-auto">
          {cards.map((c) => (
            <li key={c.id} className="flex items-start gap-3 rounded-xl bg-veil/5 p-3">
              <div className="min-w-0 flex-1">
                <span className="text-xs font-bold uppercase tracking-wide text-group-violet">
                  {GROUP_CARD_TYPE_LABEL[c.cardType]} · {c.kind === 'truth' ? 'Truth' : 'Dare'}
                  {c.timerSeconds ? ` · ${c.timerSeconds}s` : ''}
                </span>
                <p className="text-sm text-ink">{c.text}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                {onUseInGame && (
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => onUseInGame(c)}>
                    Add to game
                  </Button>
                )}
                <button
                  type="button"
                  onClick={() => remove(c.id)}
                  className="text-xs font-semibold text-muted hover:text-card-red"
                  aria-label="Remove custom card"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!composerOpen ? (
        <Button variant="secondary" onClick={() => setComposerOpen(true)}>
          + Add a card
        </Button>
      ) : (
        <div className="flex flex-col gap-3 rounded-2xl bg-night p-4 ring-1 ring-line">
          <div className="flex flex-wrap gap-1.5">
            {GROUP_CARD_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setCardType(t)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-sm font-bold transition-colors',
                  cardType === t ? 'bg-card-yellow text-night' : 'bg-veil/10 text-muted hover:text-ink',
                )}
              >
                {GROUP_CARD_TYPE_LABEL[t]}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant={kind === 'truth' ? 'primary' : 'secondary'} size="sm" onClick={() => setKind('truth')}>
              Truth
            </Button>
            <Button variant={kind === 'dare' ? 'primary' : 'secondary'} size="sm" onClick={() => setKind('dare')}>
              Dare
            </Button>
            <label className="ml-auto flex items-center gap-1.5 text-sm font-semibold text-muted">
              <input type="checkbox" checked={bulkMode} onChange={(e) => setBulkMode(e.target.checked)} className="h-4 w-4 accent-group-violet" />
              Paste many
            </label>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, bulkMode ? 4000 : 200))}
            rows={bulkMode ? 6 : 3}
            placeholder={bulkMode ? 'One card per line...' : 'Write your own...'}
            className="w-full resize-none rounded-2xl bg-night-2 p-4 text-ink ring-1 ring-line placeholder:text-muted/40 focus:outline-none focus:ring-2 focus:ring-group-violet"
          />
          {!bulkMode && (
            <label className="flex items-center gap-2 text-sm font-semibold text-muted">
              Timer (seconds, optional)
              <input
                type="number"
                min={1}
                max={600}
                value={timerSeconds}
                onChange={(e) => setTimerSeconds(e.target.value)}
                placeholder="none"
                className="h-9 w-20 rounded-lg bg-night-2 px-2 text-center text-ink ring-1 ring-line placeholder:text-muted/40 focus:outline-none focus:ring-2 focus:ring-group-violet"
              />
            </label>
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setComposerOpen(false)}>
              Cancel
            </Button>
            <Button className="flex-1" disabled={!text.trim()} onClick={save}>
              {bulkMode ? 'Add all' : 'Save card'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

import type { CouplesLevel } from '@shared';
import { useRef, useState } from 'react';
import { LevelPicker } from '../couples/LevelPicker';
import { resizePhoto } from '../../game/ourDeck/photo';
import { loadOurDeck, removeOurDeckCard, saveOurDeckCard, type OurDeckEntry, type OurDeckGame } from '../../game/ourDeck/storage';
import { toast } from '../../store/toastStore';
import { cn } from '../../utils/cn';
import { Button } from '../ui/Button';

export interface OurDeckSlot {
  value: string;
  label: string;
}

interface OurDeckPanelProps {
  game: OurDeckGame;
  level: CouplesLevel;
  slots: OurDeckSlot[];
  /** Online mode: lets a card be sent into the live room. Omit for Together mode (local only). */
  onUseInGame?: (entry: OurDeckEntry) => void;
  busy?: boolean;
  onlyOurs: boolean;
  onToggleOnlyOurs: (value: boolean) => void;
}

/** Saved custom cards, with optional photos, shared between Couples and Intimacy Night. */
export function OurDeckPanel({ game, level, slots, onUseInGame, busy, onlyOurs, onToggleOnlyOurs }: OurDeckPanelProps) {
  const [entries, setEntries] = useState(() => loadOurDeck().filter((e) => e.game === game));
  const [composerOpen, setComposerOpen] = useState(false);
  const [slot, setSlot] = useState(slots[0]?.value ?? '');
  const [cardLevel, setCardLevel] = useState<CouplesLevel>(level);
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [resizing, setResizing] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = () => setEntries(loadOurDeck().filter((e) => e.game === game));

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setResizing(true);
    try {
      setPhoto(await resizePhoto(file));
    } catch {
      toast("Couldn't use that photo.", 'bad');
    } finally {
      setResizing(false);
    }
  };

  const save = () => {
    if (!text.trim() || !slot) return;
    saveOurDeckCard({ game, level: cardLevel, slot, text: text.trim(), photo });
    setText('');
    setPhoto(null);
    setComposerOpen(false);
    refresh();
    toast('Saved to Our deck', 'good');
  };

  const remove = (id: string) => {
    removeOurDeckCard(id);
    refresh();
  };

  const slotLabel = (value: string) => slots.find((s) => s.value === value)?.label ?? value;

  return (
    <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto pr-0.5">
      <div>
        <h2 className="font-couples text-xl">Our deck</h2>
        <p className="mt-1 text-sm text-muted">Cards and photos you save here are shared between Couples and Intimacy Night.</p>
      </div>

      <label className="flex items-center justify-between gap-3 rounded-2xl bg-night px-4 py-3 ring-1 ring-line">
        <span>
          <span className="block text-sm font-semibold text-ink">Play only our cards</span>
          <span className="block text-xs text-muted">Skip the built-in deck and draw only from what's saved here.</span>
        </span>
        <input
          type="checkbox"
          checked={onlyOurs}
          onChange={(e) => onToggleOnlyOurs(e.target.checked)}
          disabled={busy}
          className="mt-1 h-5 w-5 shrink-0 accent-couples-rose"
        />
      </label>

      {entries.length === 0 ? (
        <p className="rounded-2xl bg-veil/5 p-4 text-sm text-muted">Nothing saved yet. Add your first card below.</p>
      ) : (
        <ul className="flex max-h-[32vh] flex-col gap-2 overflow-y-auto">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-start gap-3 rounded-xl bg-veil/5 p-3">
              {entry.photo && (
                <img src={entry.photo} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-line" />
              )}
              <div className="min-w-0 flex-1">
                <span className="text-xs font-bold uppercase tracking-wide text-couples-candle">
                  {entry.level} · {slotLabel(entry.slot)}
                </span>
                <p className="text-sm text-ink">{entry.text}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                {onUseInGame && (
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => onUseInGame(entry)}>
                    Add to game
                  </Button>
                )}
                <button
                  type="button"
                  onClick={() => remove(entry.id)}
                  className="text-xs font-semibold text-muted hover:text-card-red"
                  aria-label="Remove from Our deck"
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
          <div>
            <span className="mb-1.5 block text-sm font-semibold text-muted">Category</span>
            <div className="flex flex-wrap gap-1.5">
              {slots.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSlot(s.value)}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-sm font-bold transition-colors',
                    slot === s.value ? 'bg-card-yellow text-night' : 'bg-veil/10 text-muted hover:text-ink',
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <LevelPicker label="Comfort level" value={cardLevel} onChange={setCardLevel} />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 200))}
            rows={3}
            placeholder="Write your own..."
            className="w-full resize-none rounded-2xl bg-night-2 p-4 text-ink ring-1 ring-line placeholder:text-muted/40 focus:outline-none focus:ring-2 focus:ring-couples-rose"
          />
          <p className="-mt-1.5 text-right text-xs text-muted">{text.length}/200</p>
          <div className="flex items-center gap-2">
            {photo && <img src={photo} alt="" className="h-12 w-12 rounded-lg object-cover ring-1 ring-line" />}
            <Button variant="ghost" size="sm" loading={resizing} onClick={() => fileInput.current?.click()}>
              {photo ? 'Change photo' : 'Add a photo'}
            </Button>
            {photo && (
              <button type="button" onClick={() => setPhoto(null)} className="text-sm font-semibold text-muted hover:text-card-red">
                Remove
              </button>
            )}
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void pickPhoto(e.target.files?.[0])}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setComposerOpen(false)}>
              Cancel
            </Button>
            <Button className="flex-1" disabled={!text.trim()} onClick={save}>
              Save to Our deck
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
